import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * The privacy policy, submitted in the Google Play store listing.
 *
 * Written from the data model rather than from a template: every category
 * below corresponds to something the schema actually stores, and the
 * "what we do not collect" section is true because there is no analytics,
 * advertising or tracking SDK anywhere in this repository. Keep it that way,
 * or change this page in the same commit.
 */

const CONTACT_EMAIL = 'apps@niftyitsolution.com';
const LAST_UPDATED = '31 August 2026';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What Toastie collects, why, who can see it, and how to delete it.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-[#0b2a4c]">{title}</h2>
      <div className="space-y-3 text-black/80">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0b2a4c]">Privacy policy</h1>
        <p className="text-black/70">
          Nifty IT Solution (“we”, “us”) operates Toastie, an app clubs use to run their meetings,
          track member education and manage their roster. This policy explains what the app stores,
          why, who can see it, and how to have it deleted.
        </p>
        <p className="text-sm text-black/55">Last updated: {LAST_UPDATED}</p>
      </header>

      <Section title="What we collect">
        <p>
          <strong>Your account.</strong> Your phone number, which is how you sign in; your first and
          last name; and your password, which is stored only as a cryptographic hash and is never
          readable by us. Optionally, an email address, a short bio, a profile photo, links to your
          social profiles, and your Toastmasters International member number if you choose to add
          it.
        </p>
        <p>
          <strong>Your club membership.</strong> Which clubs you belong to, the officer roles you
          hold, and your education pathway and level.
        </p>
        <p>
          <strong>Your participation in meetings.</strong> Your attendance, the meeting roles you
          are assigned, speeches you deliver, and evaluations you give and receive. Evaluations may
          include written feedback, images and audio recordings, when an evaluator chooses to submit
          them.
        </p>
        <p>
          <strong>Records your club’s officers enter.</strong> If you are recorded as a guest of a
          club, or your club’s treasurer records your dues, that information is stored too.
        </p>
        <p>
          <strong>Technical data needed to keep you signed in.</strong> Session tokens, stored only
          as hashes, and — if you turn on notifications — the subscription your browser or device
          issues so we can deliver them.
        </p>
      </Section>

      <Section title="What we do not collect">
        <p>
          Toastie contains no analytics, advertising or tracking software of any kind. We do not
          build advertising profiles, we do not sell or rent your data, and we do not share it with
          data brokers. The app does not request your location, your contacts, your camera roll or
          your microphone in the background.
        </p>
      </Section>

      <Section title="Why we hold it">
        <p>
          To run the service you signed up for: to sign you in, to show your club its agenda,
          roster, education progress and records, and to send you the notifications you asked for.
          We do not use your information for any purpose unrelated to running the app.
        </p>
      </Section>

      <Section title="Who can see it">
        <p>
          <strong>Your club.</strong> Toastie is a shared record. Other members of your club see
          your name, your roles, your speeches and your evaluations, in the same way they would in
          the club’s own minutes. Officers see more, according to their role — a treasurer sees
          dues, a VP Membership sees guest records.
        </p>
        <p>
          <strong>Anyone with a share link.</strong> A club can publish a meeting agenda as a public
          link so guests can read it without an account. A published agenda shows the names and
          roles of the people taking part in that meeting.
        </p>
        <p>
          <strong>Nobody else.</strong> We do not disclose your information to third parties except
          the infrastructure providers below, or where we are required to by law.
        </p>
      </Section>

      <Section title="Where it is stored">
        <p>
          Your data is held in a PostgreSQL database hosted by Neon in the Asia Pacific (Singapore)
          region, on servers we operate, and in S3-compatible object storage for files such as
          profile photos, documents and evaluation recordings. These providers process data on our
          instructions and for no purpose of their own.
        </p>
        <p>
          Traffic between the app and our servers is encrypted in transit. Passwords are hashed with
          Argon2 and session tokens are stored only as hashes, so neither can be read from the
          database.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Your account is kept for as long as it exists. When you delete it, the personal
          information listed on the{' '}
          <Link
            href="/account-deletion"
            className="font-medium text-[#0b2a4c] underline underline-offset-4"
          >
            account deletion page
          </Link>{' '}
          is erased immediately.
        </p>
        <p>
          Your club’s record of its own meetings is retained after that — your name on the roster,
          the speeches you delivered, the evaluations exchanged, and your attendance. These are the
          club’s records of what happened at its meetings, comparable to written minutes. Your
          contact details are removed from them.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can view and edit your profile at any time from within the app, and change your
          password from the same screen. You can delete your account yourself — see the{' '}
          <Link
            href="/account-deletion"
            className="font-medium text-[#0b2a4c] underline underline-offset-4"
          >
            account deletion page
          </Link>
          , which also covers what to do if you can no longer sign in.
        </p>
        <p>
          To ask what we hold about you, to correct it, or to request a copy, write to{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-[#0b2a4c] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="Children">
        <p>
          Toastie is built for club administration and is not directed at children under 13. We do
          not knowingly collect information from them. If you believe a child has an account, write
          to us and we will remove it.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we change what we collect or what we do with it, we will update this page and the date
          above. Material changes will be announced in the app.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy, or about your data, go to{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-[#0b2a4c] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
