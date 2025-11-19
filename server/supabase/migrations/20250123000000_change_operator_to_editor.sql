-- Change OPERATOR role to EDITOR in the Role enum
-- Add EDITOR to the enum first
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EDITOR';

-- Update all users with OPERATOR role to EDITOR
UPDATE "User" SET role = 'EDITOR' WHERE role = 'OPERATOR';

-- Note: PostgreSQL doesn't support removing enum values directly
-- OPERATOR will remain in the enum but should not be used
-- All new users should use EDITOR instead

