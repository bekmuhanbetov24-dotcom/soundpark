import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateHelperDto, UpdateHelperDto } from './helpers.dto';
import { HelpersService } from './helpers.service';

@Controller('helpers')
export class HelpersController {
  constructor(private readonly helpers: HelpersService) {}

  @Get()
  findAll() { return this.helpers.findAll(); }

  @Post()
  create(@Body() dto: CreateHelperDto) { return this.helpers.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHelperDto) { return this.helpers.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.helpers.remove(id); }
}
