import { strict as assert } from 'node:assert';
import { Client } from 'pg';
import { databaseConfig } from '../src/database/database.config';

const orderHelperNames = [
  'Павлов',
  'Мендин',
  'Кратков',
  'Сазонов',
  'Лебедев',
  'Обвинцев',
  'Рогоза',
  'Некрасов',
  'Баурик',
  'Цуфарь',
  'Ильяшев',
  'Коркин Е.',
];

const ledgerHelperNames = [
  'Протасов',
  'Коркин И.',
  'Колупин',
  'Громов',
  'Родион',
  'Тышин',
];

const helperNames = [...orderHelperNames, ...ledgerHelperNames];

async function seed() {
  const client = new Client(databaseConfig());
  try {
    await client.connect();
    await client.query('BEGIN');

    for (const fullName of helperNames) {
      await client.query(
        `INSERT INTO helpers (full_name, comment)
         VALUES ($1, $2)
         ON CONFLICT (full_name) DO UPDATE SET is_active = true`,
        [fullName, 'Перенесено с рукописного образца; проверить написание ФИО и добавить телефон'],
      );
    }

    const order = await client.query<{ id: string }>(
      `INSERT INTO work_orders (
         number, starts_on, ends_on, venue, filled_by_name, transport, status, comment
       ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
       ON CONFLICT (number) DO UPDATE SET
         starts_on = EXCLUDED.starts_on,
         ends_on = EXCLUDED.ends_on,
         venue = EXCLUDED.venue,
         filled_by_name = EXCLUDED.filled_by_name,
         transport = EXCLUDED.transport,
         updated_at = now()
       RETURNING id`,
      [
        '319',
        '2026-08-03',
        '2026-09-03',
        'Дворец Дзюдо',
        'Павлов',
        'Гиоргским (проверить по оригиналу)',
        'Создано по фотографии заказ-наряда. Денежные значения оставлены пустыми.',
      ],
    );

    for (const fullName of orderHelperNames) {
      await client.query(
        `INSERT INTO work_order_helpers (work_order_id, helper_id, comment)
         SELECT $1, id, $2 FROM helpers WHERE full_name = $3
         ON CONFLICT (work_order_id, helper_id) DO NOTHING`,
        [order.rows[0].id, 'Виды работ и суммы требуют проверки по оригиналу', fullName],
      );
    }

    const result = await client.query<{ helper_count: string; participant_count: string }>(
      `SELECT
         (SELECT count(*) FROM helpers WHERE full_name = ANY($1::text[])) AS helper_count,
         (SELECT count(*) FROM work_order_helpers WHERE work_order_id = $2) AS participant_count`,
      [helperNames, order.rows[0].id],
    );
    assert.equal(Number(result.rows[0].helper_count), helperNames.length);
    assert.equal(Number(result.rows[0].participant_count), orderHelperNames.length);

    await client.query('COMMIT');
    console.log(`Sample ready: ${helperNames.length} helpers, work order №319 with ${orderHelperNames.length} participants`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

void seed().catch(error => {
  console.error('Sample seed failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
