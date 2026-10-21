import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const families = await prisma.family.count();
  const members = await prisma.familyMember.count();
  const docs = await prisma.familyDocument.count();
  const notes = await prisma.familyNote.count();
  
  const byType = await prisma.family.groupBy({
    by: ['registrationType'],
    _count: true,
  });

  const units = await prisma.familyUnit.findMany({
    include: { _count: { select: { families: true } } },
    orderBy: { families: { _count: 'desc' } },
  });

  console.log('\n=========================================');
  console.log('   PARISH DATABASE IMPORT REPORT');
  console.log('=========================================');
  console.log(`👨‍👩‍👧‍👦 Total Households/Files: ${families}`);
  console.log(`👥 Total Individual Members: ${members}`);
  console.log(`📑 Total Documents & Signatures: ${docs}`);
  console.log(`📝 Total Historical Notes/Remarks: ${notes}`);
  console.log('\n--- BY REGISTRATION TYPE ---');
  byType.forEach(t => console.log(`• ${t.registrationType}: ${t._count} records`));
  console.log('\n--- BY PARISH UNIT / WARD ---');
  units.forEach(u => console.log(`• ${u.unitName} (${u.category}): ${u._count.families} families`));
  console.log('=========================================\n');
}

main().finally(async () => {
  await prisma.$disconnect();
});
