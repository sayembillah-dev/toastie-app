import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * The account deletion page Google Play requires of any app that lets people
 * register. It is submitted in the Data safety form and checked by a reviewer.
 *
 * The requirement is specifically for a URL reachable *without* installing the
 * app, which is why the email route below is not decoration: someone who has
 * lost their phone, or who never had the app, still has to be able to ask. The
 * in-app path is the fast one; the email path is the one that makes this page
 * satisfy the policy.
 *
 * What it describes must stay true to `UsersService.deleteOwnAccount`. If that
 * changes — particularly what is kept — this page changes with it.
 */

const CONTACT_EMAIL = 'apps@niftyitsolution.com';

export const metadata: Metadata = {
  title: 'Delete your Toastie account',
  description: 'How to delete your Toastie account and what happens to your data when you do.',
};

const DELETED = [
  'Your sign-in credentials and password',
  'Your phone number and email address',
  'Your profile details, photo, bio and any social links',
  'Your sessions on every device, so you are signed out everywhere',
  'Any push notification subscriptions',
  'Any club invitations you sent and join requests you made',
];

const RETAINED = [
  'Your name on your club’s roster',
  'Speeches you delivered, and the evaluations you gave and received',
  'Your attendance at past meetings and the roles you held',
  'Dues and payment records your club’s treasurer recorded',
];

export default function AccountDeletionPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0b2a4c]">
          Delete your Toastie account
        </h1>
        <p className="text-black/70">
          You can delete your Toastie account at any time. This page explains how, and exactly what
          is removed and what your club keeps.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[#0b2a4c]">In the app</h2>
        <ol className="list-decimal space-y-2 pl-5 text-black/80">
          <li>Open Toastie and sign in.</li>
          <li>
            Go to <strong>Profile</strong>.
          </li>
          <li>
            Tap <strong>Delete account</strong> at the bottom of the screen.
          </li>
          <li>
            Read what will be removed, confirm with your password, and your account is deleted.
          </li>
        </ol>
        <p className="text-black/70">
          Deletion happens immediately. There is no waiting period and no way to undo it.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[#0b2a4c]">By email</h2>
        <p className="text-black/80">
          If you cannot sign in — you have lost access to your phone number, or you no longer have
          the app — email{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Account%20deletion%20request`}
            className="font-medium text-[#0b2a4c] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>{' '}
          from the address on your account, or tell us the phone number you signed up with, and ask
          us to delete your account.
        </p>
        <p className="text-black/70">
          We will verify that the request comes from the account holder before acting on it, and
          complete the deletion within 30 days.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[#0b2a4c]">What is deleted</h2>
        <ul className="list-disc space-y-2 pl-5 text-black/80">
          {DELETED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[#0b2a4c]">What your club keeps</h2>
        <p className="text-black/80">
          Toastie is a shared record for a club, not only a personal account. Your club’s minutes of
          what happened at its meetings remain the club’s records, so the following stay after your
          account is gone:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-black/80">
          {RETAINED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-black/70">
          Your roster entry stops being linked to any account, and your email address and phone
          number are erased from it. Your name remains, the same way it would appear in a club’s
          written minutes.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[#0b2a4c]">Leaving a club</h2>
        <p className="text-black/80">
          Deleting your account does not remove you from your club’s roster. If what you want is to
          leave a club, ask one of its officers to remove you — club officers manage the roster.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[#0b2a4c]">If you administer a club</h2>
        <p className="text-black/80">
          If you are the only club admin of a club, we will ask you to give that role to another
          member first. A club with no administrator cannot be repaired from inside the app.
        </p>
      </section>

      <p className="border-t border-black/8 pt-8 text-sm text-black/55">
        For anything else about your data, see our{' '}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-[#0b2a4c]">
          privacy policy
        </Link>
        .
      </p>
    </article>
  );
}
