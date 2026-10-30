-- Preserve compatible advertiser identities without importing credentials or music.
USE `propiedades`;
SET @has_legacy_vendor = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='propiedades' AND table_name='vendors' AND column_name IN ('id','userId','storeName','slug'));
SET @identity_sql = IF(@has_legacy_vendor=4,
 'INSERT IGNORE INTO advertisers(id,user_id,legacy_vendor_id,slug,display_name,kind,status) SELECT v.id,v.userId,v.id,v.slug,v.storeName,''broker'',''pending'' FROM propiedades.vendors v JOIN propiedades.users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=CONVERT(v.userId USING utf8mb4) COLLATE utf8mb4_unicode_ci WHERE v.userId IS NOT NULL',
 'SELECT ''Sin cuentas heredadas que migrar'' AS migration_info');
PREPARE estate_identity FROM @identity_sql;
EXECUTE estate_identity;
DEALLOCATE PREPARE estate_identity;
INSERT IGNORE INTO estate_migrations(version) VALUES ('003_identity');

-- Post-migration verification. These statements never modify records.
SELECT DATABASE() AS target_database;
SELECT version,applied_at FROM estate_migrations ORDER BY version;
SELECT COUNT(*) AS regions FROM estate_regions;
SELECT COUNT(*) AS communes FROM estate_communes;
SELECT COUNT(*) AS preserved_users FROM users;
SELECT COUNT(*) AS properties FROM properties;
