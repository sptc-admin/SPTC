import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export type CreateAuditLogInput = {
  module: string;
  action: 'create' | 'update' | 'delete' | 'export' | 'import';
  message: string;
  actorName: string;
  actorRole: string;
  method: string;
  path: string;
};

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  create(input: CreateAuditLogInput): Promise<AuditLog> {
    const row = this.auditLogRepository.create(input);
    return this.auditLogRepository.save(row);
  }

  findAll(module?: string): Promise<AuditLog[]> {
    if (!module || module === 'all') {
      return this.auditLogRepository.find({ order: { createdAt: 'DESC' } });
    }
    return this.auditLogRepository.find({
      where: { module },
      order: { createdAt: 'DESC' },
    });
  }
}
