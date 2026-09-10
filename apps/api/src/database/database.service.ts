import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { databaseConfig } from './database.config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly pool = new Pool(databaseConfig());
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    this.pool.on('error', () => this.logger.error('Unexpected idle database connection error'));
  }

  async onModuleInit() {
    await this.check();
  }

  async check() {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
