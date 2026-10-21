import { PrismaClient, MemberRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Syncing headFullName for all families...');

  const families = await prisma.family.findMany({
    include: {
      members: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  let count = 0;
  for (const f of families) {
    const head = f.members.find((m) => m.role === MemberRole.HEAD) || f.members[0];
    const headName = head ? head.fullName.trim() : f.houseName;

    await prisma.$executeRawUnsafe(
      'UPDATE "Family" SET "headFullName" = $1 WHERE id = $2',
      headName,
      f.id
    );
    count++;
  }

  console.log(`✅ Successfully updated headFullName for ${count} families.`);
}

main()
  .catch((e) => {
    console.error('Error syncing head names:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
