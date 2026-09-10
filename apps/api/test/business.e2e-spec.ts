import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('Business API with PostgreSQL', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let url: string;
  let helperId: string | undefined;
  let orderId: string | undefined;
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    database = app.get(DatabaseService);
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (orderId) await database.pool.query('DELETE FROM work_orders WHERE id = $1', [orderId]);
    if (helperId) await database.pool.query('DELETE FROM helpers WHERE id = $1', [helperId]);
    await app?.close();
  });

  it('creates and edits a helper', async () => {
    const created = await fetch(`${url}/helpers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: `Тестовый Хелпер ${suffix}`, phone: '+7 700 000 00 00' }),
    });
    expect(created.status).toBe(201);
    helperId = (await created.json() as { id: string }).id;

    const updated = await fetch(`${url}/helpers/${helperId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'Проверено автоматически' }),
    });
    expect(updated.status).toBe(200);
    expect((await updated.json() as { comment: string }).comment).toBe('Проверено автоматически');
  });

  it('creates an order and calculates participant work', async () => {
    const created = await fetch(`${url}/work-orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: `TEST-${suffix}`, startsOn: '2026-09-10', endsOn: '2026-09-12', filledByName: 'Администратор' }),
    });
    expect(created.status).toBe(201);
    orderId = (await created.json() as { id: string }).id;

    const participant = await fetch(`${url}/work-orders/${orderId}/participant`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helperId, loading: true, loadingAmount: 1000, unloading: false, installation: true, installationAmount: 2000, dismantling: false, flatRate: false }),
    });
    expect(participant.status).toBe(200);
    const details = await participant.json() as { participants: { helperId: string; totalAmount: string }[] };
    expect(details.participants.find(item => item.helperId === helperId)?.totalAmount).toBe('3000.00');

    const calculations = await fetch(`${url}/calculations`);
    const rows = await calculations.json() as { id: string; totalAmount: string; orders: { orderId: string; loadingAmount: string; installationAmount: string }[] }[];
    const helperCalculation = rows.find(item => item.id === helperId);
    expect(helperCalculation?.totalAmount).toBe('3000.00');
    expect(helperCalculation?.orders).toEqual(expect.arrayContaining([
      expect.objectContaining({ orderId, loadingAmount: '1000.00', installationAmount: '2000.00' }),
    ]));

    const removed = await fetch(`${url}/work-orders/${orderId}/participant/${helperId}`, { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect((await removed.json() as { participants: unknown[] }).participants).toHaveLength(0);
  });
});
