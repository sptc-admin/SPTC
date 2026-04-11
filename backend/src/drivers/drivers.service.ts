import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { capitalizeFullName } from '../common/text-case.util';
import { Driver } from './driver.entity';

export type CreateDriverInput = {
  bodyNumber: string;
  fullName: Driver['fullName'];
  birthday: string;
  address: Driver['address'];
  contactMobile10: string;
  tinDigits: string;
  profileImageSrc: string;
};

export type UpdateDriverInput = Partial<CreateDriverInput>;

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
  ) {}

  findAll(): Promise<Driver[]> {
    return this.driversRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Driver> {
    const driver = await this.driversRepository.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
    return driver;
  }

  create(data: CreateDriverInput): Promise<Driver> {
    const entity = this.driversRepository.create({
      ...data,
      fullName: capitalizeFullName(data.fullName),
    });
    return this.driversRepository.save(entity);
  }

  async update(id: string, data: UpdateDriverInput): Promise<Driver> {
    const driver = await this.findOne(id);
    const next: UpdateDriverInput = { ...data };
    if (data.fullName !== undefined) {
      next.fullName = capitalizeFullName(data.fullName);
    }
    Object.assign(driver, next);
    return this.driversRepository.save(driver);
  }

  async remove(id: string): Promise<void> {
    const result = await this.driversRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
  }
}
