-- Ejecutar después de PERFILES_PROFESIONALES.sql. Repetible; no concede accesos existentes.
CREATE TABLE IF NOT EXISTS estate_company_invitations (
 id CHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
 team_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 email VARCHAR(254) NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status ENUM('pending','accepted','revoked') NOT NULL DEFAULT 'pending',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 expires_at DATETIME(3) NOT NULL,
 accepted_by CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
 UNIQUE KEY invitation_secret(token_hash), INDEX invitation_team(team_id,status),
 FOREIGN KEY(team_id) REFERENCES estate_company_teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_company_assignment_access (
 team_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 user_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 property_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 can_edit TINYINT NOT NULL DEFAULT 0,
 PRIMARY KEY(team_id,property_id,user_id),
 FOREIGN KEY(team_id,property_id,user_id) REFERENCES estate_company_property_assignments(team_id,property_id,user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_company_property_proposals (
 id CHAR(36) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
 team_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 user_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 property_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
 base_revision INT UNSIGNED NOT NULL,
 changes_json JSON NOT NULL,
 status ENUM('pending','applied','rejected') NOT NULL DEFAULT 'pending',
 reviewed_by CHAR(36) COLLATE utf8mb4_unicode_ci NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 reviewed_at DATETIME(3) NULL,
 INDEX company_proposals(team_id,status,created_at),
 FOREIGN KEY(team_id,user_id) REFERENCES estate_company_members(team_id,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
