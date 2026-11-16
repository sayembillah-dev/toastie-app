-- The credential-handoff page shows the sign-in email. Nullable: links made
-- before email was required at account creation have none.
ALTER TABLE "CredentialShare" ADD COLUMN "email" TEXT;
