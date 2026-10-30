import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const RECOVERY_ID = 'marketplace-admin-recovery-2026-10-17';
const RECOVERY_EMAIL = 'admin@marketplace.com';

@Injectable()
export class AdminRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminRecoveryService.name);
  constructor(
    private readonly config: ConfigService,
    private readonly db: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('ADMIN_RECOVERY_ENABLED') !== 'true') return;
    const password = this.config.get<string>('ADMIN_RECOVERY_PASSWORD');
    if (
      !password ||
      password.length < 10 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      this.logger.error(
        'Recuperacion no ejecutada: ADMIN_RECOVERY_PASSWORD debe tener al menos 10 caracteres y hasta 72 bytes.',
      );
      return;
    }

    const runner = this.db.createQueryRunner();
    let connected = false,
      locked = false,
      transaction = false;
    try {
      await runner.connect();
      connected = true;
      const [lock] = await runner.query(
        "SELECT GET_LOCK('mundobeat_admin_recovery', 10) AS acquired",
      );
      if (Number(lock?.acquired) !== 1) {
        this.logger.warn(
          'Recuperacion no ejecutada: otra instancia esta procesandola.',
        );
        return;
      }
      locked = true;
      await runner.query(`CREATE TABLE IF NOT EXISTS admin_recovery_runs (
        id varchar(80) PRIMARY KEY, email varchar(255) NOT NULL,
        completedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await runner.startTransaction();
      transaction = true;
      const previous = await runner.query(
        'SELECT id FROM admin_recovery_runs WHERE id = ?',
        [RECOVERY_ID],
      );
      if (previous.length) {
        await runner.commitTransaction();
        transaction = false;
        this.logger.log(
          'Recuperacion ya utilizada. No se cambia la clave. Elimina ADMIN_RECOVERY_ENABLED y ADMIN_RECOVERY_PASSWORD del entorno.',
        );
        return;
      }
      const users = await runner.query(
        'SELECT id FROM users WHERE email = ? AND role = ? AND isActive = 1 FOR UPDATE',
        [RECOVERY_EMAIL, 'admin'],
      );
      if (users.length !== 1) {
        await runner.rollbackTransaction();
        transaction = false;
        this.logger.error(
          'Recuperacion no ejecutada: admin@marketplace.com debe existir, ser administrador y estar activo. No se crearon usuarios ni se cambiaron permisos.',
        );
        return;
      }
      const hash = await bcrypt.hash(password, 12);
      const result = await runner.query(
        'UPDATE users SET password = ?, tempPassword = NULL, requirePasswordChange = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND email = ? AND role = ? AND isActive = 1',
        [hash, users[0].id, RECOVERY_EMAIL, 'admin'],
      );
      if (Number(result.affectedRows) !== 1)
        throw new Error('RECOVERY_TARGET_CHANGED');
      // The marker and password update commit together; restarts cannot reuse the reset.
      await runner.query(
        'INSERT INTO admin_recovery_runs (id, email) VALUES (?, ?)',
        [RECOVERY_ID, RECOVERY_EMAIL],
      );
      await runner.commitTransaction();
      transaction = false;
      this.logger.log(
        'Recuperacion completada para admin@marketplace.com. Elimina ADMIN_RECOVERY_ENABLED y ADMIN_RECOVERY_PASSWORD del entorno y cambia la clave tras ingresar.',
      );
    } catch (error) {
      if (transaction)
        await runner.rollbackTransaction().catch(() => undefined);
      const code =
        typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)
          ? error.code
          : 'RECOVERY_FAILED';
      // Do not log SQL parameters, environment values, passwords or password hashes.
      this.logger.error(
        `Recuperacion no completada (${code}). Verifica permisos CREATE/UPDATE y la conexion de BD; el backend continuara iniciando.`,
      );
    } finally {
      if (locked)
        await runner
          .query("SELECT RELEASE_LOCK('mundobeat_admin_recovery')")
          .catch(() => undefined);
      if (connected) await runner.release().catch(() => undefined);
    }
  }
}
