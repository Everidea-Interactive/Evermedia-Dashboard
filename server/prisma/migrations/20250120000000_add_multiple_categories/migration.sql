-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "categories" TEXT[];

-- Migrate existing category data to categories array
UPDATE "Campaign" SET "categories" = ARRAY["category"] WHERE "category" IS NOT NULL;

-- Make categories required (set empty array for any nulls)
UPDATE "Campaign" SET "categories" = ARRAY[]::TEXT[] WHERE "categories" IS NULL;
ALTER TABLE "Campaign" ALTER COLUMN "categories" SET NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "categories" SET DEFAULT ARRAY[]::TEXT[];

-- Drop the old category column
ALTER TABLE "Campaign" DROP COLUMN "category";

