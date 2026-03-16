import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { WalletBalance } from '../wallet/wallet-balance.entity';
import { Transaction } from '../transactions/transaction.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'otp_code', nullable: true, length: 6 })
  otpCode: string | null;

  @Column({ name: 'otp_expires_at', nullable: true, type: 'timestamptz' })
  otpExpiresAt: Date | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @OneToMany(() => WalletBalance, (balance) => balance.user)
  walletBalances: WalletBalance[];

  @OneToMany(() => Transaction, (tx) => tx.user)
  transactions: Transaction[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
