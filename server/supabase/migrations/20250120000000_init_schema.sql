-- Create enums
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CAMPAIGN_MANAGER', 'OPERATOR', 'VIEWER');
CREATE TYPE "AccountType" AS ENUM ('BRAND_SPECIFIC', 'CROSSBRAND');
CREATE TYPE "CampaignStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'PAUSED');
CREATE TYPE "KPICategory" AS ENUM ('VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR');

-- Create User table (linked to Supabase Auth users)
-- The id field will match Supabase Auth user.id (UUID)
CREATE TABLE "User" (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role "Role" NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Account table
CREATE TABLE "Account" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    "tiktokHandle" TEXT,
    "accountType" "AccountType" NOT NULL,
    brand TEXT,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Campaign table
CREATE TABLE "Campaign" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    categories TEXT[] NOT NULL DEFAULT '{}',
    "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    status "CampaignStatus" NOT NULL,
    description TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create many-to-many relationship table for Campaign-Account
CREATE TABLE "_CampaignToAccount" (
    "A" TEXT NOT NULL REFERENCES "Campaign"(id) ON DELETE CASCADE,
    "B" TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE,
    PRIMARY KEY ("A", "B")
);

-- Create KPI table
CREATE TABLE "KPI" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "campaignId" TEXT NOT NULL REFERENCES "Campaign"(id) ON DELETE CASCADE,
    "accountId" TEXT REFERENCES "Account"(id) ON DELETE SET NULL,
    category "KPICategory" NOT NULL,
    target INTEGER NOT NULL,
    actual INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create PICRoleType table
CREATE TABLE "PICRoleType" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT UNIQUE NOT NULL
);

-- Create PIC table
CREATE TABLE "PIC" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    contact TEXT,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create PICOnRoles junction table
CREATE TABLE "PICOnRoles" (
    "picId" TEXT NOT NULL REFERENCES "PIC"(id) ON DELETE CASCADE,
    "roleTypeId" TEXT NOT NULL REFERENCES "PICRoleType"(id) ON DELETE CASCADE,
    PRIMARY KEY ("picId", "roleTypeId")
);

-- Create Post table
CREATE TABLE "Post" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "campaignId" TEXT NOT NULL REFERENCES "Campaign"(id) ON DELETE CASCADE,
    "accountId" TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE,
    "postDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "postDay" TEXT NOT NULL,
    "picTalentId" TEXT REFERENCES "PIC"(id) ON DELETE SET NULL,
    "picEditorId" TEXT REFERENCES "PIC"(id) ON DELETE SET NULL,
    "picPostingId" TEXT REFERENCES "PIC"(id) ON DELETE SET NULL,
    "contentCategory" TEXT NOT NULL,
    "adsOnMusic" BOOLEAN NOT NULL,
    "yellowCart" BOOLEAN NOT NULL,
    "postTitle" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    status TEXT NOT NULL,
    "contentLink" TEXT,
    "totalView" INTEGER NOT NULL DEFAULT 0,
    "totalLike" INTEGER NOT NULL DEFAULT 0,
    "totalComment" INTEGER NOT NULL DEFAULT 0,
    "totalShare" INTEGER NOT NULL DEFAULT 0,
    "totalSaved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX "Post_campaignId_idx" ON "Post"("campaignId");
CREATE INDEX "Post_accountId_idx" ON "Post"("accountId");
CREATE INDEX "_CampaignToAccount_B_idx" ON "_CampaignToAccount"("B");

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_account_updated_at BEFORE UPDATE ON "Account" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaign_updated_at BEFORE UPDATE ON "Campaign" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kpi_updated_at BEFORE UPDATE ON "KPI" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pic_updated_at BEFORE UPDATE ON "PIC" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_post_updated_at BEFORE UPDATE ON "Post" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

