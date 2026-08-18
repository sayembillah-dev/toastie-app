/** Known social platforms for a club's official links — same catalogue as
 * `lib/profile/profile.ts`'s `PROFILE_SOCIAL_PLATFORMS`, kept as its own
 * copy since a club's public identity and a person's profile are unrelated
 * resources that happen to shape socials the same way. */
export const CLUB_SOCIAL_PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'X (Twitter)' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'website', label: 'Website' },
  { id: 'other', label: 'Other' },
] as const;

export type ClubSocialPlatform = (typeof CLUB_SOCIAL_PLATFORMS)[number]['id'];

export interface ClubSocial {
  platform: ClubSocialPlatform;
  url: string;
}

/** How a custom agenda banner image sits inside the fixed banner strip:
 * `x`/`y` are CSS background-position percentages, `zoom` multiplies the
 * cover fit (1 = exactly cover), and `aspect` is the image's natural
 * width / height — stored at upload time so the printed sheet can size the
 * image without fetching it first. */
export interface ClubBannerPos {
  x: number;
  y: number;
  zoom: number;
  aspect?: number;
}

/** The Club Admin-editable identity of their own club — served by
 * `GET /clubs/mine`. Area/division/district are read-only here: a
 * District/Division/Area Director sets club placement from the org
 * directory, not this page. */
export interface ClubProfile {
  id: string;
  name: string;
  clubNumber: string | null;
  motto: string | null;
  venueAddress: string | null;
  venueMapUrl: string | null;
  contactPhone: string | null;
  socials: ClubSocial[];
  areaName: string | null;
  divisionName: string | null;
  districtName: string | null;
  /** Hex colour for the printed agenda banner; null = default navy. */
  bannerColor: string | null;
  /** Signed, time-limited URL for the custom banner image — never sent
   * back to the API (the write field is `UpdateClubProfileInput.bannerImage`). */
  bannerImageUrl: string | null;
  bannerImagePos: ClubBannerPos | null;
  updatedAt: string;
}

/** Fields the Club Profile page can write. `null` explicitly clears a
 * field; omitting a key leaves it alone. */
export type UpdateClubProfileInput = Partial<
  Pick<
    ClubProfile,
    | 'name'
    | 'clubNumber'
    | 'motto'
    | 'venueAddress'
    | 'venueMapUrl'
    | 'contactPhone'
    | 'socials'
    | 'bannerColor'
    | 'bannerImagePos'
  >
> & {
  /** Write-only counterpart of `bannerImageUrl` — the storage key (or
   * inline data-URL) returned by `uploadFile`. `null` removes the image. */
  bannerImage?: string | null;
};
