import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type {
  CreateArkilahanInput,
  UpdateArkilahanInput,
} from './arkilahan.service';
import { ArkilahanService } from './arkilahan.service';

@Controller('arkilahan')
export class ArkilahanController {
  constructor(private readonly arkilahanService: ArkilahanService) {}

  @Get()
  findAll() {
    return this.arkilahanService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.arkilahanService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateArkilahanInput) {
    return this.arkilahanService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateArkilahanInput) {
    return this.arkilahanService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.arkilahanService.remove(id);
  }
}
