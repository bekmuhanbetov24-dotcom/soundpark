import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseError } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CreateWorkOrderDto, UpdateWorkOrderDto, UpsertParticipantDto } from './work-orders.dto';

@Injectable()
export class WorkOrdersService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    const result = await this.database.pool.query(
      `SELECT wo.id, wo.number, to_char(wo.starts_on, 'YYYY-MM-DD') AS "startsOn",
              to_char(wo.ends_on, 'YYYY-MM-DD') AS "endsOn",
              wo.event_name AS "eventName", wo.venue, wo.filled_by_name AS "filledByName",
              wo.transport, wo.light_amount AS "lightAmount", wo.sound_amount AS "soundAmount",
              wo.structures_amount AS "structuresAmount", wo.total_amount AS "totalAmount",
              wo.status, wo.comment, count(woh.id)::int AS "participantCount",
              COALESCE(sum(woh.total_amount), 0) AS "payrollTotal"
       FROM work_orders wo
       LEFT JOIN work_order_helpers woh ON woh.work_order_id = wo.id
       GROUP BY wo.id ORDER BY wo.starts_on DESC, wo.number DESC`,
    );
    return result.rows;
  }

  async findOne(id: string) {
    const order = await this.database.pool.query(
      `SELECT id, number, to_char(starts_on, 'YYYY-MM-DD') AS "startsOn",
              to_char(ends_on, 'YYYY-MM-DD') AS "endsOn", event_name AS "eventName",
              venue, filled_by_name AS "filledByName", transport, light_amount AS "lightAmount",
              sound_amount AS "soundAmount", structures_amount AS "structuresAmount",
              total_amount AS "totalAmount", status, comment
       FROM work_orders WHERE id = $1`, [id],
    );
    if (!order.rowCount) throw new NotFoundException('Заказ-наряд не найден');
    const participants = await this.database.pool.query(
      `SELECT woh.id, h.id AS "helperId", h.full_name AS "fullName", woh.loading,
              woh.loading_amount AS "loadingAmount", woh.unloading, woh.unloading_amount AS "unloadingAmount",
              woh.installation, woh.installation_amount AS "installationAmount", woh.dismantling,
              woh.dismantling_amount AS "dismantlingAmount", woh.flat_rate AS "flatRate",
              woh.flat_rate_amount AS "flatRateAmount", woh.total_amount AS "totalAmount", woh.comment
       FROM work_order_helpers woh JOIN helpers h ON h.id = woh.helper_id
       WHERE woh.work_order_id = $1 ORDER BY h.full_name`, [id],
    );
    return { ...order.rows[0], participants: participants.rows };
  }

  async create(dto: CreateWorkOrderDto) {
    if (dto.endsOn < dto.startsOn) throw new BadRequestException('Дата окончания не может быть раньше даты начала');
    try {
      const result = await this.database.pool.query(
        `INSERT INTO work_orders (
           number, starts_on, ends_on, event_name, venue, filled_by_name, transport,
           light_amount, sound_amount, structures_amount, status, comment
         ) VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, NULLIF($7, ''), $8, $9, $10, $11, NULLIF($12, ''))
         RETURNING id`,
        [dto.number.trim(), dto.startsOn, dto.endsOn, dto.eventName?.trim() ?? '', dto.venue?.trim() ?? '',
          dto.filledByName.trim(), dto.transport?.trim() ?? '', dto.lightAmount ?? null, dto.soundAmount ?? null,
          dto.structuresAmount ?? null, dto.status ?? 'draft', dto.comment?.trim() ?? ''],
      );
      return this.findOne(result.rows[0].id);
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '23505') {
        throw new ConflictException('Заказ-наряд с таким номером уже существует');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateWorkOrderDto) {
    if (dto.endsOn < dto.startsOn) throw new BadRequestException('Дата окончания не может быть раньше даты начала');
    try {
      const result = await this.database.pool.query(
        `UPDATE work_orders SET number = $2, starts_on = $3, ends_on = $4,
           event_name = NULLIF($5, ''), venue = NULLIF($6, ''), filled_by_name = $7,
           transport = NULLIF($8, ''), light_amount = $9, sound_amount = $10,
           structures_amount = $11, status = $12, comment = NULLIF($13, ''), updated_at = now()
         WHERE id = $1 RETURNING id`,
        [id, dto.number.trim(), dto.startsOn, dto.endsOn, dto.eventName?.trim() ?? '', dto.venue?.trim() ?? '',
          dto.filledByName.trim(), dto.transport?.trim() ?? '', dto.lightAmount ?? null, dto.soundAmount ?? null,
          dto.structuresAmount ?? null, dto.status ?? 'draft', dto.comment?.trim() ?? ''],
      );
      if (!result.rowCount) throw new NotFoundException('Заказ-наряд не найден');
      return this.findOne(id);
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '23505') {
        throw new ConflictException('Заказ-наряд с таким номером уже существует');
      }
      throw error;
    }
  }

  async upsertParticipant(orderId: string, dto: UpsertParticipantDto) {
    await this.findOne(orderId);
    const values = [
      orderId, dto.helperId,
      dto.loading, dto.loading ? dto.loadingAmount ?? null : null,
      dto.unloading, dto.unloading ? dto.unloadingAmount ?? null : null,
      dto.installation, dto.installation ? dto.installationAmount ?? null : null,
      dto.dismantling, dto.dismantling ? dto.dismantlingAmount ?? null : null,
      dto.flatRate, dto.flatRate ? dto.flatRateAmount ?? null : null,
      dto.comment?.trim() ?? '',
    ];
    try {
      await this.database.pool.query(
        `INSERT INTO work_order_helpers (
           work_order_id, helper_id, loading, loading_amount, unloading, unloading_amount,
           installation, installation_amount, dismantling, dismantling_amount,
           flat_rate, flat_rate_amount, comment
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULLIF($13, ''))
         ON CONFLICT (work_order_id, helper_id) DO UPDATE SET
           loading = EXCLUDED.loading, loading_amount = EXCLUDED.loading_amount,
           unloading = EXCLUDED.unloading, unloading_amount = EXCLUDED.unloading_amount,
           installation = EXCLUDED.installation, installation_amount = EXCLUDED.installation_amount,
           dismantling = EXCLUDED.dismantling, dismantling_amount = EXCLUDED.dismantling_amount,
           flat_rate = EXCLUDED.flat_rate, flat_rate_amount = EXCLUDED.flat_rate_amount,
           comment = EXCLUDED.comment, updated_at = now()`,
        values,
      );
      return this.findOne(orderId);
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '23503') throw new NotFoundException('Хелпер не найден');
      throw error;
    }
  }

  async remove(id: string) {
    const result = await this.database.pool.query('DELETE FROM work_orders WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) throw new NotFoundException('Заказ-наряд не найден');
    return { id };
  }

  async removeParticipant(orderId: string, helperId: string) {
    const result = await this.database.pool.query(
      'DELETE FROM work_order_helpers WHERE work_order_id = $1 AND helper_id = $2 RETURNING id',
      [orderId, helperId],
    );
    if (!result.rowCount) throw new NotFoundException('Хелпер не найден в заказ-наряде');
    return this.findOne(orderId);
  }

  async calculations() {
    const result = await this.database.pool.query(
      `SELECT h.id, h.full_name AS "fullName", count(woh.id)::int AS "orderCount",
              COALESCE(sum(woh.total_amount), 0) AS "totalAmount"
       FROM helpers h LEFT JOIN work_order_helpers woh ON woh.helper_id = h.id
       GROUP BY h.id ORDER BY h.full_name`,
    );
    const details = await this.database.pool.query(
      `SELECT h.id AS "helperId", wo.id AS "orderId", wo.number AS "orderNumber",
              wo.event_name AS "eventName", wo.venue, to_char(wo.starts_on, 'YYYY-MM-DD') AS "startsOn",
              to_char(wo.ends_on, 'YYYY-MM-DD') AS "endsOn", woh.loading,
              woh.loading_amount AS "loadingAmount", woh.unloading, woh.unloading_amount AS "unloadingAmount",
              woh.installation, woh.installation_amount AS "installationAmount", woh.dismantling,
              woh.dismantling_amount AS "dismantlingAmount", woh.flat_rate AS "flatRate",
              woh.flat_rate_amount AS "flatRateAmount", woh.total_amount AS "totalAmount", woh.comment
       FROM work_order_helpers woh
       JOIN helpers h ON h.id = woh.helper_id
       JOIN work_orders wo ON wo.id = woh.work_order_id
       ORDER BY wo.starts_on DESC, wo.number DESC`,
    );
    return result.rows.map(helper => ({
      ...helper,
      orders: details.rows.filter(item => item.helperId === helper.id),
    }));
  }
}
