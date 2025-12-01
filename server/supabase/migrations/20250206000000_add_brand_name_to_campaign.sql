-- Add required brand name to Campaigns
ALTER TABLE "Campaign"
ADD COLUMN IF NOT EXISTS "brandName" TEXT;

-- Set default empty string for any existing NULL values
UPDATE "Campaign"
SET "brandName" = ''
WHERE "brandName" IS NULL;

-- Make the column NOT NULL
ALTER TABLE "Campaign"
ALTER COLUMN "brandName" SET NOT NULL;

