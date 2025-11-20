-- Add description field to ActivityLog table for human-readable change summaries
ALTER TABLE "ActivityLog" ADD COLUMN "description" TEXT;

-- Create index for better query performance
CREATE INDEX "ActivityLog_description_idx" ON "ActivityLog"("description");

