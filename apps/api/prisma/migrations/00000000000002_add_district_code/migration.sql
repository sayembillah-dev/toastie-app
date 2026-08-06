-- Add `code` to District — the short designator (e.g. "D88") the org
-- directory UI shows underneath the district name. Nullable so existing seed
-- rows keep working; new districts created via the API always populate it.

ALTER TABLE "District" ADD COLUMN "code" TEXT;
