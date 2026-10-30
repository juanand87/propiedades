import { ConfigService } from '@nestjs/config';
import { AdminRecoveryService } from './admin-recovery.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('test-bcrypt-hash'),
}));

describe('one-time deployment admin recovery', () => {
  let runner: any,
    db: any,
    values: Record<string, string>,
    service: AdminRecoveryService;
  beforeEach(() => {
    jest.clearAllMocks();
    values = {
      ADMIN_RECOVERY_ENABLED: 'true',
      ADMIN_RECOVERY_PASSWORD: 'recovery-test-password',
    };
    runner = {
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('GET_LOCK')) return [{ acquired: 1 }];
        if (sql.startsWith('SELECT id FROM admin_recovery_runs')) return [];
        if (sql.startsWith('SELECT id FROM users'))
          return [{ id: 'existing-admin' }];
        if (sql.startsWith('UPDATE users')) return { affectedRows: 1 };
        return [];
      }),
    };
    db = { createQueryRunner: jest.fn(() => runner) };
    service = new AdminRecoveryService(
      { get: (key: string) => values[key] } as ConfigService,
      db,
    );
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
  });
  it('does nothing by default and rejects a missing or truncated bcrypt secret', async () => {
    values.ADMIN_RECOVERY_ENABLED = 'false';
    await service.onApplicationBootstrap();
    expect(db.createQueryRunner).not.toHaveBeenCalled();
    values.ADMIN_RECOVERY_ENABLED = 'true';
    values.ADMIN_RECOVERY_PASSWORD = '';
    await service.onApplicationBootstrap();
    expect(db.createQueryRunner).not.toHaveBeenCalled();
    values.ADMIN_RECOVERY_PASSWORD = 'a'.repeat(73);
    await service.onApplicationBootstrap();
    expect(db.createQueryRunner).not.toHaveBeenCalled();
  });
  it('updates only the existing active admin and records success in the same transaction', async () => {
    await service.onApplicationBootstrap();
    expect(bcrypt.hash).toHaveBeenCalledWith('recovery-test-password', 12);
    expect(runner.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'WHERE id = ? AND email = ? AND role = ? AND isActive = 1',
      ),
      ['test-bcrypt-hash', 'existing-admin', 'admin@marketplace.com', 'admin'],
    );
    expect(runner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_recovery_runs'),
      ['marketplace-admin-recovery-2026-10-17', 'admin@marketplace.com'],
    );
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalled();
  });
  it('cannot reset the password again on a later restart', async () => {
    runner.query.mockImplementation(async (sql) =>
      sql.includes('GET_LOCK')
        ? [{ acquired: 1 }]
        : sql.startsWith('SELECT id FROM admin_recovery_runs')
          ? [{ id: 'already-used' }]
          : [],
    );
    await service.onApplicationBootstrap();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(
      runner.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE users')),
    ).toBe(false);
  });
  it('does not create, promote or reactivate a missing/non-admin/inactive user', async () => {
    const original = runner.query.getMockImplementation();
    runner.query.mockImplementation(async (sql) =>
      sql.startsWith('SELECT id FROM users') ? [] : original(sql),
    );
    await service.onApplicationBootstrap();
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(
      runner.query.mock.calls.some(
        ([sql]) =>
          sql.startsWith('UPDATE users') ||
          sql.startsWith('INSERT INTO admin_recovery_runs'),
      ),
    ).toBe(false);
  });
  it('rolls back failures without blocking startup or logging credentials', async () => {
    const original = runner.query.getMockImplementation();
    runner.query.mockImplementation(async (sql) => {
      if (sql.startsWith('INSERT INTO admin_recovery_runs'))
        throw Object.assign(new Error(values.ADMIN_RECOVERY_PASSWORD), {
          code: 'ER_TABLEACCESS_DENIED_ERROR',
        });
      return original(sql);
    });
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    const logs = (service as any).logger.error.mock.calls.flat().join(' ');
    expect(logs).not.toContain(values.ADMIN_RECOVERY_PASSWORD);
    expect(logs).not.toContain('test-bcrypt-hash');
    expect(runner.release).toHaveBeenCalled();
  });
  it('does not execute a reset without the advisory lock', async () => {
    runner.query.mockResolvedValue([{ acquired: 0 }]);
    await service.onApplicationBootstrap();
    expect(runner.startTransaction).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });
});
