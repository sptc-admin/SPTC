import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { capitalizeWords } from '../common/text-case.util';
import { Arkilahan, ArkilahanTermUnit } from './arkilahan.entity';

export type CreateArkilahanInput = {
  date: string;
  bodyNumber: string;
  name: string;
  fee: number;
  dueDate: string;
  termValue: number;
  termUnit: ArkilahanTermUnit;
  documentUrl?: string;
};

export type UpdateArkilahanInput = Partial<CreateArkilahanInput>;

@Injectable()
export class ArkilahanService {
  constructor(
    @InjectRepository(Arkilahan)
    private readonly arkilahanRepository: Repository<Arkilahan>,
  ) {}

  findAll(): Promise<Arkilahan[]> {
    return this.arkilahanRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Arkilahan> {
    const arkilahan = await this.arkilahanRepository.findOne({ where: { id } });
    if (!arkilahan) {
      throw new NotFoundException(`Arkilahan ${id} not found`);
    }
    return arkilahan;
  }

  create(data: CreateArkilahanInput): Promise<Arkilahan> {
    const entity = this.arkilahanRepository.create({
      ...data,
      name: capitalizeWords(data.name),
    });
    return this.arkilahanRepository.save(entity);
  }

  async update(id: string, data: UpdateArkilahanInput): Promise<Arkilahan> {
    const arkilahan = await this.findOne(id);
    const next: UpdateArkilahanInput = { ...data };
    if (data.name !== undefined) {
      next.name = capitalizeWords(data.name);
    }
    Object.assign(arkilahan, next);
    return this.arkilahanRepository.save(arkilahan);
  }

  async remove(id: string): Promise<void> {
    const result = await this.arkilahanRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Arkilahan ${id} not found`);
    }
  }
}
