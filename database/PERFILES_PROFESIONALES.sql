-- Ejecutar en propiedades antes del despliegue. Conserva cuentas, membresías y permisos.
ALTER TABLE estate_profile_identity MODIFY profile_kind ENUM('person','agent','company') NOT NULL;
-- Completa cuentas sin identidad; conserva nombres de usuario existentes.
INSERT INTO estate_profile_identity(user_id,profile_kind,username)
SELECT u.id,CASE WHEN a.kind='agency' THEN 'company' WHEN a.kind='broker' THEN 'agent' ELSE 'person' END,
 CONCAT('u',LEFT(REPLACE(u.id,'-',''),29))
FROM users u LEFT JOIN advertisers a ON a.user_id=CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci
WHERE NOT EXISTS(SELECT 1 FROM estate_profile_identity pi WHERE pi.user_id=CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci);
-- Base para equipos futuros. Estas tablas no conceden acceso a propiedades.
CREATE TABLE IF NOT EXISTS estate_company_teams (
 id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
 owner_user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 name VARCHAR(160) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY company_owner(owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_company_members (
 team_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 role ENUM('owner','manager','agent') NOT NULL DEFAULT 'agent',
 status ENUM('invited','active','revoked') NOT NULL DEFAULT 'invited',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(team_id,user_id), FOREIGN KEY(team_id) REFERENCES estate_company_teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_company_property_assignments (
 team_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 property_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 PRIMARY KEY(team_id,property_id,user_id),
 FOREIGN KEY(team_id,user_id) REFERENCES estate_company_members(team_id,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
