import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type LoanScheduleRow = {
  dueDate: string;
  interest: number;
  principal: number;
  total: number;
  balance: number;
  processingFee: number;
  payment: number;
};

export type LoanPaymentRecord = {
  dueDate: string;
  amount: number;
};

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  memberId: string;

  @Column({ type: 'varchar', length: 120 })
  bodyNumber: string;

  @Column({ type: 'varchar', length: 180 })
  memberName: string;

  @Column({ type: 'varchar', length: 30, default: 'regular' })
  loanType: string;

  @Column({ type: 'double' })
  amountOfLoan: number;

  @Column({ type: 'int' })
  termValue: number;

  @Column({ type: 'varchar', length: 10 })
  termUnit: string;

  @Column({ type: 'double' })
  processingFeeRate: number;

  @Column({ type: 'double' })
  interestRate: number;

  @Column({ type: 'double' })
  insuranceAmount: number;

  @Column({ type: 'double' })
  capitalBuildUpAmount: number;

  @Column({ type: 'double' })
  amountRelease: number;

  @Column({ type: 'varchar', length: 10 })
  dateReleased: string;

  @Column({ type: 'varchar', length: 10 })
  maturityDate: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'json' })
  schedule: LoanScheduleRow[];

  /** Due dates (YYYY-MM-DD) matching schedule rows that have been paid. */
  @Column({ type: 'json', nullable: true })
  paidDueDates: string[] | null;

  /** Actual payments made per due date (may differ from scheduled amounts). */
  @Column({ type: 'json', nullable: true })
  payments: LoanPaymentRecord[] | null;

  /** Emergency loan: full principal + interest paid; no further amounts due. */
  @Column({ type: 'boolean', default: false })
  emergencySettled: boolean;

  /** YYYY-MM-DD when emergency loan was marked paid (set by API on settlement). */
  @Column({ type: 'varchar', length: 10, nullable: true })
  emergencyPaidOn: string | null;

  /** Amount recorded when the emergency loan was marked paid. */
  @Column({ type: 'double', nullable: true })
  emergencyAmountPaid: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
