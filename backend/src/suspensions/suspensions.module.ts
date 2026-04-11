import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Suspension } from './suspension.entity';
import { SuspensionsController } from './suspensions.controller';
import { SuspensionsService } from './suspensions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Suspension])],
  controllers: [SuspensionsController],
  providers: [SuspensionsService],
  exports: [SuspensionsService],
})
export class SuspensionsModule {}
