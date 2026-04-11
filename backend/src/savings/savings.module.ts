import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavingsRecord } from './savings-record.entity';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavingsRecord])],
  controllers: [SavingsController],
  providers: [SavingsService],
})
export class SavingsModule {}
