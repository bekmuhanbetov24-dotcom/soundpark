import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseError } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CreateHelperDto, UpdateHelperDto } from './helpers.dto';

@Injectable()
export class HelpersService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    const result = await this.database.pool.query(
      `SELECT id, full_name AS "fullName", phone, comment, is_active AS "isActive",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM helpers ORDER BY is_active DESC, full_name`,
    );
    return result.rows;
  }

  async create(dto: CreateHelperDto) {
    try {
      const result = await this.database.pool.query(
        `INSERT INTO helpers (full_name, phone, comment)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''))
         RETURNING id, full_name AS "fullName", phone, comment, is_active AS "isActive"`,
        [dto.fullName.trim(), dto.phone?.trim() ?? '', dto.comment?.trim() ?? ''],
      );
      return result.rows[0];
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '23505') {
        throw new ConflictException('Хелпер с таким ФИО уже существует');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateHelperDto) {
    try {
      const result = await this.database.pool.query(
        `UPDATE helpers SET
           full_name = COALESCE($2, full_name),
           phone = CASE WHEN $3::text IS NULL THEN phone ELSE NULLIF($3, '') END,
           comment = CASE WHEN $4::text IS NULL THEN comment ELSE NULLIF($4, '') END,
           is_active = COALESCE($5, is_active),
           updated_at = now()
         WHERE id = $1
         RETURNING id, full_name AS "fullName", phone, comment, is_active AS "isActive"`,
        [id, dto.fullName?.trim() ?? null, dto.phone?.trim() ?? null, dto.comment?.trim() ?? null, dto.isActive ?? null],
      );
      if (!result.rowCount) throw new NotFoundException('Хелпер не найден');
      return result.rows[0];
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '23505') {
        throw new ConflictException('Хелпер с таким ФИО уже существует');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const result = await this.database.pool.query('DELETE FROM helpers WHERE id = $1 RETURNING id', [id]);
      if (!result.rowCount) throw new NotFoundException('Хелпер не найден');
      return { id };
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '23503') {
        throw new ConflictException('Хелпер участвует в заказ-нарядах. Сначала удалите его из заказов или переместите в архив');
      }
      throw error;
    }
  }
}
