-- Ejecutar después de EQUIPOS_CORREDORAS.sql. Repetible, conserva consultas y notas.
CREATE TABLE IF NOT EXISTS estate_inquiry_workflow (
 inquiry_id VARCHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
 stage ENUM('new','contacted','visit_scheduled','negotiation','closed') NOT NULL DEFAULT 'new',
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 updated_by VARCHAR(36) COLLATE utf8mb4_unicode_ci NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(inquiry_id) REFERENCES property_inquiries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_inquiry_assignments (
 inquiry_id VARCHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
 team_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 user_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 assigned_by VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX agent_inquiries(team_id,user_id),
 FOREIGN KEY(inquiry_id) REFERENCES property_inquiries(id),
 FOREIGN KEY(team_id,user_id) REFERENCES estate_company_members(team_id,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_inquiry_events (
 id CHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
 inquiry_id VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 actor_id VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 action ENUM('stage','assignment') NOT NULL,
 previous_value VARCHAR(40) NULL,
 next_value VARCHAR(40) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX inquiry_history(inquiry_id,created_at),
 FOREIGN KEY(inquiry_id) REFERENCES property_inquiries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Solo incorpora estados históricos; repetir no sobrescribe el seguimiento nuevo.
INSERT IGNORE INTO estate_inquiry_workflow(inquiry_id,stage,updated_at)
 SELECT id,status,created_at FROM property_inquiries;
