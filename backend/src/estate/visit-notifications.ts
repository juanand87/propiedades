import { notBlocked } from './moderation-rules';
export const visitNoticeJoins = `FROM estate_visit_notices n JOIN estate_visit_bookings b ON b.id=n.booking_id JOIN users recipient ON CONVERT(recipient.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=n.user_id JOIN users buyer ON CONVERT(buyer.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=b.buyer_id JOIN users seller ON CONVERT(seller.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=b.seller_id JOIN properties p ON p.id=b.property_id JOIN advertisers a ON a.id=p.advertiser_id`;
export const visitNoticeValid = `n.version=b.version AND recipient.isActive=1 AND ${notBlocked('b.buyer_id', 'b.seller_id')} AND (
 (n.kind='event' AND n.due_at>UTC_TIMESTAMP()-INTERVAL 2 DAY AND (b.state IN ('cancelled','rejected') OR (buyer.isActive=1 AND seller.isActive=1)))
 OR (n.kind IN ('reminder24','reminder1') AND b.state='confirmed' AND buyer.isActive=1 AND seller.isActive=1 AND p.publication_status='published' AND p.availability='available' AND a.status='approved' AND b.starts_at>UTC_TIMESTAMP() AND (n.kind='reminder1' OR b.starts_at>UTC_TIMESTAMP()+INTERVAL 2 HOUR))
)`;
