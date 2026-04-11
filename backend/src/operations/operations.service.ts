import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operation } from './operation.entity';

export type CreateOperationInput = {
  bodyNumber: string;
  mtopDocumentUrl: string;
  ltoDocumentUrl: string;
  mtopExpirationDate: string;
  ltoExpirationDate: string;
};

export type UpdateOperationInput = Partial<CreateOperationInput>;

@Injectable()
export class OperationsService {
  constructor(
    @InjectRepository(Operation)
    private readonly operationsRepository: Repository<Operation>,
  ) {}

  findAll(): Promise<Operation[]> {
    return this.operationsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Operation> {
    const operation = await this.operationsRepository.findOne({ where: { id } });
    if (!operation) {
      throw new NotFoundException(`Operation ${id} not found`);
    }
    return operation;
  }

  create(data: CreateOperationInput): Promise<Operation> {
    const entity = this.operationsRepository.create(data);
    return this.operationsRepository.save(entity);
  }

  async update(id: string, data: UpdateOperationInput): Promise<Operation> {
    const operation = await this.findOne(id);

    if (
      data.mtopDocumentUrl !== undefined &&
      data.mtopDocumentUrl &&
      operation.mtopDocumentUrl &&
      data.mtopDocumentUrl !== operation.mtopDocumentUrl
    ) {
      operation.mtopDocumentHistory = [
        {
          url: operation.mtopDocumentUrl,
          replacedAt: new Date().toISOString(),
        },
        ...(operation.mtopDocumentHistory ?? []),
      ];
    }

    if (
      data.ltoDocumentUrl !== undefined &&
      data.ltoDocumentUrl &&
      operation.ltoDocumentUrl &&
      data.ltoDocumentUrl !== operation.ltoDocumentUrl
    ) {
      operation.ltoDocumentHistory = [
        {
          url: operation.ltoDocumentUrl,
          replacedAt: new Date().toISOString(),
        },
        ...(operation.ltoDocumentHistory ?? []),
      ];
    }

    if (data.bodyNumber !== undefined) {
      operation.bodyNumber = data.bodyNumber;
    }
    if (data.mtopDocumentUrl !== undefined) {
      operation.mtopDocumentUrl = data.mtopDocumentUrl;
    }
    if (data.ltoDocumentUrl !== undefined) {
      operation.ltoDocumentUrl = data.ltoDocumentUrl;
    }
    if (data.mtopExpirationDate !== undefined) {
      operation.mtopExpirationDate = data.mtopExpirationDate;
    }
    if (data.ltoExpirationDate !== undefined) {
      operation.ltoExpirationDate = data.ltoExpirationDate;
    }

    return this.operationsRepository.save(operation);
  }

  async remove(id: string): Promise<void> {
    const result = await this.operationsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Operation ${id} not found`);
    }
  }
}
