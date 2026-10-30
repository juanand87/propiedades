export const INVENTORY_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS inventory_sessions (
    id varchar(36) PRIMARY KEY, vendorId varchar(36) NOT NULL, name varchar(150) NOT NULL, scope text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'counting', createdBy varchar(36) NOT NULL,
    createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), completedAt datetime NULL, completedBy varchar(36) NULL, INDEX (vendorId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inventory_lines (
    id varchar(36) PRIMARY KEY, sessionId varchar(36) NOT NULL, productId varchar(36) NOT NULL,
    snapshotStock int NOT NULL, snapshotUpdatedAt datetime(6) NOT NULL, counted int NULL,
    note text NULL, selected tinyint NOT NULL DEFAULT 0, appliedStock int NULL, countedBy varchar(36) NULL,
    UNIQUE KEY session_product (sessionId, productId), FOREIGN KEY (sessionId) REFERENCES inventory_sessions(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inventory_found (
    id varchar(36) PRIMARY KEY, sessionId varchar(36) NOT NULL, barcode varchar(150) NULL,
    title varchar(255) NOT NULL, photoUrl text NULL, quantity int NOT NULL, status varchar(20) NOT NULL DEFAULT 'pending',
    productId varchar(36) NULL, note text NULL, INDEX(sessionId), FOREIGN KEY (sessionId) REFERENCES inventory_sessions(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inventory_events (
    id varchar(36) PRIMARY KEY, sessionId varchar(36) NOT NULL, productId varchar(36) NOT NULL,
    userId varchar(36) NOT NULL, quantity int NOT NULL, mode varchar(10) NOT NULL, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (sessionId) REFERENCES inventory_sessions(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inventory_cover_embeddings (
    productId varchar(36) PRIMARY KEY, vendorId varchar(36) NOT NULL, sourceHash char(64) NOT NULL,
    imageUrl text NOT NULL, model varchar(120) NOT NULL, status varchar(20) NOT NULL,
    vector blob NULL, error text NULL, claimedAt datetime NULL, INDEX(vendorId), INDEX(status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inventory_system_state (
    id int PRIMARY KEY, schemaVersion int NOT NULL, indexingEnabled tinyint NOT NULL DEFAULT 0,
    scanCursor varchar(36) NULL, lastError text NULL, installedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inventory_stock_sync (
    id varchar(36) PRIMARY KEY, sessionId varchar(36) NOT NULL, productId varchar(36) NOT NULL,
    vendorId varchar(36) NOT NULL, status varchar(20) NOT NULL DEFAULT 'pending', attempts int NOT NULL DEFAULT 0,
    error text NULL, claimedAt datetime(6) NULL, INDEX(sessionId), INDEX(status),
    FOREIGN KEY (sessionId) REFERENCES inventory_sessions(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `INSERT IGNORE INTO inventory_system_state (id, schemaVersion) VALUES (1, 1)`,
];
