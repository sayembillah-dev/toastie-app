export { MailModule } from './mail.module';
export { type MailMessage, MailService, maskEmail } from './mail.service';
export {
  emailChangedEmail,
  emailVerificationCodeEmail,
  passwordChangedEmail,
  passwordResetCodeEmail,
} from './templates';
