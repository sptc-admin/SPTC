import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { capitalizeWords } from '../common/text-case.util';
import { Suspension, SuspensionStatus } from './suspension.entity';

export type CreateSuspensionInput = {
  driverId: string;
  bodyNumber: string;
  driverName: string;
  startDate: string;
  endDate: string;
  status: SuspensionStatus;
};

export type UpdateSuspensionInput = Partial<CreateSuspensionInput>;

@Injectable()
export class SuspensionsService {
  constructor(
    @InjectRepository(Suspension)
    private readonly suspensionsRepository: Repository<Suspension>,
  ) {}

  findAll(): Promise<Suspension[]> {
    return this.suspensionsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Suspension> {
    const suspension = await this.suspensionsRepository.findOne({ where: { id } });
    if (!suspension) {
      throw new NotFoundException(`Suspension ${id} not found`);
    }
    return suspension;
  }

  create(data: CreateSuspensionInput): Promise<Suspension> {
    const entity = this.suspensionsRepository.create({
      ...data,
      driverName: capitalizeWords(data.driverName),
    });
    return this.suspensionsRepository.save(entity);
  }

  async update(id: string, data: UpdateSuspensionInput): Promise<Suspension> {
    const suspension = await this.findOne(id);
    const next: UpdateSuspensionInput = { ...data };
    if (data.driverName !== undefined) {
      next.driverName = capitalizeWords(data.driverName);
    }
    Object.assign(suspension, next);
    return this.suspensionsRepository.save(suspension);
  }

  async remove(id: string): Promise<void> {
    const result = await this.suspensionsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Suspension ${id} not found`);
    }
  }
}
