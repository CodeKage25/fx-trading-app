import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum TransactionType {
  FUNDING = 'FUNDING',
  CONVERSION = 'CONVERSION',
  TRADE = 'TRADE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ name: 'from_currency', length: 3 })
  fromCurrency: string;

  @Column({ name: 'to_currency', length: 3, nullable: true })
  toCurrency: string | null;

  @Column({ name: 'from_amount', type: 'decimal', precision: 20, scale: 8 })
  fromAmount: string;

  @Column({
    name: 'to_amount',
    type: 'decimal',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  toAmount: string | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  rate: string | null;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ unique: true })
  reference: string;

  @Column({ nullable: true, type: 'text' })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
