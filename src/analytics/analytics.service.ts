import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus } from '../transactions/transaction.entity';
import { FxRateSnapshot } from './fx-rate-snapshot.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(FxRateSnapshot)
    private readonly snapshotRepo: Repository<FxRateSnapshot>,
  ) {}

  async getTradeStats() {
    const [byType, byCurrency, dailyCounts] = await Promise.all([
      // Count + volume by transaction type (completed only)
      this.txRepo
        .createQueryBuilder('t')
        .select('t.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(CAST(t.from_amount AS DECIMAL))', 'totalVolume')
        .where('t.status = :status', { status: TransactionStatus.COMPLETED })
        .groupBy('t.type')
        .getRawMany(),

      // Volume by fromCurrency (completed only)
      this.txRepo
        .createQueryBuilder('t')
        .select('t.from_currency', 'currency')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(CAST(t.from_amount AS DECIMAL))', 'totalVolume')
        .where('t.status = :status', { status: TransactionStatus.COMPLETED })
        .groupBy('t.from_currency')
        .getRawMany(),

      // Daily transaction counts for last 30 days
      this.txRepo
        .createQueryBuilder('t')
        .select("DATE(t.created_at)", 'date')
        .addSelect('COUNT(*)', 'count')
        .where("t.created_at >= NOW() - INTERVAL '30 days'")
        .groupBy("DATE(t.created_at)")
        .orderBy("DATE(t.created_at)", 'ASC')
        .getRawMany(),
    ]);

    return { byType, byCurrency, dailyCounts };
  }

  async getFxTrends(currency: string, days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.currency', 'currency')
      .addSelect('s.rate', 'rate')
      .addSelect('s.fetched_at', 'fetchedAt')
      .where('s.currency = :currency', { currency: currency.toUpperCase() })
      .andWhere('s.fetched_at >= :since', { since })
      .orderBy('s.fetched_at', 'ASC')
      .getRawMany();
  }

  async getUserActivity(userId: string) {
    const [summary, recent] = await Promise.all([
      this.txRepo
        .createQueryBuilder('t')
        .select('t.type', 'type')
        .addSelect('t.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('t.user_id = :userId', { userId })
        .groupBy('t.type')
        .addGroupBy('t.status')
        .getRawMany(),

      this.txRepo.find({
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' },
        take: 10,
        select: ['id', 'type', 'status', 'fromCurrency', 'toCurrency', 'fromAmount', 'toAmount', 'rate', 'createdAt'],
      }),
    ]);

    return { summary, recentTransactions: recent };
  }
}
