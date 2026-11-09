USE propiedades;
CREATE TABLE IF NOT EXISTS estate_user_memberships (
  user_id varchar(36) PRIMARY KEY,
  plan enum('free','basic','pro') NOT NULL DEFAULT 'free'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
