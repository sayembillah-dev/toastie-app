import { ImageResponse } from 'next/og';

import { apiFetch } from '@/lib/api';

export const alt = 'Toastie club invite';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface InvitePreviewMeta {
  state: 'valid' | 'expired' | 'accepted' | 'revoked';
  clubName: string;
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await apiFetch<InvitePreviewMeta>(`/public/invites/${token}`).catch(() => null);
  const clubName = preview && preview.state === 'valid' ? preview.clubName : null;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1c1c1c',
        color: '#fafafa',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 32, letterSpacing: 6, textTransform: 'uppercase', opacity: 0.55 }}>
        Toastie
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: clubName ? 60 : 72,
          fontWeight: 700,
          marginTop: 28,
          textAlign: 'center',
          padding: '0 90px',
          lineHeight: 1.2,
        }}
      >
        {clubName ? `You're invited to ${clubName}` : "You're invited to Toastie"}
      </div>
    </div>,
    size,
  );
}
