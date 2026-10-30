import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('product_spotify_tracks')
export class ProductSpotifyTrack {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'product_id', type: 'varchar', length: 255 })
  productId: string;

  @Column({ name: 'spotify_track_uri', type: 'varchar', length: 255 })
  spotifyTrackUri: string;

  @Column({ name: 'spotify_track_id', type: 'varchar', length: 255 })
  spotifyTrackId: string;

  @Column({ name: 'spotify_track_name', type: 'varchar', length: 500, nullable: true })
  spotifyTrackName: string | null;

  @Column({ name: 'spotify_track_artist', type: 'varchar', length: 500, nullable: true })
  spotifyTrackArtist: string | null;

  @Column({ name: 'spotify_album_id', type: 'varchar', length: 255, nullable: true })
  spotifyAlbumId: string | null;

  @Column({ type: 'int', default: 0 })
  popularity: number;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
