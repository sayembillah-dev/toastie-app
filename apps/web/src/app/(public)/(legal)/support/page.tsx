import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Support / contact page — the "Website" on the Google Play store listing, and
 * where the app's Profile → Help & support row lands. Needs to work without an
 * account: the people most likely to need it are the ones who cannot sign in.
 */

const CONTACT_EMAIL = 'apps@niftyitsolution.com';

export const metadata: Metadata = {
  title: 'Help & support',
  description: 'Get help with Openfloor: signing in, joining a club, your data, and contacting us.',
};

const TOPICS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'I can’t sign in',
    a: (
      <>
        Sign in with the mobile number you registered with. If you have forgotten your password,
        email us with that number and your club’s name; once we have confirmed it is you, we reset
        it and send you a new one.
      </>
    ),
  },
  {
    q: 'How do I join my club?',
    a: (
      <>
        Ask a club officer for the club’s join code or an invite link. If your club already added
        you to its roster, register with that same mobile number and your record links
        automatically.
      </>
    ),
  },
  {
    q: 'Someone posted something they shouldn’t have',
    a: (
      <>
        Tell an officer of your club, or report it to us as described in the{' '}
        <Link href="/terms" className="underline underline-offset-4">
          terms of use
        </Link>
        .
      </>
    ),
  },
  {
    q: 'I want to delete my account or my data',
    a: (
      <>
        See{' '}
        <Link href="/account-deletion" className="underline underline-offset-4">
          how to delete your account
        </Link>
        . To ask what we hold about you, or for a copy, email us.
      </>
    ),
  },
];

export default function SupportPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0b2a4c]">Help & support</h1>
        <p className="text-black/70">
          Openfloor is built and supported by Nifty IT Solution. Most questions about a club — its
          meetings, roster or roles — are best answered by that club’s officers. For anything about
          the app itself, we are here.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-[#0b2a4c]">Contact us</h2>
        <p className="text-black/80">
          Email{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Openfloor%20support`}
            className="font-medium text-[#0b2a4c] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          . Include the mobile number on your account and your club’s name. We reply within two
          working days.
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-[#0b2a4c]">Common questions</h2>
        {TOPICS.map((t) => (
          <div key={t.q} className="space-y-1.5">
            <h3 className="font-semibold text-black/85">{t.q}</h3>
            <p className="text-black/75">{t.a}</p>
          </div>
        ))}
      </section>
    </article>
  );
}
