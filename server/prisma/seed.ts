import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Parish Register Database Seeding...');

  // 0. Seed Governing Diocese (1-Row Master Table)
  try {
    const existingDiocese: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "Diocese" LIMIT 1;`);
    if (existingDiocese.length === 0) {
      await prisma.$queryRawUnsafe(`
        INSERT INTO "Diocese" ("dioceseName", rite, "bishopName", "chanceryAddress", city, state, "postalCode", "contactPhone", "contactEmail", website, "logoUrl", "updatedAt")
        VALUES (
          'Diocese of St. Thomas the Apostle, Melbourne',
          'Syro-Malabar',
          'Bishop Bosco Puthur',
          '62 Moore Rd, Mill Park VIC 3082, Australia',
          'Melbourne',
          'VIC',
          '3082',
          '+61 3 9404 1533',
          'chancery@syromalabar.org.au',
          'https://syromalabar.org.au',
          '/branding/logo.png',
          CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Governing Diocese seeded: Diocese of St. Thomas the Apostle, Melbourne');
    }
  } catch (err) {
    console.warn('Could not seed Diocese table:', err);
  }

  // 1. Seed Australian Diocesan Parishes
  const parishesData = [
    { parishCode: 'SABN', parishName: 'St. Alphonsa Syro-Malabar Catholic Parish', city: 'Brisbane North', state: 'QLD', postalCode: '4034', contactEmail: 'admin@stalphonsaparishbrisbane.org.au', contactPhone: '0488752642', idPrefix: 'SABN', nextFamilyNumber: 100450 },
    { parishCode: 'SMEL', parishName: 'St. Thomas Syro-Malabar Catholic Cathedral', city: 'Melbourne', state: 'VIC', postalCode: '3047', contactEmail: 'cathedral@syromalabar.org.au', contactPhone: '0390001111', idPrefix: 'SMEL', nextFamilyNumber: 200001 },
    { parishCode: 'SSYD', parishName: 'St. Mary\'s Syro-Malabar Catholic Parish', city: 'Sydney', state: 'NSW', postalCode: '2145', contactEmail: 'sydney@syromalabar.org.au', contactPhone: '0290002222', idPrefix: 'SSYD', nextFamilyNumber: 300001 },
    { parishCode: 'SPER', parishName: 'St. Joseph\'s Syro-Malabar Catholic Parish', city: 'Perth', state: 'WA', postalCode: '6107', contactEmail: 'perth@syromalabar.org.au', contactPhone: '0890003333', idPrefix: 'SPER', nextFamilyNumber: 400001 },
    { parishCode: 'SADL', parishName: 'St. Euphrasia Syro-Malabar Catholic Parish', city: 'Adelaide', state: 'SA', postalCode: '5008', contactEmail: 'adelaide@syromalabar.org.au', contactPhone: '0880004444', idPrefix: 'SADL', nextFamilyNumber: 500001 },
  ];

  let primaryParish = null;
  for (const p of parishesData) {
    const upserted = await prisma.parish.upsert({
      where: { parishCode: p.parishCode },
      update: { parishName: p.parishName, city: p.city, state: p.state },
      create: { ...p, isActive: true },
    });
    if (p.parishCode === 'SABN') primaryParish = upserted;
    console.log(`✅ Parish verified: ${upserted.parishName} (Code: ${upserted.parishCode})`);
  }
  const parish = primaryParish!;

  // 2. Seed Standardized Native Dioceses in India
  const dioceses = [
    // Syro-Malabar (Kerala)
    { dioceseName: 'Ernakulam-Angamaly', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Changanassery', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Thrissur', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Thalassery', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Kottayam', stateInIndia: 'Kerala', rite: 'Syro-Malabar / Knanaya' },
    { dioceseName: 'Pala', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Irinjalakuda', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Kothamangalam', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Kanjirapally', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Idukki', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Palakkad', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Thamarassery', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
    { dioceseName: 'Mananthavady', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },

    // Syro-Malabar (Other States & Mission Eparchies)
    { dioceseName: 'Kalyan', stateInIndia: 'Maharashtra', rite: 'Syro-Malabar' },
    { dioceseName: 'Shamshabad', stateInIndia: 'Telangana', rite: 'Syro-Malabar' },
    { dioceseName: 'Faridabad', stateInIndia: 'Delhi / NCR', rite: 'Syro-Malabar' },
    { dioceseName: 'Ramanathapuram', stateInIndia: 'Tamil Nadu', rite: 'Syro-Malabar' },
    { dioceseName: 'Hosur', stateInIndia: 'Tamil Nadu', rite: 'Syro-Malabar' },
    { dioceseName: 'Mandya', stateInIndia: 'Karnataka', rite: 'Syro-Malabar' },
    { dioceseName: 'Belthangady', stateInIndia: 'Karnataka', rite: 'Syro-Malabar' },
    { dioceseName: 'Bhadravathi', stateInIndia: 'Karnataka', rite: 'Syro-Malabar' },
    { dioceseName: 'Ujjain', stateInIndia: 'Madhya Pradesh', rite: 'Syro-Malabar' },
    { dioceseName: 'Sagar', stateInIndia: 'Madhya Pradesh', rite: 'Syro-Malabar' },
    { dioceseName: 'Satna', stateInIndia: 'Madhya Pradesh', rite: 'Syro-Malabar' },
    { dioceseName: 'Gorakhpur', stateInIndia: 'Uttar Pradesh', rite: 'Syro-Malabar' },
    { dioceseName: 'Bijnor', stateInIndia: 'Uttarakhand', rite: 'Syro-Malabar' },
    { dioceseName: 'Jagdalpur', stateInIndia: 'Chhattisgarh', rite: 'Syro-Malabar' },
    { dioceseName: 'Rajkot', stateInIndia: 'Gujarat', rite: 'Syro-Malabar' },
    { dioceseName: 'Chanda', stateInIndia: 'Maharashtra', rite: 'Syro-Malabar' },
    { dioceseName: 'Adilabad', stateInIndia: 'Telangana', rite: 'Syro-Malabar' },

    // Syro-Malankara
    { dioceseName: 'Trivandrum', stateInIndia: 'Kerala', rite: 'Syro-Malankara' },
    { dioceseName: 'Thiruvalla', stateInIndia: 'Kerala', rite: 'Syro-Malankara' },
    { dioceseName: 'Muvattupuzha', stateInIndia: 'Kerala', rite: 'Syro-Malankara' },
    { dioceseName: 'Mavelikkara', stateInIndia: 'Kerala', rite: 'Syro-Malankara' },
    { dioceseName: 'Pathanamthitta', stateInIndia: 'Kerala', rite: 'Syro-Malankara' },
    { dioceseName: 'Bathery', stateInIndia: 'Kerala', rite: 'Syro-Malankara' },
    { dioceseName: 'Marthandom', stateInIndia: 'Tamil Nadu', rite: 'Syro-Malankara' },
    { dioceseName: 'Puthur', stateInIndia: 'Karnataka', rite: 'Syro-Malankara' },
    { dioceseName: 'Khadki-Pune', stateInIndia: 'Maharashtra', rite: 'Syro-Malankara' },
    { dioceseName: 'Gurgaon', stateInIndia: 'Haryana / NCR', rite: 'Syro-Malankara' },

    // Latin Catholic (Major Kerala & Represented South Indian Dioceses)
    { dioceseName: 'Kottapuram', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Alappuzha', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Calicut', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Quilon', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Cochin', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Verapoly', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Kannur', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Sultanpet', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Vijayapuram', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Neyyattinkara', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Punalur', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    { dioceseName: 'Bangalore', stateInIndia: 'Karnataka', rite: 'Latin Catholic' },
    { dioceseName: 'Chennai', stateInIndia: 'Tamil Nadu', rite: 'Latin Catholic' },
  ];

  for (const d of dioceses) {
    await prisma.nativeDiocese.upsert({
      where: {
        parishId_dioceseName: {
          parishId: parish.id,
          dioceseName: d.dioceseName,
        },
      },
      update: {},
      create: {
        parishId: parish.id,
        ...d,
      },
    });
  }
  console.log(`✅ Seeded ${dioceses.length} Indian dioceses for ${parish.parishName}.`);

  // 3. Seed Default Admin Users
  const defaultPassword = await bcrypt.hash('parishAdmin2026!', 10);
  const devPassword = await bcrypt.hash('DevSuperAdmin2026!', 10);

  // Diocesan Super Admin (Developer)
  await prisma.parishUser.upsert({
    where: { email: 'royvantony@gmail.com' },
    update: {
      fullName: 'Super Admin',
      role: UserRole.DIOCESAN_ADMIN,
      parishId: null,
      isActive: true,
    },
    create: {
      fullName: 'Super Admin',
      email: 'royvantony@gmail.com',
      passwordHash: devPassword,
      role: UserRole.SUPER_ADMIN,
      parishId: null, // Platform Super Admin
      isActive: true,
      mustChangePassword: false,
    },
  });

  // Parish Super Admin (Parish Priest)
  await prisma.parishUser.upsert({
    where: { email: 'priest@stalphonsabrisbane.org.au' },
    update: {
      role: UserRole.PARISH_SUPER_ADMIN,
    },
    create: {
      fullName: 'Fr. Parish Priest',
      email: 'priest@stalphonsabrisbane.org.au',
      passwordHash: defaultPassword,
      role: UserRole.PARISH_SUPER_ADMIN,
      parishId: parish.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  // Parish Admin (Trustee)
  await prisma.parishUser.upsert({
    where: { email: 'trustee@parish.org' },
    update: {
      role: UserRole.PARISH_ADMIN,
    },
    create: {
      fullName: 'Mr. Trustee',
      email: 'trustee@parish.org',
      passwordHash: defaultPassword,
      role: UserRole.PARISH_ADMIN,
      parishId: parish.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  // Parish User (Secretary)
  await prisma.parishUser.upsert({
    where: { email: 'secretary@stalphonsabrisbane.org.au' },
    update: {
      role: UserRole.PARISH_USER,
    },
    create: {
      fullName: 'Parish Secretary',
      email: 'secretary@stalphonsabrisbane.org.au',
      passwordHash: defaultPassword,
      role: UserRole.PARISH_USER,
      parishId: parish.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  console.log('✅ Seeded default Super Admin, Parish Super Admin, Parish Admin (Trustee), and Parish User.');
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
