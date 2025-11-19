-- Create ActivityLog table for tracking add/edit/delete history
CREATE TABLE "ActivityLog" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE SET NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    "entityType" TEXT NOT NULL, -- 'Campaign', 'Account', 'Post', 'User', 'KPI', 'PIC'
    "entityId" TEXT NOT NULL,
    "entityName" TEXT, -- Human-readable name of the entity (e.g., campaign name, account name)
    "oldValues" JSONB, -- Previous values for UPDATE actions
    "newValues" JSONB, -- New values for CREATE/UPDATE actions
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX "ActivityLog_entityType_idx" ON "ActivityLog"("entityType");
CREATE INDEX "ActivityLog_entityId_idx" ON "ActivityLog"("entityId");
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt" DESC);

