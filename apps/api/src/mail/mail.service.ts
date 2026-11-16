import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppEnv, MailProvider } from '@/config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** The API's single way to send email. Which provider runs is decided once,
 * at boot, from `MAIL_PROVIDER` — callers never branch on environment:
 *
 * - `ses` sends through Amazon SES (v2 API) with the AWS key pair the S3
 *   storage already uses, from the verified `MAIL_FROM` identity.
 * - `console` writes the message to the log instead. In development the
 *   whole message is logged so a developer can read the one-time code. In
 *   production only the fact that a send was skipped is logged — never the
 *   body — so codes cannot leak into the PM2 logs if SES is not set up yet.
 *
 * `send()` throws on an SES failure. Callers that must not block on email
 * (anything on a public auth route) fire it in the background and log. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly provider: MailProvider;
  private readonly isProduction: boolean;
  private readonly from?: string;
  private readonly client?: SESv2Client;

  constructor(config: ConfigService) {
    this.provider = config.get<MailProvider>('MAIL_PROVIDER') ?? MailProvider.Console;
    this.isProduction = config.get<AppEnv>('APP_ENV') === AppEnv.Production;
    if (this.provider === MailProvider.Ses) {
      this.from = config.get<string>('MAIL_FROM');
      this.client = new SESv2Client({
        region: config.get<string>('SES_REGION'),
        credentials: {
          accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
          secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
        },
      });
    }
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.client) {
      if (this.isProduction) {
        this.logger.warn(
          `Email not sent (MAIL_PROVIDER=console): "${message.subject}" to ${maskEmail(message.to)}`,
        );
      } else {
        this.logger.log(
          `\n── Email (MAIL_PROVIDER=console) ──\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n──────────────────────────────────`,
        );
      }
      return;
    }

    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: message.text, Charset: 'UTF-8' },
              Html: { Data: message.html, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
  }
}

/** `sayem@gmail.com` → `s•••@gmail.com`. For logs only. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '•••';
  return `${email[0]}•••${email.slice(at)}`;
}
