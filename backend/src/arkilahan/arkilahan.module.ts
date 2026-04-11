import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArkilahanController } from './arkilahan.controller';
import { Arkilahan } from './arkilahan.entity';
import { ArkilahanService } from './arkilahan.service';

@Module({
  imports: [TypeOrmModule.forFeature([Arkilahan])],
  controllers: [ArkilahanController],
  providers: [ArkilahanService],
  exports: [ArkilahanService],
})
export class ArkilahanModule {}
