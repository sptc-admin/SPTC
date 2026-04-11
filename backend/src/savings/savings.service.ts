import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { capitalizeWords } from '../common/text-case.util';
import { SavingsRecord } from './savings-record.entity';

export type CreateSavingsRecordInput = Omit<
  SavingsRecord,
  'id' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class SavingsService {
  constructor(
    @InjectRepository(SavingsRecord)
    private readonly repo: Repository<SavingsRecord>,
  ) {}

  findAll(): Promise<SavingsRecord[]> {
    return this.repo.find({
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<SavingsRecord> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Savings record ${id} not found`);
    }
    return row;
  }

  create(data: CreateSavingsRecordInput): Promise<SavingsRecord> {
    return this.repo.save(
      this.repo.create({
        ...data,
        memberName: capitalizeWords(data.memberName),
      }),
    );
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Savings record ${id} not found`);
    }
  }
}
