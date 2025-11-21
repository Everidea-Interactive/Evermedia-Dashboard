-- Enable Row Level Security (RLS) on all tables
-- This migration enables RLS and creates policies that deny direct access
-- All data access should go through the backend API which uses the service role key

-- Enable RLS on User table
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on Account table
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on Campaign table
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on _CampaignToAccount junction table
ALTER TABLE "_CampaignToAccount" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on KPI table
ALTER TABLE "KPI" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on PICRoleType table
ALTER TABLE "PICRoleType" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on PIC table
ALTER TABLE "PIC" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on PICOnRoles junction table
ALTER TABLE "PICOnRoles" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on Post table
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on ActivityLog table
ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;

-- Create policies that deny all operations for anon and authenticated users
-- This ensures only the service role (used by backend) can access data
-- The service role key bypasses RLS, so backend operations will continue to work

-- User table policies
CREATE POLICY "Deny all for anon users" ON "User"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all for authenticated users" ON "User"
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Account table policies
CREATE POLICY "Deny all for anon users" ON "Account"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all for authenticated users" ON "Account"
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Campaign table policies
CREATE POLICY "Deny all for anon users" ON "Campaign"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all for authenticated users" ON "Campaign"
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- _CampaignToAccount junction table policies
CREATE POLICY "Deny all for anon users" ON "_CampaignToAccount"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all for authenticated users" ON "_CampaignToAccount"
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- KPI table policies
CREATE POLICY "Deny all for anon users" ON "KPI"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all for authenticated users" ON "KPI"
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- PICRoleType table policies
CREATE POLICY "Deny all for anon users" ON "PICRoleType"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all for authenticated users" ON "PICRoleType"
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- PIC table policies
CREATE POLICY "Deny all for anon users" ON "PIC"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all for authenticated users" ON "PIC"
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- PICOnRoles junction table policies
CREATE POLICY "Deny all for anon users" ON "PICOnRoles"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all for authenticated users" ON "PICOnRoles"
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Post table policies
CREATE POLICY "Deny all for anon users" ON "Post"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all for authenticated users" ON "Post"
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ActivityLog table policies
CREATE POLICY "Deny all for anon users" ON "ActivityLog"
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all for authenticated users" ON "ActivityLog"
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

