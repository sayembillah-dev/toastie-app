-- Data-only migration, no schema change.
--
-- Until now every client sent its meeting date/time as a naive
-- "YYYY-MM-DDTHH:mm:00" string with no UTC offset, and the API resolved it with
-- `new Date(...)` — i.e. against the *API process's* timezone, which is UTC on
-- the VPS. A meeting scheduled for 10:30 in Dhaka was therefore stored as
-- 10:30Z and read back by every browser as 16:30. Both sides now speak in
-- instants (see `common/instant.ts` and `lib/meetings/datetime.ts`), so the
-- rows written under the old contract have to be re-based.
--
-- Every club on this deployment is in Bangladesh (Asia/Dhaka, UTC+6, no DST),
-- and each stored value is the wall clock someone typed there, so the
-- correction is a flat -6 hours. If a club outside UTC+6 is ever onboarded
-- *before* this runs, split the UPDATE by "clubId" first — there is no stored
-- timezone to derive the offset from.
--
-- Not idempotent: re-running would shift the same rows again. Prisma applies a
-- migration once, which is the only thing keeping that honest.

UPDATE "Meeting"
SET "dateTime" = "dateTime" - interval '6 hours';

-- `PlannerRow.dateTime` is a string column holding the same moment. Old rows
-- are the naive "YYYY-MM-DDTHH:mm" the grid's picker used to format; new ones
-- are full ISO instants. Only the offset-less shape gets converted, so a row
-- written by an already-updated client is left alone.
UPDATE "PlannerRow"
SET "dateTime" = to_char(
      substring("dateTime" from 1 for 16)::timestamp - interval '6 hours',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
WHERE "dateTime" ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}'
  AND "dateTime" !~ '(Z|[+-]\d{2}:?\d{2})$';
