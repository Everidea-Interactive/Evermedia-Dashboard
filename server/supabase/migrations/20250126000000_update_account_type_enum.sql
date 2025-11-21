-- Update AccountType enum: Remove BRAND_SPECIFIC, Add NEW_PERSONA, KOL, PROXY
-- Keep CROSSBRAND

-- Step 1: Update existing BRAND_SPECIFIC records to CROSSBRAND
UPDATE "Account" SET "accountType" = 'CROSSBRAND' WHERE "accountType" = 'BRAND_SPECIFIC';

-- Step 2: Create new enum type with desired values
CREATE TYPE "AccountType_new" AS ENUM ('CROSSBRAND', 'NEW_PERSONA', 'KOL', 'PROXY');

-- Step 3: Alter the Account table to use the new enum type
-- Convert via text to ensure compatibility
ALTER TABLE "Account" 
  ALTER COLUMN "accountType" TYPE "AccountType_new" 
  USING "accountType"::text::"AccountType_new";

-- Step 4: Drop the old enum type
DROP TYPE "AccountType";

-- Step 5: Rename the new enum type to the original name
ALTER TYPE "AccountType_new" RENAME TO "AccountType";

