import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth.js';
import { logActivity, getEntityName, computeChangedFields, generateChangeDescription } from '../utils/activityLog.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { role, active } = req.query as any;
  let query = supabase.from('PIC').select('*').order('name', { ascending: true });
  
  if (active === 'true') query = query.eq('active', true);
  if (active === 'false') query = query.eq('active', false);
  
  const { data: pics, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  
  // Get roles for each PIC
  const picIds = (pics || []).map((p: any) => p.id);
  const { data: picRoles } = await supabase
    .from('PICOnRoles')
    .select('picId, roleTypeId')
    .in('picId', picIds);
  
  const roleTypeIds = [...new Set((picRoles || []).map((pr: any) => pr.roleTypeId))];
  const { data: roleTypes } = await supabase
    .from('PICRoleType')
    .select('id, name')
    .in('id', roleTypeIds);
  
  const roleTypeMap = new Map((roleTypes || []).map((rt: any) => [rt.id, rt.name]));
  const picRoleMap = new Map<string, string[]>();
  (picRoles || []).forEach((pr: any) => {
    if (!picRoleMap.has(pr.picId)) {
      picRoleMap.set(pr.picId, []);
    }
    const roleName = roleTypeMap.get(pr.roleTypeId);
    if (roleName) {
      picRoleMap.get(pr.picId)!.push(roleName);
    }
  });
  
  let filtered = (pics || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    contact: p.contact,
    notes: p.notes,
    active: p.active,
    roles: picRoleMap.get(p.id) || [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
  
  if (role) {
    filtered = filtered.filter((p: any) => 
      p.roles.some((r: string) => r.toUpperCase() === String(role).toUpperCase())
    );
  }
  
  res.json(filtered);
});

router.post('/', requireRoles('ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR'), async (req: AuthRequest, res) => {
  const { name, contact, notes, active, roles } = req.body as any;
  if (!name) return res.status(400).json({ error: 'Name required' });
  
  const { data: pic, error: picError } = await supabase
    .from('PIC')
    .insert({ name, contact, notes, active: active ?? true })
    .select()
    .single();
  
  if (picError) return res.status(500).json({ error: picError.message });
  
  // Create role types and links
  const roleTypes = (roles || []) as string[];
  if (roleTypes.length > 0) {
    // Get or create role types
    const roleTypeMap = new Map<string, string>();
    for (const roleName of roleTypes) {
      const upperName = String(roleName).toUpperCase();
      const { data: existing } = await supabase
        .from('PICRoleType')
        .select('id')
        .eq('name', upperName)
        .single();
      
      if (existing) {
        roleTypeMap.set(upperName, existing.id);
      } else {
        const { data: newRoleType } = await supabase
          .from('PICRoleType')
          .insert({ name: upperName })
          .select()
          .single();
        if (newRoleType) {
          roleTypeMap.set(upperName, newRoleType.id);
        }
      }
    }
    
    // Create PICOnRoles links
    const links = Array.from(roleTypeMap.values()).map((roleTypeId) => ({
      picId: pic.id,
      roleTypeId,
    }));
    await supabase.from('PICOnRoles').insert(links);
  }
  
  // Fetch PIC with roles for response
  const { data: picRoles } = await supabase
    .from('PICOnRoles')
    .select('roleTypeId')
    .eq('picId', pic.id);
  
  const roleTypeIds = (picRoles || []).map((pr: any) => pr.roleTypeId);
  const { data: fetchedRoleTypes } = await supabase
    .from('PICRoleType')
    .select('name')
    .in('id', roleTypeIds);
  
  const result = { ...pic, roles: (fetchedRoleTypes || []).map((rt: any) => rt.name) };
  
  // Log activity with specific fields
  const newValues = {
    name: pic.name,
    contact: pic.contact,
    notes: pic.notes,
    active: pic.active,
    roles: result.roles || [],
  };
  
  await logActivity(req, {
    action: 'CREATE',
    entityType: 'PIC',
    entityId: pic.id,
    entityName: getEntityName('PIC', pic),
    newValues,
    description: generateChangeDescription('CREATE', 'PIC', getEntityName('PIC', pic), undefined, newValues),
  });
  
  res.status(201).json(result);
});

router.put('/:id', requireRoles('ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR'), async (req: AuthRequest, res) => {
  const { name, contact, notes, active, roles } = req.body as any;
  
  // Get old PIC data for logging
  const { data: oldPic } = await supabase
    .from('PIC')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (contact !== undefined) updateData.contact = contact;
  if (notes !== undefined) updateData.notes = notes;
  if (active !== undefined) updateData.active = active;
  
  const { data: pic, error: picError } = await supabase
    .from('PIC')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();
  
  if (picError || !pic) return res.status(404).json({ error: 'Not found' });
  
  // Get old roles BEFORE updating them (for logging)
  let oldRoles: string[] = [];
  if (roles !== undefined) {
    const { data: oldPicRoles } = await supabase
      .from('PICOnRoles')
      .select('roleTypeId')
      .eq('picId', req.params.id);
    
    const oldRoleTypeIds = (oldPicRoles || []).map((pr: any) => pr.roleTypeId);
    if (oldRoleTypeIds.length > 0) {
      const { data: oldRoleTypes } = await supabase
        .from('PICRoleType')
        .select('name')
        .in('id', oldRoleTypeIds);
      oldRoles = (oldRoleTypes || []).map((rt: any) => rt.name).sort();
    }
  }
  
  // Update roles if provided
  if (roles !== undefined) {
    await supabase.from('PICOnRoles').delete().eq('picId', req.params.id);
    
    const roleTypes = (roles || []) as string[];
    if (roleTypes.length > 0) {
      const roleTypeMap = new Map<string, string>();
      for (const roleName of roleTypes) {
        const upperName = String(roleName).toUpperCase();
        const { data: existing } = await supabase
          .from('PICRoleType')
          .select('id')
          .eq('name', upperName)
          .single();
        
        if (existing) {
          roleTypeMap.set(upperName, existing.id);
        } else {
          const { data: newRoleType } = await supabase
            .from('PICRoleType')
            .insert({ name: upperName })
            .select()
            .single();
          if (newRoleType) {
            roleTypeMap.set(upperName, newRoleType.id);
          }
        }
      }
      
      const links = Array.from(roleTypeMap.values()).map((roleTypeId) => ({
        picId: req.params.id,
        roleTypeId,
      }));
      await supabase.from('PICOnRoles').insert(links);
    }
  }
  
  // Fetch PIC with roles for response
  const { data: picRoles } = await supabase
    .from('PICOnRoles')
    .select('roleTypeId')
    .eq('picId', req.params.id);
  
  const roleTypeIds = (picRoles || []).map((pr: any) => pr.roleTypeId);
  const { data: fetchedRoleTypes } = await supabase
    .from('PICRoleType')
    .select('name')
    .in('id', roleTypeIds);
  
  const result = { ...pic, roles: (fetchedRoleTypes || []).map((rt: any) => rt.name) };

  // Log activity with specific changed fields only
  const fieldsToCompare = Object.keys(updateData).filter(field => !['createdAt', 'updatedAt', 'id'].includes(field));
  const changedFields = computeChangedFields(
    oldPic,
    pic,
    fieldsToCompare
  );
  
  // Track roles changes if they were updated
  if (roles !== undefined) {
    const newRoles = (result.roles || []).sort();
    
    if (JSON.stringify(oldRoles) !== JSON.stringify(newRoles)) {
      changedFields.roles = {
        before: oldRoles,
        after: newRoles,
      };
    }
  }
  
  // Build oldValues and newValues objects from changedFields
  const oldValues: any = {};
  const newValues: any = {};
  
  for (const [field, change] of Object.entries(changedFields)) {
    oldValues[field] = change.before;
    newValues[field] = change.after;
  }
  
  const hasChanges = Object.keys(oldValues).length > 0;
  
  // Only log if there are actual changes
  if (hasChanges) {
    await logActivity(req, {
      action: 'UPDATE',
      entityType: 'PIC',
      entityId: pic.id,
      entityName: getEntityName('PIC', pic),
      oldValues,
      newValues,
      description: generateChangeDescription('UPDATE', 'PIC', getEntityName('PIC', pic), oldValues, newValues),
    });
  }
  
  res.json(result);
});

router.delete('/:id', async (req: AuthRequest, res) => {
  // Get PIC data for logging before deletion
  const { data: pic } = await supabase
    .from('PIC')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  const { error } = await supabase.from('PIC').delete().eq('id', req.params.id);
  if (error) return res.status(404).json({ error: 'Not found' });
  
  // Log activity with specific fields
  if (pic) {
    const oldValues = {
      name: pic.name,
      contact: pic.contact,
      notes: pic.notes,
      active: pic.active,
    };
    
    await logActivity(req, {
      action: 'DELETE',
      entityType: 'PIC',
      entityId: req.params.id,
      entityName: getEntityName('PIC', pic),
      oldValues,
      description: generateChangeDescription('DELETE', 'PIC', getEntityName('PIC', pic), oldValues),
    });
  }
  
  res.json({ ok: true });
});

export default router;
