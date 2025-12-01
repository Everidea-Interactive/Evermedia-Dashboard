-- Add optional quotation number to Campaigns for tracking
ALTER TABLE "Campaign"
ADD COLUMN IF NOT EXISTS "quotationNumber" TEXT;
