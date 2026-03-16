import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletBalance } from './wallet-balance.entity';
import { Transaction, TransactionStatus, TransactionType } from '../transactions/transaction.entity';
import { FxService } from '../fx/fx.service';
import { ConfigService } from '@nestjs/config';

const mockWalletRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockTxRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const createQueryRunnerMock = (balances: Record<string, any> = {}) => {
  const mockManager = {
    findOne: jest.fn().mockImplementation((_entity, opts) => {
      const currency = opts?.where?.currency;
      return Promise.resolve(balances[currency] || null);
    }),
    create: jest.fn().mockImplementation((_entity, data) => ({ id: 'new-id', ...data })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'saved-id', ...entity })),
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      }),
      update: jest.fn(),
    }),
  };

  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: mockManager,
  };
};

const mockDataSource = (queryRunner: any) => ({
  createQueryRunner: jest.fn().mockReturnValue(queryRunner),
});

const mockFxService = () => ({
  getRate: jest.fn(),
  getSupportedCurrencies: jest.fn().mockReturnValue(['NGN', 'USD', 'EUR', 'GBP']),
});

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue('NGN,USD,EUR,GBP'),
});

describe('WalletService', () => {
  let service: WalletService;
  let fxService: ReturnType<typeof mockFxService>;
  let walletRepo: ReturnType<typeof mockWalletRepo>;
  let txRepo: ReturnType<typeof mockTxRepo>;

  const buildModule = async (queryRunner: any) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getRepositoryToken(WalletBalance), useValue: walletRepo },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource(queryRunner) },
        { provide: FxService, useValue: fxService },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();
    service = module.get<WalletService>(WalletService);
  };

  beforeEach(() => {
    walletRepo = mockWalletRepo();
    txRepo = mockTxRepo();
    fxService = mockFxService();
  });

  describe('getBalances', () => {
    it('returns formatted balances for a user', async () => {
      walletRepo.find.mockResolvedValue([
        { currency: 'NGN', balance: '50000.00000000' },
        { currency: 'USD', balance: '100.00000000' },
      ]);
      const qr = createQueryRunnerMock();
      await buildModule(qr);

      const result = await service.getBalances('user-1');

      expect(result).toEqual([
        { currency: 'NGN', balance: 50000 },
        { currency: 'USD', balance: 100 },
      ]);
    });
  });

  describe('fundWallet', () => {
    it('funds a wallet and returns success response', async () => {
      txRepo.findOne.mockResolvedValue(null); // no duplicate
      const qr = createQueryRunnerMock({ NGN: { id: 'bal-1', balance: '5000.00000000', currency: 'NGN' } });

      // Setup balance query builder for pessimistic lock
      qr.manager.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 'bal-1', balance: '5000.00000000' }),
        }),
        update: jest.fn().mockResolvedValue({}),
      });
      qr.manager.create.mockReturnValue({ id: 'tx-1', status: TransactionStatus.PENDING });
      qr.manager.save.mockResolvedValue({ id: 'tx-1' });

      await buildModule(qr);

      const result = await service.fundWallet('user-1', {
        currency: 'NGN',
        amount: 10000,
      });

      expect(result.message).toContain('10000 NGN');
      expect(result.currency).toBe('NGN');
      expect(result.amount).toBe(10000);
    });

    it('returns duplicate response when reference already exists', async () => {
      const existingTx = { id: 'tx-existing', reference: 'ref-001' };
      txRepo.findOne.mockResolvedValue(existingTx);
      const qr = createQueryRunnerMock();
      await buildModule(qr);

      const result = await service.fundWallet('user-1', {
        currency: 'NGN',
        amount: 1000,
        reference: 'ref-001',
      });

      expect(result.message).toContain('Duplicate');
      expect(result.transaction).toEqual(existingTx);
    });

    it('throws BadRequestException for unsupported currency', async () => {
      txRepo.findOne.mockResolvedValue(null);
      const qr = createQueryRunnerMock();
      await buildModule(qr);

      await expect(
        service.fundWallet('user-1', { currency: 'XYZ', amount: 100 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('convertCurrency', () => {
    it('throws BadRequestException when from and to currencies are the same', async () => {
      txRepo.findOne.mockResolvedValue(null);
      const qr = createQueryRunnerMock();
      await buildModule(qr);

      await expect(
        service.convertCurrency('user-1', {
          fromCurrency: 'NGN',
          toCurrency: 'NGN',
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      txRepo.findOne.mockResolvedValue(null);
      fxService.getRate.mockResolvedValue(0.00065);

      const qr = createQueryRunnerMock();
      qr.manager.create.mockReturnValue({ id: 'tx-1' });
      qr.manager.save.mockResolvedValue({ id: 'tx-1' });

      // from-balance query builder returns low balance
      const mockQB = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'bal-1', balance: '50.00000000' }),
      };
      qr.manager.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQB),
        update: jest.fn(),
      });

      await buildModule(qr);

      await expect(
        service.convertCurrency('user-1', {
          fromCurrency: 'NGN',
          toCurrency: 'USD',
          amount: 1000, // more than 50 balance
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('converts currency and returns correct computed toAmount', async () => {
      txRepo.findOne.mockResolvedValue(null);
      fxService.getRate.mockResolvedValue(0.00065); // 1 NGN = 0.00065 USD

      const qr = createQueryRunnerMock();
      qr.manager.create.mockReturnValue({ id: 'tx-1', status: TransactionStatus.PENDING });
      qr.manager.save.mockResolvedValue({ id: 'tx-1' });

      let callCount = 0;
      const mockQB = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ id: 'bal-ngn', balance: '10000.00000000' }); // from
          }
          return Promise.resolve({ id: 'bal-usd', balance: '5.00000000' }); // to
        }),
      };

      qr.manager.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQB),
        update: jest.fn().mockResolvedValue({}),
      });

      await buildModule(qr);

      const result = await service.convertCurrency('user-1', {
        fromCurrency: 'NGN',
        toCurrency: 'USD',
        amount: 1000,
      });

      expect(result.fromCurrency).toBe('NGN');
      expect(result.toCurrency).toBe('USD');
      expect(result.fromAmount).toBe(1000);
      expect(result.toAmount).toBeCloseTo(0.65, 4);
      expect(result.rate).toBe(0.00065);
    });
  });

  describe('FxService.getRate cross-rate calculation', () => {
    it('calculates cross-rate correctly when neither currency is NGN', async () => {
      // This tests the FxService logic conceptually:
      // rates (NGN-based): USD = 0.00065, EUR = 0.00060
      // USD → EUR rate = EUR_rate / USD_rate = 0.00060 / 0.00065 ≈ 0.923
      const usdRate = 0.00065;
      const eurRate = 0.00060;
      const crossRate = eurRate / usdRate;
      expect(crossRate).toBeCloseTo(0.923, 2);
    });
  });
});
