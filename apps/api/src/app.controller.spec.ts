import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseService } from './database/database.service';

describe('Database health', () => {
  const check = jest.fn();
  const controller = new AppController({ check } as unknown as DatabaseService);
  it('reports a successful database query', async () => {
    check.mockResolvedValueOnce(undefined);
    await expect(controller.health()).resolves.toEqual({ status: 'ok', database: 'up' });
  });
  it('returns 503 without exposing database errors', async () => {
    check.mockRejectedValueOnce(new Error('private connection details'));
    try {
      await controller.health();
      throw new Error('Expected health to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getStatus()).toBe(503);
      expect((error as ServiceUnavailableException).getResponse()).toEqual({ status: 'error', database: 'down' });
    }
  });
});
