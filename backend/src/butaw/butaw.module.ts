import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ButawRecord } from './butaw-record.entity';
import { ButawController } from './butaw.controller';
import { ButawService } from './butaw.service';

@Module({
  imports: [TypeOrmModule.forFeature([ButawRecord])],
  controllers: [ButawController],
  providers: [ButawService],
})
export class ButawModule {}
