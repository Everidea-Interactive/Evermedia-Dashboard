-- SQL to delete all post data from "Biodef Proxy Nov 2025" campaign
-- This script will:
-- 1. Delete all posts for the campaign
-- 2. Reset all KPI actual values to 0 (since there are no posts to calculate from)

-- Step 1: Delete all posts for the campaign
DELETE FROM "Post"
WHERE "campaignId" = (
    SELECT id 
    FROM "Campaign" 
    WHERE name = 'Biodef Proxy Nov 2025'
);

-- Step 2: Reset all KPI actual values to 0 for the campaign
-- This includes both campaign-level KPIs (accountId IS NULL) and account-level KPIs
UPDATE "KPI"
SET actual = 0
WHERE "campaignId" = (
    SELECT id 
    FROM "Campaign" 
    WHERE name = 'Biodef Proxy Nov 2025'
);

-- ============================================================================
-- VERIFICATION QUERIES (run these before executing the delete/update above)
-- ============================================================================

-- Verify campaign exists and get its ID
-- SELECT id, name FROM "Campaign" WHERE name = 'Biodef Proxy Nov 2025';

-- Check how many posts will be deleted
-- SELECT COUNT(*) as post_count 
-- FROM "Post" 
-- WHERE "campaignId" = (
--     SELECT id 
--     FROM "Campaign" 
--     WHERE name = 'Biodef Proxy Nov 2025'
-- );

-- Check current KPI actual values that will be reset
-- SELECT id, category, "accountId", target, actual
-- FROM "KPI"
-- WHERE "campaignId" = (
--     SELECT id 
--     FROM "Campaign" 
--     WHERE name = 'Biodef Proxy Nov 2025'
-- );

-- ============================================================================
-- ALTERNATIVE: Two-step approach (safer for verification)
-- ============================================================================
-- Step 1: Get the campaign ID first
-- SELECT id FROM "Campaign" WHERE name = 'Biodef Proxy Nov 2025';
--
-- Step 2: Replace 'CAMPAIGN_ID_HERE' with the actual ID from step 1
-- DELETE FROM "Post" WHERE "campaignId" = 'CAMPAIGN_ID_HERE';
-- UPDATE "KPI" SET actual = 0 WHERE "campaignId" = 'CAMPAIGN_ID_HERE';

-- ============================================================================
-- NOTES:
-- ============================================================================
-- - This will delete all posts associated with the campaign
-- - KPI actual values will be reset to 0 (target values remain unchanged)
-- - The campaign itself and account links will remain intact
-- - This action cannot be undone, so verify first using the queries above

