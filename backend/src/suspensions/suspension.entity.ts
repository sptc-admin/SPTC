import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SuspensionStatus = 'active' | 'cleared';

@Entity('suspensions')
export class Suspension {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  driverId: string;

  @Column({ type: 'varchar', length: 120 })
  bodyNumber: string;

  @Column({ type: 'varchar', length: 220 })
  driverName: string;

  @Column({ type: 'varchar', length: 10 })
  startDate: string;

  @Column({ type: 'varchar', length: 10 })
  endDate: string;

  @Column({ type: 'varchar', length: 10 })
  status: SuspensionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
