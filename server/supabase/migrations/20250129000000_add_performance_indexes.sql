-- Add performance indexes for faster CRUD operations
-- These indexes will significantly improve query performance for common operations

-- Index for CampaignToAccount lookups by Campaign (A column)
-- Used in: campaigns.ts GET /:id, campaigns.ts PUT /:id
CREATE INDEX IF NOT EXISTS "_CampaignToAccount_A_idx" ON "_CampaignToAccount"("A");

-- Indexes for KPI queries by campaignId and accountId
-- Used in: kpiRecalculation.ts, kpis.ts routes
CREATE INDEX IF NOT EXISTS "KPI_campaignId_idx" ON "KPI"("campaignId");
CREATE INDEX IF NOT EXISTS "KPI_accountId_idx" ON "KPI"("accountId");

-- Composite index for KPI queries filtering by both campaignId and accountId
-- Used in: kpiRecalculation.ts recalculateKPIs function
CREATE INDEX IF NOT EXISTS "KPI_campaignId_accountId_idx" ON "KPI"("campaignId", "accountId");

-- Index for Post queries by postDate (used in date filtering)
-- Used in: posts.ts GET /, campaigns.ts GET /:id/posts
CREATE INDEX IF NOT EXISTS "Post_postDate_idx" ON "Post"("postDate");

-- Composite index for Post queries filtering by campaignId and accountId
-- Used in: posts.ts routes, kpiRecalculation.ts
CREATE INDEX IF NOT EXISTS "Post_campaignId_accountId_idx" ON "Post"("campaignId", "accountId");

-- Index for Account searches by tiktokHandle
-- Used in: accounts.ts GET / with search filter
CREATE INDEX IF NOT EXISTS "Account_tiktokHandle_idx" ON "Account"("tiktokHandle");

-- Index for Account filtering by accountType
-- Used in: accounts.ts GET / with accountType filter
CREATE INDEX IF NOT EXISTS "Account_accountType_idx" ON "Account"("accountType");

