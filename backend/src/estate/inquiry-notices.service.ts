import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
const validToken = (s: string) => /^[A-Za-z0-9_:-]{20,255}$/.test(s);
const joins = `FROM estate_inquiry_notices n
 JOIN estate_inquiry_assignments ia ON ia.inquiry_id=n.inquiry_id AND ia.user_id=n.user_id
 JOIN estate_company_members m ON m.team_id=ia.team_id AND m.user_id=ia.user_id AND m.status='active'
 JOIN estate_company_teams t ON t.id=ia.team_id
 JOIN property_inquiries i ON i.id=n.inquiry_id JOIN properties p ON p.id=i.property_id
 JOIN advertisers a ON a.id=p.advertiser_id AND a.user_id=t.owner_user_id AND a.status='approved'
 JOIN estate_profile_identity pi ON pi.user_id=t.owner_user_id AND pi.profile_kind='company'
 JOIN users owner ON CONVERT(owner.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=t.owner_user_id AND owner.isActive=1
 JOIN users agent ON CONVERT(agent.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=n.user_id AND agent.isActive=1`;
const valid = `n.id=(SELECT MAX(latest.id) FROM estate_inquiry_notices latest WHERE latest.inquiry_id=n.inquiry_id) AND n.created_at>UTC_TIMESTAMP(3)-INTERVAL 1 DAY`;
type Deliver = (
  token: string,
  noticeId: string,
  inquiryId: string,
) => Promise<'sent' | 'invalid' | 'unregistered'>;
@Injectable()
export class InquiryNoticesService {
  constructor(private db: DataSource) {}
  async available(tx: Pick<EntityManager, 'query'> = this.db) {
    const [r] = await tx.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_inquiry_notices','estate_inquiry_push')",
    );
    return Number(r.n) === 2;
  }
  async enqueue(
    tx: EntityManager,
    eventId: string,
    inquiryId: string,
    userId: string,
  ) {
    if (!(await this.available(tx))) return;
    await tx.query(
      'INSERT IGNORE INTO estate_inquiry_notices(event_id,inquiry_id,user_id) VALUES (?,?,?)',
      [eventId, inquiryId, userId],
    );
  }
  // Called only under the shared push worker's database lock and credential guard.
  async flush(deliver: Deliver) {
    if (!(await this.available())) return;
    const notices = await this.db.query<{ id: string }[]>(
      'SELECT CAST(id AS CHAR) id FROM estate_inquiry_notices WHERE expanded=0 ORDER BY id LIMIT 25',
    );
    for (const notice of notices)
      await this.db.transaction(async (tx) => {
        const [row] = await tx.query<{ id: string }[]>(
          'SELECT CAST(id AS CHAR) id FROM estate_inquiry_notices WHERE id=? AND expanded=0 FOR UPDATE',
          [notice.id],
        );
        if (!row) return;
        await tx.query(
          `INSERT IGNORE INTO estate_inquiry_push(notice_id,token,user_id) SELECT n.id,d.token,n.user_id ${joins} JOIN estate_push_devices d ON d.user_id=n.user_id AND d.updated_at>UTC_TIMESTAMP()-INTERVAL 90 DAY WHERE n.id=? AND ${valid}`,
          [notice.id],
        );
        await tx.query(
          'UPDATE estate_inquiry_notices SET expanded=1 WHERE id=?',
          [notice.id],
        );
      });
    const rows = await this.db.query<
      { notice_id: string; token: string; user_id: string; attempts: number }[]
    >(
      "SELECT CAST(notice_id AS CHAR) notice_id,token,user_id,attempts FROM estate_inquiry_push WHERE status='pending' AND due_at<=UTC_TIMESTAMP(3) ORDER BY due_at,notice_id LIMIT 25",
    );
    for (const row of rows) {
      const update = (status: string) =>
        this.db.query(
          'UPDATE estate_inquiry_push SET status=? WHERE notice_id=? AND token=?',
          [status, row.notice_id, row.token],
        );
      const [event] = await this.db.query<{ inquiry_id: string }[]>(
        `SELECT n.inquiry_id ${joins} JOIN estate_push_devices d ON d.user_id=n.user_id AND d.token=? WHERE n.id=? AND n.user_id=? AND ${valid}`,
        [row.token, row.notice_id, row.user_id],
      );
      if (!event || !validToken(row.token)) {
        await update('done');
        continue;
      }
      if (row.attempts >= 12) {
        await update('failed');
        continue;
      }
      await this.db.query(
        'UPDATE estate_inquiry_push SET attempts=attempts+1,due_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)) WHERE notice_id=? AND token=?',
        [Math.min(3600, 30 * 2 ** row.attempts), row.notice_id, row.token],
      );
      try {
        const result = await deliver(
          row.token,
          row.notice_id,
          event.inquiry_id,
        );
        if (result === 'unregistered')
          await this.db.query(
            'DELETE FROM estate_push_devices WHERE token=? AND user_id=?',
            [row.token, row.user_id],
          );
        await update(result === 'invalid' ? 'failed' : 'done');
      } catch {
        /* The persisted retry remains pending. */
      }
    }
    await this.db.query(
      'DELETE FROM estate_inquiry_notices WHERE created_at<UTC_TIMESTAMP()-INTERVAL 30 DAY LIMIT 1000',
    );
  }
}
