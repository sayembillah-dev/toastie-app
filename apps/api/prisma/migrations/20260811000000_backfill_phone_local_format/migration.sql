-- Data-only migration, no schema change. Converts pre-existing rows stored
-- in E.164-ish form (+880/880 followed by a 10-digit subscriber number,
-- possibly with a stray dash like +8801935-910206) into the app's new local
-- 11-digit format by re-prepending the leading 0 that the country-code
-- prefix implicitly dropped, e.g. +8801717457286 -> 01717457286.
-- One of these is a live User.phone login credential — without this backfill
-- that account would fail the new exactly-11-digits validation on login.
UPDATE "User"
SET phone = '0' || substring(regexp_replace(phone, '\D', '', 'g') from 4)
WHERE regexp_replace(phone, '\D', '', 'g') ~ '^880\d{10}$';

UPDATE "Prospect"
SET phone = '0' || substring(regexp_replace(phone, '\D', '', 'g') from 4)
WHERE phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') ~ '^880\d{10}$';

UPDATE "Prospect"
SET whatsapp = '0' || substring(regexp_replace(whatsapp, '\D', '', 'g') from 4)
WHERE whatsapp IS NOT NULL AND regexp_replace(whatsapp, '\D', '', 'g') ~ '^880\d{10}$';

UPDATE "CredentialShare"
SET phone = '0' || substring(regexp_replace(phone, '\D', '', 'g') from 4)
WHERE regexp_replace(phone, '\D', '', 'g') ~ '^880\d{10}$';
