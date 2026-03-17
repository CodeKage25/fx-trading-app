import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('fx_rate_snapshots')
@Index(['base', 'currency', 'fetchedAt'])
export class FxRateSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 3 })
  base: string;

  @Column({ length: 3 })
  currency: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  rate: string;

  @CreateDateColumn()
  fetchedAt: Date;
}
