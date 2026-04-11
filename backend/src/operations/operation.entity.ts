import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type OperationDocumentHistoryEntry = {
  url: string;
  replacedAt: string;
};

@Entity('operations')
export class Operation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  bodyNumber: string;

  @Column({ type: 'text' })
  mtopDocumentUrl: string;

  @Column({ type: 'text' })
  ltoDocumentUrl: string;

  @Column({ type: 'varchar', length: 10 })
  mtopExpirationDate: string;

  @Column({ type: 'varchar', length: 10 })
  ltoExpirationDate: string;

  @Column({ type: 'json', nullable: true })
  mtopDocumentHistory: OperationDocumentHistoryEntry[] | null;

  @Column({ type: 'json', nullable: true })
  ltoDocumentHistory: OperationDocumentHistoryEntry[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
