export type VideoProfileData = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  following: number;
  followers: number;
  likes: number;
  followed: boolean;
};
export type ProfileVideo = {
  thumbnail_url?: string;
  created_by: string;
  id: string;
  title: string;
  url: string;
  status: "draft" | "published";
  property_id: string | null;
  property_title: string | null;
  duration_ms: number | null;
  likes: number;
};
export type VideoSocialData = {
  id: string;
  title: string;
  status: "draft" | "published";
  property_id: string | null;
  property_title: string | null;
  creator: VideoProfileData;
  likes: number;
  comments: number;
  saves: number;
  liked: boolean;
  saved: boolean;
  can_edit: boolean;
  share_url: string;
};
