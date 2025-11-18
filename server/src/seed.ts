import 'dotenv/config';
import { supabase } from './supabase.js';

async function main() {
  console.log('Seeding database...');

  // Create Roles for PICs
  const roleTypes = ['TALENT', 'EDITOR', 'POSTING'];
  const roleTypeMap = new Map<string, string>();
  
  for (const name of roleTypes) {
    const { data: existing } = await supabase
      .from('PICRoleType')
      .select('id')
      .eq('name', name)
      .single();
    
    if (existing) {
      roleTypeMap.set(name, existing.id);
    } else {
      const { data: newRole } = await supabase
        .from('PICRoleType')
        .insert({ name })
        .select()
        .single();
      if (newRole) {
        roleTypeMap.set(name, newRole.id);
      }
    }
  }

  // Users - Create in Supabase Auth first, then in User table
  const password = 'password123';
  const users = [
    { name: 'Admin', email: 'admin@example.com', role: 'ADMIN' },
    { name: 'Manager', email: 'manager@example.com', role: 'CAMPAIGN_MANAGER' },
    { name: 'Operator', email: 'operator@example.com', role: 'OPERATOR' },
    { name: 'Viewer', email: 'viewer@example.com', role: 'VIEWER' },
  ];
  
  for (const u of users) {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('User')
      .select('id')
      .eq('email', u.email)
      .single();
    
    if (existingUser) {
      console.log(`User ${u.email} already exists, skipping...`);
      continue;
    }
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
    });
    
    if (authError) {
      console.error(`Failed to create auth user ${u.email}:`, authError.message);
      continue;
    }
    
    // Create user record in database
    await supabase
      .from('User')
      .upsert({
        id: authData.user.id,
        name: u.name,
        email: u.email,
        role: u.role,
      });
  }

  // Accounts
  const accounts = [
    { id: 'acc1', name: 'Brand Alpha', accountType: 'BRAND_SPECIFIC', tiktokHandle: '@brandalpha' },
    { id: 'acc2', name: 'Brand Beta', accountType: 'CROSSBRAND', tiktokHandle: '@brandbeta' },
    { id: 'acc3', name: 'General Channel', accountType: 'CROSSBRAND', tiktokHandle: '@general' },
  ];
  
  for (const acc of accounts) {
    await supabase
      .from('Account')
      .upsert(acc, { onConflict: 'id' });
  }
  
  const [acc1, acc2, acc3] = accounts;

  // Campaigns
  const today = new Date();
  const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const campaigns = [
    {
      id: 'camp1',
      name: 'Q4 Booster',
      categories: ['Electronics', 'Tech'],
      startDate: today.toISOString(),
      endDate: nextMonth.toISOString(),
      status: 'ACTIVE',
      description: 'Drive engagement and sales for Q4',
    },
    {
      id: 'camp2',
      name: 'New Year Promo',
      categories: ['Lifestyle'],
      startDate: today.toISOString(),
      endDate: nextMonth.toISOString(),
      status: 'PLANNED',
    },
  ];
  
  for (const camp of campaigns) {
    await supabase
      .from('Campaign')
      .upsert(camp, { onConflict: 'id' });
  }
  
  // Link campaigns to accounts
  await supabase.from('_CampaignToAccount').upsert([
    { A: 'camp1', B: 'acc1' },
    { A: 'camp1', B: 'acc3' },
    { A: 'camp2', B: 'acc2' },
    { A: 'camp2', B: 'acc3' },
  ], { onConflict: 'A,B' });

  // PICs with roles
  const pics = [
    { id: 'pic1', name: 'Alice Talent', active: true, roles: ['TALENT'] },
    { id: 'pic2', name: 'Bob Editor', active: true, roles: ['EDITOR'] },
    { id: 'pic3', name: 'Charlie Poster', active: true, roles: ['POSTING'] },
    { id: 'pic4', name: 'Dana Multi', active: true, roles: ['TALENT', 'EDITOR', 'POSTING'] },
  ];
  
  for (const pic of pics) {
    const { id, roles, ...picData } = pic;
    await supabase
      .from('PIC')
      .upsert({ id, ...picData }, { onConflict: 'id' });
    
    // Delete existing roles
    await supabase.from('PICOnRoles').delete().eq('picId', id);
    
    // Add roles
    if (roles.length > 0) {
      const links = roles.map((roleName) => ({
        picId: id,
        roleTypeId: roleTypeMap.get(roleName)!,
      }));
      await supabase.from('PICOnRoles').insert(links);
    }
  }
  
  const [talent, editor, poster, multi] = pics;

  // KPIs
  await supabase.from('KPI').upsert([
    { campaignId: 'camp1', accountId: 'acc1', category: 'VIEWS', target: 100000, actual: 25000 },
    { campaignId: 'camp1', accountId: 'acc3', category: 'QTY_POST', target: 20, actual: 5 },
    { campaignId: 'camp2', accountId: 'acc2', category: 'VIDEO_COUNT', target: 12, actual: 0 },
  ], { onConflict: 'id' });

  // Posts
  const samplePosts = [
    {
      campaignId: 'camp1',
      accountId: 'acc1',
      postTitle: 'Launch Teaser',
      contentType: 'Video',
      contentCategory: 'Teaser',
      status: 'PUBLISHED',
      postDate: new Date().toISOString(),
      adsOnMusic: false,
      yellowCart: true,
      totalView: 12000,
      totalLike: 800,
      totalComment: 150,
      totalShare: 90,
      totalSaved: 60,
      picTalentId: 'pic1',
      picEditorId: 'pic2',
      picPostingId: 'pic3',
    },
    {
      campaignId: 'camp1',
      accountId: 'acc3',
      postTitle: 'Behind the scenes',
      contentType: 'Video',
      contentCategory: 'BTS',
      status: 'PUBLISHED',
      postDate: new Date().toISOString(),
      adsOnMusic: true,
      yellowCart: false,
      totalView: 8000,
      totalLike: 500,
      totalComment: 80,
      totalShare: 40,
      totalSaved: 30,
      picTalentId: 'pic4',
      picEditorId: 'pic2',
      picPostingId: 'pic3',
    },
  ];
  
  for (const p of samplePosts) {
    const d = new Date(p.postDate);
    const postDay = d.toLocaleDateString('en-US', { weekday: 'long' });
    await supabase.from('Post').insert({
      ...p,
      postDay,
    });
  }

  console.log('Seed completed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
