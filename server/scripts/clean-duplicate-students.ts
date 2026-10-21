import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDuplicates() {
  console.log('🧹 Scanning database for duplicate members in student/individual registrations...');

  // Find all families
  const families = await prisma.family.findMany({
    include: {
      unit: true,
      members: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  let removedCount = 0;

  for (const family of families) {
    const isStudentOrYouth =
      family.registrationType === 'INDIVIDUAL_STUDENT' ||
      family.registrationType === 'SINGLE_YOUTH' ||
      family.unit?.unitName === 'International-Student' ||
      family.unit?.unitName === 'International-Youth';

    const head = family.members.find((m) => m.role === 'HEAD');
    if (!head) continue;

    const headNameNormalized = head.fullName.trim().toLowerCase();

    // Check for duplicate children or spouse with same name as Head
    const duplicateMembers = family.members.filter((m) => {
      if (m.id === head.id) return false;
      const memberNameNormalized = m.fullName.trim().toLowerCase();

      // Rule: In student registrations, or if child/spouse has exact same name as head
      if (isStudentOrYouth && memberNameNormalized === headNameNormalized) {
        return true;
      }
      return false;
    });

    if (duplicateMembers.length > 0) {
      console.log(`\n📍 Family: "${family.houseName}" (Unit: ${family.unit?.unitName}, Code: ${family.familyCode || 'N/A'})`);
      console.log(`   Head of Family: ${head.fullName} (ID: ${head.id})`);

      for (const dup of duplicateMembers) {
        console.log(`   ❌ Removing duplicate ${dup.role}: "${dup.fullName}" (ID: ${dup.id})`);
        await prisma.familyMember.delete({
          where: { id: dup.id },
        });
        removedCount++;
      }
    }
  }

  console.log(`\n✅ Duplicate cleanup complete! Total duplicate members removed: ${removedCount}`);

  const totalRemainingMembers = await prisma.familyMember.count();
  console.log(`👥 Remaining genuine parishioner members: ${totalRemainingMembers}`);
}

cleanDuplicates()
  .catch((e) => {
    console.error('❌ Error cleaning duplicates:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
