-- Football Castellón — MariaDB target schema
-- Target: MariaDB 11.x / PHP 8.4
-- Import this file into the empty Football database in phpMyAdmin.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS access_profiles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS team_captain_history;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS finance_expenses;
DROP TABLE IF EXISTS finance_season_tickets;
DROP TABLE IF EXISTS finance_seasons;
DROP TABLE IF EXISTS game_players;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS players;

CREATE TABLE players (
  id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(254) NULL,
  email VARCHAR(254) NULL,
  bibs_taken_count INT NOT NULL DEFAULT 0,
  start_date DATE NULL,
  archived_at DATETIME NULL,
  skill_level TINYINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_players_archived (archived_at),
  KEY idx_players_email (email),
  CONSTRAINT chk_players_skill CHECK (skill_level IS NULL OR skill_level BETWEEN 1 AND 5),
  CONSTRAINT chk_players_bibs CHECK (bibs_taken_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE games (
  id CHAR(36) NOT NULL,
  game_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(255) NOT NULL DEFAULT 'Castellón',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_games_date_time (game_date, start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_players (
  id CHAR(36) NOT NULL,
  game_id CHAR(36) NOT NULL,
  player_id CHAR(36) NULL,
  guest_name VARCHAR(160) NULL,
  playing BOOLEAN NOT NULL DEFAULT FALSE,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  took_bibs BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_game_players_game (game_id),
  KEY idx_game_players_player (player_id),
  CONSTRAINT fk_game_players_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_players_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT chk_game_players_identity CHECK (player_id IS NOT NULL OR guest_name IS NOT NULL),
  CONSTRAINT chk_game_players_guest CHECK (player_id IS NULL OR guest_name IS NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE finance_seasons (
  id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  season_ticket_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pay_per_game_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_finance_seasons_name (name),
  KEY idx_finance_seasons_dates (starts_on, ends_on),
  CONSTRAINT chk_finance_seasons_dates CHECK (ends_on >= starts_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE finance_season_tickets (
  id CHAR(36) NOT NULL,
  season_id CHAR(36) NOT NULL,
  player_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_on DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_season_ticket_player (season_id, player_id),
  KEY idx_season_tickets_player (player_id),
  CONSTRAINT fk_season_tickets_season FOREIGN KEY (season_id) REFERENCES finance_seasons(id) ON DELETE CASCADE,
  CONSTRAINT fk_season_tickets_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id CHAR(36) NOT NULL,
  player_id CHAR(36) NOT NULL,
  game_id CHAR(36) NULL,
  payment_type VARCHAR(40) NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_player (player_id),
  KEY idx_payments_game (game_id),
  CONSTRAINT fk_payments_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE finance_expenses (
  id CHAR(36) NOT NULL,
  season_id CHAR(36) NOT NULL,
  due_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Pitch rental',
  amount DECIMAL(10,2) NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_on DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_season (season_id),
  KEY idx_expenses_due_date (due_date),
  CONSTRAINT fk_expenses_season FOREIGN KEY (season_id) REFERENCES finance_seasons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE team_captain_history (
  id CHAR(36) NOT NULL,
  game_id CHAR(36) NOT NULL,
  team_name VARCHAR(80) NOT NULL,
  player_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_captain_game_team (game_id, team_name),
  KEY idx_captain_player (player_id),
  CONSTRAINT fk_captain_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_captain_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id CHAR(36) NOT NULL,
  google_subject VARCHAR(255) NULL,
  email VARCHAR(254) NOT NULL,
  display_name VARCHAR(160) NULL,
  avatar_path VARCHAR(500) NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_google_subject (google_subject),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE access_profiles (
  email VARCHAR(254) NOT NULL,
  user_id CHAR(36) NULL,
  display_name VARCHAR(160) NULL,
  role ENUM('super_admin','admin','attendance','finance','viewer','player') NOT NULL DEFAULT 'viewer',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  player_id CHAR(36) NOT NULL,
  phone VARCHAR(64) NULL,
  contact_email VARCHAR(254) NULL,
  avatar_path VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (email),
  UNIQUE KEY uq_access_user (user_id),
  UNIQUE KEY uq_access_player (player_id),
  KEY idx_access_role (role),
  CONSTRAINT fk_access_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_access_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
  role ENUM('super_admin','admin','attendance','finance','viewer','player') NOT NULL,
  permission VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (role, permission)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO role_permissions (role, permission, enabled) VALUES
('admin','dashboard.view',TRUE),('admin','players.view',TRUE),('admin','players.manage',TRUE),
('admin','games.view',TRUE),('admin','games.manage',TRUE),('admin','attendance.view',TRUE),
('admin','attendance.manage',TRUE),('admin','payments.view',TRUE),('admin','payments.manage',TRUE),
('admin','access.manage',TRUE),
('attendance','dashboard.view',TRUE),('attendance','players.view',TRUE),('attendance','players.manage',TRUE),
('attendance','games.view',TRUE),('attendance','games.manage',TRUE),('attendance','attendance.view',TRUE),
('attendance','attendance.manage',TRUE),
('finance','dashboard.view',TRUE),('finance','players.view',TRUE),('finance','games.view',TRUE),
('finance','attendance.view',TRUE),('finance','payments.view',TRUE),('finance','payments.manage',TRUE),
('viewer','dashboard.view',TRUE),('viewer','players.view',TRUE),('viewer','games.view',TRUE),
('viewer','attendance.view',TRUE),
('player','games.view',TRUE)
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled);

SET FOREIGN_KEY_CHECKS = 1;
