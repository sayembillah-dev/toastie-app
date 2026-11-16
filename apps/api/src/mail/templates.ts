import type { MailMessage } from './mail.service';

/** Email bodies. Each template returns a plain-text and an HTML version of
 * the same words — the text part is what spam filters and some clients read,
 * so it is never an afterthought. The HTML is deliberately plain (inline
 * styles, one column, no images) so it renders the same in every client. */

const BRAND = 'Openfloor';

type Content = Omit<MailMessage, 'to'>;

/** The password-reset code. `minutes` is the code's lifetime. */
export function passwordResetCodeEmail(code: string, minutes: number): Content {
  const subject = `${code} is your ${BRAND} password reset code`;
  const text = [
    `Your ${BRAND} password reset code is:`,
    '',
    code,
    '',
    `It expires in ${minutes} minutes. Do not share this code with anyone.`,
    '',
    `If you did not ask to reset your password, ignore this email. Your password does not change until someone types this code.`,
  ].join('\n');
  const html = layout(`
    <p style="margin:0 0 16px">Your ${BRAND} password reset code is:</p>
    <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
    <p style="margin:0 0 16px">It expires in ${minutes} minutes. Do not share this code with anyone.</p>
    <p style="margin:0;color:#6b6b6b">If you did not ask to reset your password, ignore this email. Your password does not change until someone types this code.</p>
  `);
  return { subject, text, html };
}

/** Sent after a password reset succeeds — the account holder's chance to
 * notice a reset they did not make. */
export function passwordChangedEmail(): Content {
  const subject = `Your ${BRAND} password was changed`;
  const text = [
    `The password of your ${BRAND} account was just changed, and every device was signed out.`,
    '',
    `If you did this, you do not need to do anything.`,
    '',
    `If you did not do this, reset your password now with "Forgot password" on the sign-in page, and tell your club officer.`,
  ].join('\n');
  const html = layout(`
    <p style="margin:0 0 16px">The password of your ${BRAND} account was just changed, and every device was signed out.</p>
    <p style="margin:0 0 16px">If you did this, you do not need to do anything.</p>
    <p style="margin:0">If you did not do this, reset your password now with <strong>Forgot password</strong> on the sign-in page, and tell your club officer.</p>
  `);
  return { subject, text, html };
}

/** The code that proves the account holder reads this inbox. */
export function emailVerificationCodeEmail(code: string, minutes: number): Content {
  const subject = `${code} is your ${BRAND} verification code`;
  const text = [
    `Use this code to verify your email address on ${BRAND}:`,
    '',
    code,
    '',
    `It expires in ${minutes} minutes. Do not share this code with anyone.`,
    '',
    `If you did not ask for this code, ignore this email. Nothing changes until someone types this code.`,
  ].join('\n');
  const html = layout(`
    <p style="margin:0 0 16px">Use this code to verify your email address on ${BRAND}:</p>
    <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
    <p style="margin:0 0 16px">It expires in ${minutes} minutes. Do not share this code with anyone.</p>
    <p style="margin:0;color:#6b6b6b">If you did not ask for this code, ignore this email. Nothing changes until someone types this code.</p>
  `);
  return { subject, text, html };
}

/** Sent to the OLD address after the sign-in email moves to a new one. The
 * new address is masked: this mail goes to an inbox that may no longer
 * belong to the account holder. */
export function emailChangedEmail(maskedNewEmail: string): Content {
  const subject = `Your ${BRAND} sign-in email was changed`;
  const text = [
    `The sign-in email of your ${BRAND} account was changed to ${maskedNewEmail}.`,
    '',
    `If you did this, you do not need to do anything.`,
    '',
    `If you did not do this, tell your club officer now.`,
  ].join('\n');
  const html = layout(`
    <p style="margin:0 0 16px">The sign-in email of your ${BRAND} account was changed to <strong>${maskedNewEmail}</strong>.</p>
    <p style="margin:0 0 16px">If you did this, you do not need to do anything.</p>
    <p style="margin:0">If you did not do this, tell your club officer now.</p>
  `);
  return { subject, text, html };
}

function layout(body: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
      <p style="margin:0 0 24px;font-size:18px;font-weight:700">${BRAND}</p>
      ${body}
    </div>
  </body>
</html>`;
}
