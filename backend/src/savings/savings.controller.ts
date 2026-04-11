import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import type { CreateSavingsRecordInput } from './savings.service';
import { SavingsService } from './savings.service';

@Controller('savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Get()
  findAll() {
    return this.savingsService.findAll();
  }

  @Post()
  create(@Body() body: CreateSavingsRecordInput) {
    return this.savingsService.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.savingsService.remove(id);
  }
}
