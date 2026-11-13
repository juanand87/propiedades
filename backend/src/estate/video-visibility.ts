import { notHidden } from './moderation-rules';
export const videoVisible = `v.status='published' AND creator.isActive=1 AND ${notHidden('video', 'v.id')} AND (v.property_id IS NULL OR (p.publication_status='published' AND a.status='approved' AND u.isActive=1))`;
export const videoJoined = `FROM property_videos v JOIN users creator ON CONVERT(creator.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=v.created_by LEFT JOIN properties p ON p.id=v.property_id LEFT JOIN advertisers a ON a.id=p.advertiser_id LEFT JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id`;
