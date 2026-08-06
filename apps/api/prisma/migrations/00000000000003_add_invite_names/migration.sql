-- The admin's "Invite a member" form takes optional firstName/lastName; store
-- them next to the invite so the wire projection matches the web's
-- `Invite` interface without pre-creating a Membership placeholder.
ALTER TABLE "Invite" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Invite" ADD COLUMN "lastName" TEXT;
