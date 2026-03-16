import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { WalletBalance } from './wallet-balance.entity';
import { Transaction, TransactionStatus, TransactionType } from '../transactions/transaction.entity';
import { FxService } from '../fx/fx.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';
import { TradeCurrencyDto } from './dto/trade-currency.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(WalletBalance)
    private readonly walletRepo: Repository<WalletBalance>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly fxService: FxService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Creates zero-balance wallet rows for all supported currencies on user registration.
   */
  async initializeWallets(userId: string): Promise<void> {
    const currencies = this.fxService.getSupportedCurrencies();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const currency of currencies) {
        const exists = await queryRunner.manager.findOne(WalletBalance, {
          where: { user: { id: userId }, currency },
        });
        if (!exists) {
          const balance = queryRunner.manager.create(WalletBalance, {
            user: { id: userId },
            currency,
            balance: '0',
          });
          await queryRunner.manager.save(balance);
        }
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to initialize wallets for user ${userId}`, err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getBalances(userId: string) {
    const balances = await this.walletRepo.find({
      where: { user: { id: userId } },
      order: { currency: 'ASC' },
    });

    return balances.map((b) => ({
      currency: b.currency,
      balance: parseFloat(b.balance),
    }));
  }

  /**
   * Fund a wallet. Uses pessimistic write lock to prevent race conditions.
   * Idempotent: if reference already exists, returns the existing transaction.
   */
  async fundWallet(userId: string, dto: FundWalletDto) {
    const reference = dto.reference || uuidv4();

    // Idempotency check
    const existing = await this.txRepo.findOne({ where: { reference } });
    if (existing) {
      return { message: 'Duplicate request. Transaction already processed.', transaction: existing };
    }

    this.validateCurrency(dto.currency);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let transaction: Transaction | undefined;

    try {
      // Create pending transaction record first
      transaction = queryRunner.manager.create(Transaction, {
        user: { id: userId },
        type: TransactionType.FUNDING,
        fromCurrency: dto.currency,
        fromAmount: dto.amount.toString(),
        status: TransactionStatus.PENDING,
        reference,
      });
      await queryRunner.manager.save(transaction);

      // Lock and update balance (pessimistic write lock)
      const balance = await queryRunner.manager
        .getRepository(WalletBalance)
        .createQueryBuilder('wb')
        .setLock('pessimistic_write')
        .where('wb.user_id = :userId AND wb.currency = :currency', {
          userId,
          currency: dto.currency,
        })
        .getOne();

      if (!balance) {
        // Create new currency wallet on-the-fly if not pre-initialized
        const newBalance = queryRunner.manager.create(WalletBalance, {
          user: { id: userId },
          currency: dto.currency,
          balance: dto.amount.toString(),
        });
        await queryRunner.manager.save(newBalance);
      } else {
        const newBalance = parseFloat(balance.balance) + dto.amount;
        await queryRunner.manager
          .getRepository(WalletBalance)
          .update(balance.id, { balance: newBalance.toFixed(8) });
      }

      // Mark transaction as completed
      await queryRunner.manager
        .getRepository(Transaction)
        .update(transaction.id, { status: TransactionStatus.COMPLETED });

      await queryRunner.commitTransaction();

      return {
        message: `Successfully funded ${dto.amount} ${dto.currency}`,
        reference,
        currency: dto.currency,
        amount: dto.amount,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (transaction?.id) {
        await this.txRepo.update(transaction.id, { status: TransactionStatus.FAILED });
      }
      this.logger.error('Fund wallet failed', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Convert between currencies. Deducts from source, credits to target.
   * Uses pessimistic write locking and atomic transactions.
   */
  async convertCurrency(userId: string, dto: ConvertCurrencyDto) {
    if (dto.fromCurrency === dto.toCurrency) {
      throw new BadRequestException('Source and target currencies must differ');
    }

    this.validateCurrency(dto.fromCurrency);
    this.validateCurrency(dto.toCurrency);

    const reference = dto.reference || uuidv4();

    // Idempotency check
    const existing = await this.txRepo.findOne({ where: { reference } });
    if (existing) {
      return { message: 'Duplicate request. Transaction already processed.', transaction: existing };
    }

    // Fetch live rate before acquiring lock
    const rate = await this.fxService.getRate(dto.fromCurrency, dto.toCurrency);
    const toAmount = parseFloat((dto.amount * rate).toFixed(8));

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let transaction: Transaction | undefined;

    try {
      // Create pending transaction
      transaction = queryRunner.manager.create(Transaction, {
        user: { id: userId },
        type: TransactionType.CONVERSION,
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        fromAmount: dto.amount.toString(),
        toAmount: toAmount.toString(),
        rate: rate.toString(),
        status: TransactionStatus.PENDING,
        reference,
      });
      await queryRunner.manager.save(transaction);

      // Lock both balances
      const fromBalance = await queryRunner.manager
        .getRepository(WalletBalance)
        .createQueryBuilder('wb')
        .setLock('pessimistic_write')
        .where('wb.user_id = :userId AND wb.currency = :currency', {
          userId,
          currency: dto.fromCurrency,
        })
        .getOne();

      if (!fromBalance || parseFloat(fromBalance.balance) < dto.amount) {
        throw new BadRequestException(
          `Insufficient ${dto.fromCurrency} balance. Available: ${parseFloat(fromBalance?.balance || '0').toFixed(2)}`,
        );
      }

      let toBalance = await queryRunner.manager
        .getRepository(WalletBalance)
        .createQueryBuilder('wb')
        .setLock('pessimistic_write')
        .where('wb.user_id = :userId AND wb.currency = :currency', {
          userId,
          currency: dto.toCurrency,
        })
        .getOne();

      // Deduct from source
      const newFromBalance = parseFloat(fromBalance.balance) - dto.amount;
      await queryRunner.manager
        .getRepository(WalletBalance)
        .update(fromBalance.id, { balance: newFromBalance.toFixed(8) });

      // Credit to target
      if (!toBalance) {
        toBalance = queryRunner.manager.create(WalletBalance, {
          user: { id: userId },
          currency: dto.toCurrency,
          balance: toAmount.toFixed(8),
        });
        await queryRunner.manager.save(toBalance);
      } else {
        const newToBalance = parseFloat(toBalance.balance) + toAmount;
        await queryRunner.manager
          .getRepository(WalletBalance)
          .update(toBalance.id, { balance: newToBalance.toFixed(8) });
      }

      // Mark completed
      await queryRunner.manager
        .getRepository(Transaction)
        .update(transaction.id, { status: TransactionStatus.COMPLETED });

      await queryRunner.commitTransaction();

      return {
        message: 'Conversion successful',
        reference,
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        fromAmount: dto.amount,
        toAmount,
        rate,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (transaction?.id) {
        await this.txRepo.update(transaction.id, { status: TransactionStatus.FAILED });
      }
      if (err instanceof BadRequestException) throw err;
      this.logger.error('Conversion failed', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Trade currencies (functionally same as conversion, different type label).
   */
  async trade(userId: string, dto: TradeCurrencyDto) {
    if (dto.fromCurrency === dto.toCurrency) {
      throw new BadRequestException('Source and target currencies must differ');
    }

    this.validateCurrency(dto.fromCurrency);
    this.validateCurrency(dto.toCurrency);

    const reference = dto.reference || uuidv4();

    const existing = await this.txRepo.findOne({ where: { reference } });
    if (existing) {
      return { message: 'Duplicate request. Transaction already processed.', transaction: existing };
    }

    const rate = await this.fxService.getRate(dto.fromCurrency, dto.toCurrency);
    const toAmount = parseFloat((dto.amount * rate).toFixed(8));

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let transaction: Transaction | undefined;

    try {
      transaction = queryRunner.manager.create(Transaction, {
        user: { id: userId },
        type: TransactionType.TRADE,
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        fromAmount: dto.amount.toString(),
        toAmount: toAmount.toString(),
        rate: rate.toString(),
        status: TransactionStatus.PENDING,
        reference,
      });
      await queryRunner.manager.save(transaction);

      const fromBalance = await queryRunner.manager
        .getRepository(WalletBalance)
        .createQueryBuilder('wb')
        .setLock('pessimistic_write')
        .where('wb.user_id = :userId AND wb.currency = :currency', {
          userId,
          currency: dto.fromCurrency,
        })
        .getOne();

      if (!fromBalance || parseFloat(fromBalance.balance) < dto.amount) {
        throw new BadRequestException(
          `Insufficient ${dto.fromCurrency} balance. Available: ${parseFloat(fromBalance?.balance || '0').toFixed(2)}`,
        );
      }

      let toBalance = await queryRunner.manager
        .getRepository(WalletBalance)
        .createQueryBuilder('wb')
        .setLock('pessimistic_write')
        .where('wb.user_id = :userId AND wb.currency = :currency', {
          userId,
          currency: dto.toCurrency,
        })
        .getOne();

      const newFromBalance = parseFloat(fromBalance.balance) - dto.amount;
      await queryRunner.manager
        .getRepository(WalletBalance)
        .update(fromBalance.id, { balance: newFromBalance.toFixed(8) });

      if (!toBalance) {
        toBalance = queryRunner.manager.create(WalletBalance, {
          user: { id: userId },
          currency: dto.toCurrency,
          balance: toAmount.toFixed(8),
        });
        await queryRunner.manager.save(toBalance);
      } else {
        const newToBalance = parseFloat(toBalance.balance) + toAmount;
        await queryRunner.manager
          .getRepository(WalletBalance)
          .update(toBalance.id, { balance: newToBalance.toFixed(8) });
      }

      await queryRunner.manager
        .getRepository(Transaction)
        .update(transaction.id, { status: TransactionStatus.COMPLETED });

      await queryRunner.commitTransaction();

      return {
        message: 'Trade executed successfully',
        reference,
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        fromAmount: dto.amount,
        toAmount,
        rate,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (transaction?.id) {
        await this.txRepo.update(transaction.id, { status: TransactionStatus.FAILED });
      }
      if (err instanceof BadRequestException) throw err;
      this.logger.error('Trade failed', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private validateCurrency(currency: string): void {
    const supported = this.fxService.getSupportedCurrencies();
    if (!supported.includes(currency.toUpperCase())) {
      throw new BadRequestException(
        `Unsupported currency: ${currency}. Supported: ${supported.join(', ')}`,
      );
    }
  }
}
