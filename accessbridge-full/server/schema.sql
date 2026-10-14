-- AccessBridge MySQL schema. The Express server also creates these tables automatically.
CREATE DATABASE IF NOT EXISTS accessbridge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE accessbridge;

CREATE TABLE IF NOT EXISTS schemes (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  icon VARCHAR(32) NOT NULL DEFAULT '🔎',
  description TEXT NOT NULL,
  audience VARCHAR(255) NOT NULL,
  states_json JSON NOT NULL,
  education_json JSON NOT NULL,
  documents_json JSON NOT NULL,
  verify_json JSON NOT NULL,
  url VARCHAR(1000) NOT NULL,
  source VARCHAR(1000) NOT NULL,
  last_verified DATE NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schemes_category_active (category, active),
  INDEX idx_schemes_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS search_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  state VARCHAR(80) NOT NULL,
  education VARCHAR(40) NOT NULL,
  category VARCHAR(80) NOT NULL,
  query_text VARCHAR(100) NOT NULL DEFAULT '',
  result_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_search_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
