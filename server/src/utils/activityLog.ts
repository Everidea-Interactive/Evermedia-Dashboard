import { supabase } from '../supabase.js';
import { AuthRequest } from '../middleware/auth.js';

export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE';
export type EntityType = 'Campaign' | 'Account' | 'Post' | 'User' | 'KPI' | 'PIC';

export interface ActivityLogData {
  action: ActionType;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  oldValues?: any;
  newValues?: any;
}

/**
 * Logs an activity to the ActivityLog table
 * @param req - The authenticated request object
 * @param data - The activity log data
 */
export async function logActivity(req: AuthRequest, data: ActivityLogData): Promise<void> {
  try {
    if (!req.user) {
      console.warn('Cannot log activity: user not authenticated');
      return;
    }

    await supabase.from('ActivityLog').insert({
      userId: req.user.id,
      userName: req.user.name || 'Unknown',
      userEmail: req.user.email,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      entityName: data.entityName,
      oldValues: data.oldValues || null,
      newValues: data.newValues || null,
    });
  } catch (error) {
    // Don't throw errors - logging should not break the main flow
    console.error('Failed to log activity:', error);
  }
}

/**
 * Helper function to extract entity name from entity data
 */
export function getEntityName(entityType: EntityType, entity: any): string | undefined {
  switch (entityType) {
    case 'Campaign':
      return entity?.name;
    case 'Account':
      return entity?.name;
    case 'Post':
      return entity?.postTitle;
    case 'User':
      return entity?.name || entity?.email;
    case 'KPI':
      return `${entity?.category} - ${entity?.campaignId}`;
    case 'PIC':
      return entity?.name;
    default:
      return undefined;
  }
}

