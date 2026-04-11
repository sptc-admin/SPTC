import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('butaw_records')
export class ButawRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  memberId: string;

  @Column({ type: 'varchar', length: 120 })
  bodyNumber: string;

  @Column({ type: 'varchar', length: 180 })
  memberName: string;

  /** First covered month YYYY-MM */
  @Column({ type: 'varchar', length: 7 })
  month: string;

  /** Last covered month YYYY-MM (null on legacy rows = single `month`) */
  @Column({ type: 'varchar', length: 7, nullable: true })
  monthEnd: string | null;

  @Column({ type: 'double' })
  amount: number;

  /** True when recorded via advance payment flow (split rule is the same). */
  @Column({ type: 'boolean', default: false })
  isAdvance: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
