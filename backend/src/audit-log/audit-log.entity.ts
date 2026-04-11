import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60 })
  module: string;

  @Column({ type: 'varchar', length: 20 })
  action: 'create' | 'update' | 'delete' | 'export' | 'import';

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 200 })
  actorName: string;

  @Column({ type: 'varchar', length: 40 })
  actorRole: string;

  @Column({ type: 'varchar', length: 16 })
  method: string;

  @Column({ type: 'text' })
  path: string;

  @CreateDateColumn()
  createdAt: Date;
}
