import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { CreateLoanInput, UpdateLoanInput } from './loans.service';
import { LoansService } from './loans.service';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  findAll() {
    return this.loansService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loansService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateLoanInput) {
    return this.loansService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateLoanInput) {
    return this.loansService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loansService.remove(id);
  }
}
