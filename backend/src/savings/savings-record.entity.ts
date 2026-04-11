import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('savings_records')
export class SavingsRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  memberId: string;

  @Column({ type: 'varchar', length: 120 })
  bodyNumber: string;

  @Column({ type: 'varchar', length: 180 })
  memberName: string;

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'double' })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
