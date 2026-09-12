import { PrismaClient } from '@prisma/client';
import { normalisePhone } from '@balsanskar/shared';
import { hashPassword } from '../src/lib/crypto.js';
import { UP_DISTRICTS } from './districts.js';

/**
 * Seeds the reference data every deployment needs, and — only when explicitly
 * asked — a bootstrap administrator.
 *
 * Idempotent: safe to run on every deploy. Reference data is upserted, and the
 * demonstration data is created only when SEED_DEMO=true, so that running this
 * against production cannot invent schools.
 */

const prisma = new PrismaClient();

async function seedDistricts(): Promise<void> {
  for (const district of UP_DISTRICTS) {
    await prisma.district.upsert({
      where: { code: district.code },
      update: {
        nameEn: district.nameEn,
        nameHi: district.nameHi,
        division: district.division,
      },
      create: {
        code: district.code,
        nameEn: district.nameEn,
        nameHi: district.nameHi,
        division: district.division,
      },
    });
  }
  console.log(`Districts: ${UP_DISTRICTS.length} upserted`);
}

/**
 * Creates the first account so that a fresh installation is reachable.
 *
 * Runs only when both variables are set, which keeps a default credential from
 * ever existing. The account is flagged `mustSetPassword` so the holder is
 * pushed to replace whatever was typed into the deployment script.
 */
async function seedSuperAdmin(): Promise<void> {
  const rawPhone = process.env.SEED_SUPER_ADMIN_PHONE;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!rawPhone || !password) {
    console.log('Super admin: skipped (SEED_SUPER_ADMIN_PHONE / _PASSWORD not set)');
    return;
  }
  if (password.length < 12) {
    throw new Error('SEED_SUPER_ADMIN_PASSWORD must be at least 12 characters');
  }
  const phone = normalisePhone(rawPhone);
  if (!phone) throw new Error(`SEED_SUPER_ADMIN_PHONE is not a valid Indian mobile number`);

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    console.log('Super admin: already present, left untouched');
    return;
  }

  await prisma.user.create({
    data: {
      phone,
      fullName: process.env.SEED_SUPER_ADMIN_NAME ?? 'Platform Administrator',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      passwordHash: await hashPassword(password),
      mustSetPassword: true,
      approvedAt: new Date(),
    },
  });
  console.log(`Super admin: created for ${phone.slice(0, 6)}xxxxx`);
}

/**
 * A small, obviously-fake district's worth of data for demonstrations and local
 * development. Never enabled by default.
 */
async function seedDemoData(): Promise<void> {
  if (process.env.SEED_DEMO !== 'true') {
    console.log('Demo data: skipped (set SEED_DEMO=true to create it)');
    return;
  }

  const district = await prisma.district.findUniqueOrThrow({ where: { code: '46' } }); // Shravasti

  const blocks = [
    { code: 'SRV-01', nameEn: 'Jamunaha', nameHi: 'जमुनहा' },
    { code: 'SRV-02', nameEn: 'Sirsiya', nameHi: 'सिरसिया' },
    { code: 'SRV-03', nameEn: 'Gilaula', nameHi: 'गिलौला' },
  ];

  for (const block of blocks) {
    await prisma.block.upsert({
      where: { districtId_code: { districtId: district.id, code: block.code } },
      update: { nameEn: block.nameEn, nameHi: block.nameHi },
      create: { ...block, districtId: district.id },
    });
  }

  const storedBlocks = await prisma.block.findMany({ where: { districtId: district.id } });

  const schools = [
    {
      udise: '09460100101',
      nameHi: 'प्राथमिक विद्यालय रामपुर',
      nameEn: 'Primary School Rampur',
      village: 'Rampur',
    },
    {
      udise: '09460100102',
      nameHi: 'प्राथमिक विद्यालय भिनगा',
      nameEn: 'Primary School Bhinga',
      village: 'Bhinga',
    },
    {
      udise: '09460200103',
      nameHi: 'उच्च प्राथमिक विद्यालय सिरसिया',
      nameEn: 'Upper Primary School Sirsiya',
      village: 'Sirsiya',
    },
    {
      udise: '09460300104',
      nameHi: 'कम्पोजिट विद्यालय गिलौला',
      nameEn: 'Composite School Gilaula',
      village: 'Gilaula',
    },
  ];

  for (const [index, school] of schools.entries()) {
    const block = storedBlocks[index % storedBlocks.length];
    if (!block) continue;
    await prisma.school.upsert({
      where: { udiseCode: school.udise },
      update: {},
      create: {
        udiseCode: school.udise,
        nameHi: school.nameHi,
        nameEn: school.nameEn,
        type: index === 2 ? 'UPPER_PRIMARY' : index === 3 ? 'COMPOSITE' : 'PRIMARY',
        blockId: block.id,
        districtId: district.id,
        villageOrWard: school.village,
      },
    });
  }

  console.log(
    `Demo data: ${blocks.length} blocks and ${schools.length} schools in ${district.nameEn}`,
  );

  /**
   * Two officers, and deliberately nobody below them.
   *
   * A district officer and a block officer cannot arrive through any flow in
   * the product — somebody with more authority has to appoint them — so without
   * these two the claim queue and the clearance queue are unreachable and the
   * platform cannot be evaluated at all.
   *
   * Everyone below that level is left out on purpose. A head teacher arrives by
   * claiming a school and a teacher by registering against one; seeding them
   * would skip the two journeys most worth testing.
   *
   * They sign in by one-time code, which outside production is printed to the
   * log and returned in the response, so these accounts carry no password and
   * no credential exists to leak.
   */
  const gilaula = storedBlocks.find((block) => block.code === 'SRV-03') ?? storedBlocks[0];
  if (!gilaula) return;

  const officers = [
    {
      phone: '+919999900010',
      fullName: 'जनपद समन्वयक (डेमो)',
      role: 'DISTRICT_ADMIN' as const,
      designation: 'जिला बेसिक शिक्षा अधिकारी',
      districtId: district.id,
      blockId: null as string | null,
    },
    {
      phone: '+919999900011',
      fullName: 'खंड शिक्षा अधिकारी (डेमो)',
      role: 'BLOCK_ADMIN' as const,
      designation: 'खंड शिक्षा अधिकारी',
      districtId: district.id,
      blockId: gilaula.id,
    },
  ];

  for (const officer of officers) {
    await prisma.user.upsert({
      where: { phone: officer.phone },
      update: {},
      create: {
        phone: officer.phone,
        fullName: officer.fullName,
        role: officer.role,
        designation: officer.designation,
        status: 'ACTIVE',
        districtId: officer.districtId,
        blockId: officer.blockId,
        approvedAt: new Date(),
      },
    });
  }

  console.log(
    `Demo data: a district officer (9999900010) and a block officer for ` +
      `${gilaula.nameEn} (9999900011), both signing in by one-time code`,
  );
}

async function main(): Promise<void> {
  await seedDistricts();
  await seedSuperAdmin();
  await seedDemoData();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
