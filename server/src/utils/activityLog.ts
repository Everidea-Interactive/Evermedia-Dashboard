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
  description?: string;
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
      description: data.description || null,
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

/**
 * Fields that should be excluded from change detection (automatic timestamps, etc.)
 */
const EXCLUDED_FIELDS = ['createdAt', 'updatedAt', 'id'];

/**
 * Computes a diff object showing only changed fields with before/after values
 * @param oldValues - The old/previous values
 * @param newValues - The new/updated values
 * @param fieldsToCompare - Optional array of field names to compare. If not provided, compares all fields in newValues
 * @returns An object with only changed fields, each containing { before, after }
 */
export function computeChangedFields(
  oldValues: any,
  newValues: any,
  fieldsToCompare?: string[]
): { [key: string]: { before: any; after: any } } {
  if (!oldValues || !newValues) {
    return {};
  }

  const changedFields: { [key: string]: { before: any; after: any } } = {};
  const fields = fieldsToCompare || Object.keys(newValues);

  for (const field of fields) {
    // Skip excluded fields (timestamps, IDs, etc.)
    if (EXCLUDED_FIELDS.includes(field)) {
      continue;
    }
    
    const oldValue = oldValues[field];
    const newValue = newValues[field];

    // Deep comparison for arrays and objects
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changedFields[field] = {
        before: oldValue,
        after: newValue,
      };
    }
  }

  return changedFields;
}

/**
 * Formats a field name for display (converts camelCase to Title Case)
 */
function formatFieldName(field: string): string {
  // Special handling for common field names
  const fieldNameMap: { [key: string]: string } = {
    totalView: 'Views',
    totalLike: 'Likes',
    totalComment: 'Comments',
    totalShare: 'Shares',
    totalSaved: 'Saves',
    postTitle: 'Title',
    postDate: 'Post Date',
    contentCategory: 'Category',
    contentType: 'Content Type',
    adsOnMusic: 'Ads on Music',
    yellowCart: 'Yellow Cart',
    targetViewsForFYP: 'Target Views for FYP',
    accountIds: 'Accounts',
    campaignIds: 'Campaigns',
    category: 'Category',
    password: 'Password',
    roles: 'Roles',
    target: 'Target',
    actual: 'Actual',
    campaignId: 'Campaign',
    accountId: 'Account',
  };
  
  if (fieldNameMap[field]) {
    return fieldNameMap[field];
  }
  
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Formats a value for display in descriptions
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none';
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }
  return String(value);
}

/**
 * Generates a human-readable description of what changed
 * @param action - The action type (CREATE, UPDATE, DELETE)
 * @param entityType - The type of entity
 * @param entityName - The name of the entity
 * @param oldValues - Old values (for UPDATE/DELETE)
 * @param newValues - New values (for CREATE/UPDATE)
 * @returns A human-readable description string
 */
