import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transaction.entity';

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
    type?: string,
  ): Promise<PaginatedTransactions> {
    const query = this.txRepo
      .createQueryBuilder('tx')
      .where('tx.user_id = :userId', { userId })
      .orderBy('tx.created_at', 'DESC');

    if (type) {
      query.andWhere('tx.type = :type', { type: type.toUpperCase() });
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
