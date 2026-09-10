import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('API with PostgreSQL', () => {
  let app: INestApplication;
  let url: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/health`;
  });
  afterAll(async () => { await app?.close(); });
  it('GET /health queries the real database', async () => {
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', database: 'up' });
  });
  it('GET /health returns 503 if the query fails', async () => {
    const spy = jest.spyOn(app.get(DatabaseService), 'check').mockRejectedValueOnce(new Error('unavailable'));
    try {
      const response = await fetch(url);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: 'error', database: 'down' });
    } finally { spy.mockRestore(); }
  });
});
