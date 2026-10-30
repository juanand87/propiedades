import {
  Injectable,
  PreconditionFailedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { INVENTORY_SCHEMA } from './inventory-schema';

@Injectable()
export class InventorySetupService {
  private readyUntil = 0;
  constructor(private readonly db: DataSource) {}
  async ready(): Promise<boolean> {
    if (this.readyUntil > Date.now()) return true;
    try {
      const rows = await this.db.query(
        'SELECT schemaVersion FROM inventory_system_state WHERE id = 1',
      );
      if (Number(rows[0]?.schemaVersion) === 1) {
        this.readyUntil = Date.now() + 10000;
        return true;
      }
    } catch (error) {
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code))
        throw error;
    }
    return false;
  }
  async requireReady() {
    if (!(await this.ready()))
      throw new PreconditionFailedException(
        'Inventario pendiente de preparación. La administración debe activarlo desde Panel → Inventario.',
      );
  }
  async install() {
    const runner = this.db.createQueryRunner();
    await runner.connect();
    try {
      const rows = await runner.query(
        "SELECT GET_LOCK('mundobeat_inventory_setup', 10) AS acquired",
      );
      if (Number(rows[0]?.acquired) !== 1)
        throw new ServiceUnavailableException(
          'La preparación ya está en curso. Inténtalo nuevamente.',
        );
      for (const statement of INVENTORY_SCHEMA) await runner.query(statement);
      this.readyUntil = 0;
      return {
        ready: await this.ready(),
        message: 'Inventario preparado correctamente',
      };
    } finally {
      await runner
        .query("SELECT RELEASE_LOCK('mundobeat_inventory_setup')")
        .catch(() => undefined);
      await runner.release();
    }
  }
}
