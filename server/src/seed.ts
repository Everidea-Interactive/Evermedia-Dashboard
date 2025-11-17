import 'dotenv/config';
import { PrismaClient, Role, AccountType, CampaignStatus, KPICategory } from '@prisma/client';
import { hashPassword } from './utils/password.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Roles for PICs
  const roleTypes = await Promise.all(
    ['TALENT', 'EDITOR', 'POSTING'].map((name) =>
      prisma.pICRoleType.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  // Users
  const password = await hashPassword('password123');
  const users = [
    { name: 'Admin', email: 'admin@example.com', role: Role.ADMIN },
    { name: 'Manager', email: 'manager@example.com', role: Role.CAMPAIGN_MANAGER },
    { name: 'Operator', email: 'operator@example.com', role: Role.OPERATOR },
    { name: 'Viewer', email: 'viewer@example.com', role: Role.VIEWER },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, role: u.role, passwordHash: password },
    });
  }

  // Accounts
  const [acc1, acc2, acc3] = await Promise.all([
    prisma.account.upsert({
      where: { id: 'acc1' },
      update: {},
      create: { id: 'acc1', name: 'Brand Alpha', accountType: AccountType.BRAND_SPECIFIC, tiktokHandle: '@brandalpha' },
    }),
    prisma.account.upsert({
      where: { id: 'acc2' },
      update: {},
      create: { id: 'acc2', name: 'Brand Beta', accountType: AccountType.CROSSBRAND, tiktokHandle: '@brandbeta' },
    }),
    prisma.account.upsert({
      where: { id: 'acc3' },
      update: {},
      create: { id: 'acc3', name: 'General Channel', accountType: AccountType.CROSSBRAND, tiktokHandle: '@general' },
    }),
  ]);

  // Campaigns
  const today = new Date();
  const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const [camp1, camp2] = await Promise.all([
    prisma.campaign.upsert({
      where: { id: 'camp1' },
      update: {},
      create: {
        id: 'camp1',
        name: 'Q4 Booster',
        categories: ['Electronics', 'Tech'],
        startDate: today,
        endDate: nextMonth,
        status: CampaignStatus.ACTIVE,
        description: 'Drive engagement and sales for Q4',
        accounts: { connect: [{ id: acc1.id }, { id: acc3.id }] },
      },
    }),
    prisma.campaign.upsert({
      where: { id: 'camp2' },
      update: {},
      create: {
        id: 'camp2',
        name: 'New Year Promo',
        categories: ['Lifestyle'],
        startDate: today,
        endDate: nextMonth,
        status: CampaignStatus.PLANNED,
        accounts: { connect: [{ id: acc2.id }, { id: acc3.id }] },
      },
    }),
  ]);

  // PICs with roles
  const [talent, editor, poster, multi] = await Promise.all([
    prisma.pIC.upsert({
      where: { id: 'pic1' },
      update: {},
      create: {
        id: 'pic1', name: 'Alice Talent', active: true,
        roles: { create: [{ roleType: { connect: { name: 'TALENT' } } }] },
      },
    }),
    prisma.pIC.upsert({
      where: { id: 'pic2' },
      update: {},
      create: {
        id: 'pic2', name: 'Bob Editor', active: true,
        roles: { create: [{ roleType: { connect: { name: 'EDITOR' } } }] },
      },
    }),
    prisma.pIC.upsert({
      where: { id: 'pic3' },
      update: {},
      create: {
        id: 'pic3', name: 'Charlie Poster', active: true,
        roles: { create: [{ roleType: { connect: { name: 'POSTING' } } }] },
      },
    }),
    prisma.pIC.upsert({
      where: { id: 'pic4' },
      update: {},
      create: {
        id: 'pic4', name: 'Dana Multi', active: true,
        roles: { create: [
          { roleType: { connect: { name: 'TALENT' } } },
          { roleType: { connect: { name: 'EDITOR' } } },
          { roleType: { connect: { name: 'POSTING' } } },
        ] },
      },
    }),
  ]);

  // KPIs
  await Promise.all([
    prisma.kPI.create({ data: { campaignId: camp1.id, accountId: acc1.id, category: KPICategory.VIEWS, target: 100000, actual: 25000 } }),
    prisma.kPI.create({ data: { campaignId: camp1.id, accountId: acc3.id, category: KPICategory.QTY_POST, target: 20, actual: 5 } }),
    prisma.kPI.create({ data: { campaignId: camp2.id, accountId: acc2.id, category: KPICategory.VIDEO_COUNT, target: 12, actual: 0 } }),
  ]);

  // Posts
  const samplePosts = [
    {
      campaignId: camp1.id, accountId: acc1.id, postTitle: 'Launch Teaser', contentType: 'Video', contentCategory: 'Teaser', status: 'PUBLISHED',
      postDate: new Date(), adsOnMusic: false, yellowCart: true, totalView: 12000, totalLike: 800, totalComment: 150, totalShare: 90, totalSaved: 60,
      picTalentId: talent.id, picEditorId: editor.id, picPostingId: poster.id,
    },
    {
      campaignId: camp1.id, accountId: acc3.id, postTitle: 'Behind the scenes', contentType: 'Video', contentCategory: 'BTS', status: 'PUBLISHED',
      postDate: new Date(), adsOnMusic: true, yellowCart: false, totalView: 8000, totalLike: 500, totalComment: 80, totalShare: 40, totalSaved: 30,
      picTalentId: multi.id, picEditorId: editor.id, picPostingId: poster.id,
    },
  ];
  for (const p of samplePosts) {
    const d = p.postDate;
    const postDay = d.toLocaleDateString('en-US', { weekday: 'long' });
    await prisma.post.create({ data: { ...p, postDay, postDate: d } });
  }

  console.log('Seed completed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

