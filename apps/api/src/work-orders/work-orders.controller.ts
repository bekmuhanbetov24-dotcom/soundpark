import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { CreateWorkOrderDto, UpdateWorkOrderDto, UpsertParticipantDto } from './work-orders.dto';
import { WorkOrdersService } from './work-orders.service';

@Controller()
export class WorkOrdersController {
  constructor(private readonly orders: WorkOrdersService) {}

  @Get('work-orders')
  findAll() { return this.orders.findAll(); }

  @Get('work-orders/:id')
  findOne(@Param('id') id: string) { return this.orders.findOne(id); }

  @Post('work-orders')
  create(@Body() dto: CreateWorkOrderDto) { return this.orders.create(dto); }

  @Patch('work-orders/:id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkOrderDto) { return this.orders.update(id, dto); }

  @Delete('work-orders/:id')
  remove(@Param('id') id: string) { return this.orders.remove(id); }

  @Put('work-orders/:id/participant')
  upsertParticipant(@Param('id') id: string, @Body() dto: UpsertParticipantDto) {
    return this.orders.upsertParticipant(id, dto);
  }

  @Delete('work-orders/:id/participant/:helperId')
  removeParticipant(@Param('id') id: string, @Param('helperId') helperId: string) {
    return this.orders.removeParticipant(id, helperId);
  }

  @Get('calculations')
  calculations() { return this.orders.calculations(); }
}
