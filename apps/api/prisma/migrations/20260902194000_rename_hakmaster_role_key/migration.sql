-- The Harkmaster role key shipped misspelled as 'hakmaster'; rename any
-- existing assignments so they keep resolving against the corrected key.
UPDATE "MeetingRoleAssignment" SET "roleKey" = 'harkmaster' WHERE "roleKey" = 'hakmaster';
