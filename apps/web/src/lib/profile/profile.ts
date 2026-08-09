/** Known social platforms — same catalogue as `lib/people/guests.ts`'s
 * `SOCIAL_PLATFORMS`, kept as its own copy since a profile and a guest are
 * unrelated resources that happen to shape socials the same way. */
export const PROFILE_SOCIAL_PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'X (Twitter)' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'website', label: 'Website' },
  { id: 'other', label: 'Other' },
] as const;

export type ProfileSocialPlatform = (typeof PROFILE_SOCIAL_PLATFORMS)[number]['id'];

export interface ProfileSocial {
  platform: ProfileSocialPlatform;
  url: string;
}

/** Read-only pathway standing for one club membership — pathway/level stay
 * editable only through the Education module, never from the profile page. */
export interface ProfileMembership {
  clubId: string;
  clubName: string;
  pathway: string | null;
  level: number | null;
}

export interface Profile {
  id: string;
  /** Primary auth credential. Changing it re-confirms the current password. */
  phone: string;
  /** Optional contact channel. Changing it re-confirms the current password. */
  email: string | null;
  firstName: string;
  lastName: string;
  bio: string | null;
  avatarUrl: string | null;
  socials: ProfileSocial[];
  createdAt: string;
  memberships: ProfileMembership[];
}

/** Fields the profile page can write. `currentPassword` is only required by
 * the server when `email` or `phone` is present. */
export type UpdateProfileInput = Partial<
  Pick<Profile, 'firstName' | 'lastName' | 'email' | 'phone' | 'bio' | 'avatarUrl' | 'socials'>
> & { currentPassword?: string };

export function getProfileInitials(profile: Pick<Profile, 'firstName' | 'lastName'>): string {
  return `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();
}
