-- Configuración visual de Propiedades. Repetible; conserva el diseño y los datos.
USE `propiedades`;
SET @design_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='propiedades' AND table_name='estate_settings' AND column_name='design_json');
SET @design_sql = IF(@design_column=0, 'ALTER TABLE propiedades.estate_settings ADD COLUMN design_json LONGTEXT NULL', 'SELECT ''design_json ya existe'' AS migration_info');
PREPARE estate_design FROM @design_sql;
EXECUTE estate_design;
DEALLOCATE PREPARE estate_design;
SET @revision_column = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='propiedades' AND table_name='estate_settings' AND column_name='design_revision');
SET @design_sql = IF(@revision_column=0, 'ALTER TABLE propiedades.estate_settings ADD COLUMN design_revision INT NOT NULL DEFAULT 1', 'SELECT ''design_revision ya existe'' AS migration_info');
PREPARE estate_design FROM @design_sql;
EXECUTE estate_design;
DEALLOCATE PREPARE estate_design;
INSERT IGNORE INTO propiedades.estate_migrations(version) VALUES ('004_site_design');
SELECT version,applied_at FROM propiedades.estate_migrations WHERE version='004_site_design';
