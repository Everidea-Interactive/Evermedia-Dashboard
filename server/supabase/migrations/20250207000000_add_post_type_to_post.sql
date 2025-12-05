-- Add fypType field to Post table
-- This field indicates whether a post is Organic (ORG) or Ads (ADS)
ALTER TABLE "Post"
ADD COLUMN IF NOT EXISTS "fypType" TEXT CHECK ("fypType" IN ('ORG', 'ADS'));

