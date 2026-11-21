import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { notHidden } from './moderation-rules';

// Records the intent to publish the source video with its property.
// Unrelated drafts are never promoted by an approval.
@Injectable()
export class PropertyVideoPublicationService {
  async available(tx: Pick<EntityManager, 'query'>) {
    const [row] = await tx.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='estate_property_video_publication'",
    );
    return Number(row.n) === 1;
  }
  async link(
    tx: EntityManager,
    videoId: string,
    propertyId: string | null,
    actorId: string,
    propertyStatus?: string,
    publishWithProperty = false,
  ) {
    if (!(await this.available(tx))) return;
    await tx.query(
      'DELETE FROM estate_property_video_publication WHERE video_id=?',
      [videoId],
    );
    if (
      !propertyId ||
      (!publishWithProperty &&
        !['draft', 'pending_review'].includes(propertyStatus || ''))
    )
      return;
    await tx.query(
      'INSERT INTO estate_property_video_publication(video_id,property_id,requested_by) VALUES (?,?,?)',
      [videoId, propertyId, actorId],
    );
    if (propertyStatus === 'published' && publishWithProperty)
      await this.approve(tx, propertyId, videoId);
  }
  async cancel(tx: EntityManager, videoId: string) {
    if (await this.available(tx))
      await tx.query(
        'DELETE FROM estate_property_video_publication WHERE video_id=?',
        [videoId],
      );
  }
  async approve(tx: EntityManager, propertyId: string, videoId?: string) {
    if (!(await this.available(tx))) return 0;
    const filter = videoId ? ' AND v.id=?' : '';
    const result = await tx.query<{ affectedRows: number }>(
      `UPDATE property_videos v JOIN estate_property_video_publication intent ON intent.video_id=v.id AND intent.property_id=v.property_id JOIN properties p ON p.id=v.property_id JOIN advertisers a ON a.id=p.advertiser_id JOIN users owner ON CONVERT(owner.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id JOIN users creator ON CONVERT(creator.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=v.created_by SET v.status='published',v.updated_at=UTC_TIMESTAMP() WHERE intent.property_id=? AND v.status='draft' AND p.publication_status='published' AND a.status='approved' AND owner.isActive=1 AND creator.isActive=1 AND ${notHidden('video', 'v.id')}${filter}`,
      [propertyId, ...(videoId ? [videoId] : [])],
    );
    await tx.query(
      'DELETE FROM estate_property_video_publication WHERE property_id=?' +
        (videoId ? ' AND video_id=?' : ''),
      [propertyId, ...(videoId ? [videoId] : [])],
    );
    return Number(result.affectedRows);
  }
}