export function generateChangeDescription(
  action: ActionType,
  entityType: EntityType,
  entityName?: string,
  oldValues?: any,
  newValues?: any
): string {
  const entityDisplayName = entityName || entityType;
  
  switch (action) {
    case 'CREATE':
      if (!newValues || Object.keys(newValues).length === 0) {
        return `Created ${entityType}${entityName ? ` "${entityName}"` : ''}`;
      }
      
      const createFields: string[] = [];
      
      // Campaign fields
      if (newValues.name) createFields.push(`name: "${newValues.name}"`);
      if (newValues.categories && Array.isArray(newValues.categories)) {
        createFields.push(`categories: ${newValues.categories.join(', ')}`);
      }
      if (newValues.status) createFields.push(`status: ${newValues.status}`);
      if (newValues.startDate) createFields.push(`start date: ${new Date(newValues.startDate).toLocaleDateString()}`);
      if (newValues.endDate) createFields.push(`end date: ${new Date(newValues.endDate).toLocaleDateString()}`);
      if (newValues.targetViewsForFYP !== undefined && newValues.targetViewsForFYP !== null) {
        createFields.push(`target views for FYP: ${newValues.targetViewsForFYP}`);
      }
      if (newValues.accountIds && Array.isArray(newValues.accountIds) && newValues.accountIds.length > 0) {
        createFields.push(`linked ${newValues.accountIds.length} account(s)`);
      }
      
      // Post fields
      if (newValues.postTitle) createFields.push(`title: "${newValues.postTitle}"`);
      if (newValues.contentCategory) createFields.push(`category: ${newValues.contentCategory}`);
      if (newValues.postDate) createFields.push(`post date: ${new Date(newValues.postDate).toLocaleDateString()}`);
      if (newValues.totalView !== undefined) createFields.push(`views: ${newValues.totalView}`);
      if (newValues.totalLike !== undefined) createFields.push(`likes: ${newValues.totalLike}`);
      if (newValues.totalComment !== undefined) createFields.push(`comments: ${newValues.totalComment}`);
      if (newValues.totalShare !== undefined) createFields.push(`shares: ${newValues.totalShare}`);
      if (newValues.totalSaved !== undefined) createFields.push(`saves: ${newValues.totalSaved}`);
      
      // KPI fields
      if (newValues.category) createFields.push(`category: ${newValues.category}`);
      if (newValues.target !== undefined) createFields.push(`target: ${newValues.target}`);
      if (newValues.actual !== undefined) createFields.push(`actual: ${newValues.actual}`);
      if (newValues.accountId) createFields.push(`for account: ${newValues.accountId}`);
      if (!newValues.accountId && newValues.campaignId) createFields.push(`for campaign: ${newValues.campaignId}`);
      
      // User fields
      if (newValues.name) createFields.push(`name: "${newValues.name}"`);
      if (newValues.email) createFields.push(`email: ${newValues.email}`);
      if (newValues.role) createFields.push(`role: ${newValues.role}`);
      
      // Account fields
      if (newValues.tiktokHandle) createFields.push(`TikTok handle: ${newValues.tiktokHandle}`);
      if (newValues.accountType) createFields.push(`account type: ${newValues.accountType}`);
      if (newValues.brand) createFields.push(`brand: ${newValues.brand}`);
      if (newValues.campaignIds && Array.isArray(newValues.campaignIds) && newValues.campaignIds.length > 0) {
        createFields.push(`linked ${newValues.campaignIds.length} campaign(s)`);
      }
      
      // PIC fields
      if (newValues.contact) createFields.push(`contact: ${newValues.contact}`);
      if (newValues.active !== undefined) createFields.push(`active: ${newValues.active ? 'Yes' : 'No'}`);
      if (newValues.roles && Array.isArray(newValues.roles) && newValues.roles.length > 0) {
        createFields.push(`roles: ${newValues.roles.join(', ')}`);
      }
      
      const createDesc = createFields.length > 0 
        ? `Created ${entityType} "${entityName || 'unnamed'}" with ${createFields.join(', ')}`
        : `Created ${entityType}${entityName ? ` "${entityName}"` : ''}`;
      
      return createDesc;
      
    case 'UPDATE':
      if (!oldValues || !newValues || Object.keys(newValues).length === 0) {
        return `Updated ${entityType}${entityName ? ` "${entityName}"` : ''}`;
      }
      
      const changes: string[] = [];
      
      for (const [field, newVal] of Object.entries(newValues)) {
        // Skip excluded fields (timestamps, IDs, etc.)
        if (EXCLUDED_FIELDS.includes(field)) {
          continue;
        }
        
        const oldVal = oldValues[field];
        
        // Skip if values are the same
        if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
          continue;
        }
        
        const fieldName = formatFieldName(field);
        const oldFormatted = formatValue(oldVal);
        const newFormatted = formatValue(newVal);
        
        // Handle account links
        if (field === 'accountIds') {
          const oldCount = Array.isArray(oldVal) ? oldVal.length : 0;
          const newCount = Array.isArray(newVal) ? newVal.length : 0;
          if (oldCount !== newCount) {
            changes.push(`${fieldName}: ${oldCount} → ${newCount} account(s)`);
          }
        } 
        // Handle categories arrays
        else if (field === 'categories' && Array.isArray(oldVal) && Array.isArray(newVal)) {
          changes.push(`${fieldName}: [${oldVal.join(', ')}] → [${newVal.join(', ')}]`);
        } 
        // Handle date fields
        else if (field === 'startDate' || field === 'endDate' || field === 'postDate') {
          const oldDate = oldVal ? new Date(oldVal).toLocaleDateString() : 'null';
          const newDate = newVal ? new Date(newVal).toLocaleDateString() : 'null';
          changes.push(`${fieldName}: ${oldDate} → ${newDate}`);
        }
        // Handle Post stats fields (numbers without quotes)
        else if (field === 'totalView' || field === 'totalLike' || field === 'totalComment' || 
                 field === 'totalShare' || field === 'totalSaved') {
          const oldNum = oldVal ?? 0;
          const newNum = newVal ?? 0;
          changes.push(`${fieldName}: ${oldNum} → ${newNum}`);
        }
        // Handle KPI numeric fields (target, actual)
        else if (field === 'target' || field === 'actual') {
          const oldNum = oldVal ?? 0;
          const newNum = newVal ?? 0;
          changes.push(`${fieldName}: ${oldNum} → ${newNum}`);
        }
        // Handle boolean fields
        else if (field === 'adsOnMusic' || field === 'yellowCart') {
          const oldBool = oldVal ? 'Yes' : 'No';
          const newBool = newVal ? 'Yes' : 'No';
          changes.push(`${fieldName}: ${oldBool} → ${newBool}`);
        }
        // Handle numeric fields
        else if (typeof oldVal === 'number' && typeof newVal === 'number') {
          changes.push(`${fieldName}: ${oldVal} → ${newVal}`);
        }
        // Default: string fields with quotes
        else {
          changes.push(`${fieldName}: "${oldFormatted}" → "${newFormatted}"`);
        }
      }
      
      if (changes.length === 0) {
        return `Updated ${entityType}${entityName ? ` "${entityName}"` : ''} (no changes detected)`;
      }
      
      return `Updated ${entityType} "${entityName || 'unnamed'}": ${changes.join(', ')}`;
      
    case 'DELETE':
      const deleteFields: string[] = [];
      
      // Campaign fields
      if (oldValues?.name) deleteFields.push(`"${oldValues.name}"`);
      if (oldValues?.categories && Array.isArray(oldValues.categories)) {
        deleteFields.push(`categories: ${oldValues.categories.join(', ')}`);
      }
      if (oldValues?.status) deleteFields.push(`status: ${oldValues.status}`);
      
      // Post fields
      if (oldValues?.postTitle) deleteFields.push(`"${oldValues.postTitle}"`);
      if (oldValues?.contentCategory) deleteFields.push(`category: ${oldValues.contentCategory}`);
      
      // KPI fields
      if (oldValues?.category) deleteFields.push(`category: ${oldValues.category}`);
      if (oldValues?.target !== undefined) deleteFields.push(`target: ${oldValues.target}`);
      if (oldValues?.actual !== undefined) deleteFields.push(`actual: ${oldValues.actual}`);
      
      return `Deleted ${entityType}${deleteFields.length > 0 ? ` ${deleteFields.join(', ')}` : entityName ? ` "${entityName}"` : ''}`;
      
    default:
      return `${action} ${entityType}${entityName ? ` "${entityName}"` : ''}`;
  }
}

