-- Propiedades: videos independientes y perfiles sociales. Repetible MySQL/MariaDB.
-- Ejecutar tras SPACES_VIDEOS_PROPIEDADES.sql. Conserva todos los videos existentes.
USE propiedades;
ALTER TABLE property_videos MODIFY COLUMN property_id varchar(36) NULL;
CREATE TABLE IF NOT EXISTS estate_video_profiles (
  user_id varchar(36) PRIMARY KEY,
  display_name varchar(100) NOT NULL,
  avatar_media_id varchar(36) NULL,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_video_follows (
  follower_id varchar(36) NOT NULL,
  followed_id varchar(36) NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(follower_id,followed_id), KEY ix_followed(followed_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_video_likes (
  user_id varchar(36) NOT NULL, video_id varchar(36) NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,video_id), KEY ix_liked_video(video_id),
  FOREIGN KEY(video_id) REFERENCES property_videos(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_video_saves (
  user_id varchar(36) NOT NULL, video_id varchar(36) NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,video_id), KEY ix_saved_video(video_id),
  FOREIGN KEY(video_id) REFERENCES property_videos(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS estate_video_comments (
  id varchar(36) PRIMARY KEY, video_id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL, body varchar(2000) NOT NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_video_comments(video_id,created_at,id),
  FOREIGN KEY(video_id) REFERENCES property_videos(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
