import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ArkilahanTermUnit = 'months' | 'years';

@Entity('arkilahan')
export class Arkilahan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'varchar', length: 120 })
  bodyNumber: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'double' })
  fee: number;

  @Column({ type: 'varchar', length: 10 })
  dueDate: string;

  @Column({ type: 'int' })
  termValue: number;

  @Column({ type: 'varchar', length: 10 })
  termUnit: ArkilahanTermUnit;

  @Column({ type: 'text', nullable: true })
  documentUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
