import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Terms of use, linked from the store listing, the app's Profile screen and
 * the registration screens ("By creating an account you agree to…").
 *
 * Google Play's User Generated Content policy expects an app where people can
 * see each other's content (profiles, bios, evaluations, shared agendas) to
 * publish rules for that content and say how to report a breach. The
 * "Acceptable use" and "Reporting" sections are what satisfy it; keep them
 * true to how reports are actually handled.
 */

const CONTACT_EMAIL = 'apps@niftyitsolution.com';
const LAST_UPDATED = '6 November 2026';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The rules for using Openfloor, what you can post, and how to report a problem.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-[#0b2a4c]">{title}</h2>
      <div className="space-y-3 text-black/80">{children}</div>
    </section>
  );
}

function Email({ subject }: { subject?: string }) {
  const href = subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`;
  return (
    <a href={href} className="font-medium text-[#0b2a4c] underline underline-offset-4">
      {CONTACT_EMAIL}
    </a>
  );
}

export default function TermsPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0b2a4c]">Terms of use</h1>
        <p className="text-black/70">
          Openfloor is an app clubs use to plan meetings, run them live, and keep track of their
          members’ progress. It is operated by Nifty IT Solution (“we”, “us”). By creating an
          account or using the app, you agree to these terms.
        </p>
        <p className="text-sm text-black/55">Last updated: {LAST_UPDATED}</p>
      </header>

      <Section title="Who can use Openfloor">
        <p>
          You must be at least 13 years old to create an account. If you are under the age of
          majority where you live, a parent or guardian must agree to these terms for you.
        </p>
        <p>
          You are responsible for your account. Keep your password private and tell us straight away
          if you think someone else has used it.
        </p>
      </Section>

      <Section title="Your content">
        <p>
          Your profile, the speeches and evaluations you add, and anything else you enter remain
          yours. You give us permission to store it and to show it to the people the app shows it to
          — the members and officers of your clubs, and anyone who opens a link your club shares —
          so that the app can work. We do not use your content for anything else.
        </p>
        <p>
          A club’s record of its own meetings belongs to the club. When you delete your account,
          your personal details are removed, but the club keeps its record of meetings you took part
          in, as the{' '}
          <Link href="/account-deletion" className="underline underline-offset-4">
            account deletion page
          </Link>{' '}
          explains.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>Everything you post is seen by real people in your club. Do not use Openfloor to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>harass, threaten, bully or demean anyone;</li>
          <li>post hateful content about any group, or sexually explicit or violent material;</li>
          <li>impersonate someone, or misrepresent who you are or which club you belong to;</li>
          <li>
            add someone else’s personal details — such as a guest’s phone number or photo — without
            their permission;
          </li>
          <li>
            post spam, advertising, or anything that is illegal or infringes someone’s rights;
          </li>
          <li>
            try to reach data you have not been given access to, or interfere with the service or
            other people’s use of it.
          </li>
        </ul>
        <p>
          Club officers who record guests or members are responsible for having a good reason to
          hold that information and for keeping it accurate.
        </p>
      </Section>

      <Section title="Reporting a problem">
        <p>
          If you see something in Openfloor that breaks these rules, tell an officer of your club,
          or email <Email subject="Report content on Openfloor" /> with the club name and what you
          saw. We review every report, normally within two working days.
        </p>
        <p>
          We may remove content, or suspend or close an account, when it breaks these terms. Where
          it is safe to, we will tell the person affected and give them a chance to respond.
        </p>
      </Section>

      <Section title="Messages we send">
        <p>
          Your club can have Openfloor send you messages — for example on WhatsApp, to the number on
          your profile — about meetings and the roles you are given. If you would rather not receive
          them, ask an officer of your club or email <Email />.
        </p>
      </Section>

      <Section title="Not affiliated with Toastmasters International">
        <p>
          Openfloor is an independent product. It is not affiliated with, endorsed by or sponsored
          by Toastmasters International. Any trademarks mentioned belong to their owners.
        </p>
      </Section>

      <Section title="The service">
        <p>
          We work to keep Openfloor available and your data safe, but we provide it “as is”: we
          cannot promise it will always be available or free of errors. To the extent the law
          allows, we are not liable for indirect or consequential loss arising from your use of the
          app.
        </p>
        <p>
          You can stop using Openfloor and delete your account at any time. How we handle your
          information is set out in our{' '}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          If we change these terms we will update this page and the date above. Material changes
          will be announced in the app before they take effect.
        </p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of Bangladesh.</p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms go to <Email />.
        </p>
      </Section>
    </article>
  );
}
