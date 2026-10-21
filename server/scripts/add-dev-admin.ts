import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'dev@diocese.org.au';
  const plainPassword = 'DevSuperAdmin2026!';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const devUser = await prisma.parishUser.upsert({
    where: { email },
    update: {
      role: UserRole.DIOCESAN_ADMIN,
      parishId: null, // Global access across all parishes
      isActive: true,
      passwordHash: passwordHash,
    },
    create: {
      fullName: 'Diocesan Super Admin (Developer)',
      email: email,
      passwordHash: passwordHash,
      role: UserRole.DIOCESAN_ADMIN,
      parishId: null, // Global access across all parishes
      isActive: true,
    },
  });

  console.log('\n=========================================');
  console.log('  DEVELOPER / DIOCESAN SUPER ADMIN CREATED');
  console.log('=========================================');
  console.log(`👤 Name:     ${devUser.fullName}`);
  console.log(`📧 Email:    ${devUser.email}`);
  console.log(`🔑 Password: ${plainPassword}`);
  console.log(`🛡️ Role:     ${devUser.role}`);
  console.log(`🏛️ Parish:   NULL (Full Diocese-Wide Access)`);
  console.log('=========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Failed to create developer account:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
