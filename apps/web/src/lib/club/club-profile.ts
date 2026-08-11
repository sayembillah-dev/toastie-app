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
  socials: ClubSocial[];
  areaName: string | null;
  divisionName: string | null;
  districtName: string | null;
  updatedAt: string;
}

/** Fields the Club Profile page can write. `null` explicitly clears a
 * field; omitting a key leaves it alone. */
export type UpdateClubProfileInput = Partial<
  Pick<ClubProfile, 'name' | 'clubNumber' | 'motto' | 'venueAddress' | 'venueMapUrl' | 'socials'>
>;
