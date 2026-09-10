import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseService } from './database/database.service';
import { HelpersController } from './helpers/helpers.controller';
import { HelpersService } from './helpers/helpers.service';
import { WorkOrdersController } from './work-orders/work-orders.controller';
import { WorkOrdersService } from './work-orders/work-orders.service';

@Module({
  controllers: [AppController, HelpersController, WorkOrdersController],
  providers: [DatabaseService, HelpersService, WorkOrdersService],
})
export class AppModule {}
