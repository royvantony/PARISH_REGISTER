import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Querying Dioceses matching Mananthavady ---');
  
  // First check distinct diocese names that match or resemble Mananthavady
  const allDioceses = await prisma.family.findMany({
    select: {
      originDiocese: true,
    },
    distinct: ['originDiocese'],
  });

  console.log('All distinct originDioceses in DB:');
  console.log(allDioceses.map(d => d.originDiocese).filter(Boolean).sort());


  // Now query all families with originDiocese matching manan
  const families = await prisma.family.findMany({
    where: {
      originDiocese: {
        contains: 'manan',
        mode: 'insensitive',
      },
    },
    include: {
      unit: true,
      parish: true,
      members: {
        orderBy: {
          orderIndex: 'asc',
        },
      },
    },
    orderBy: [
      { houseName: 'asc' },
    ],
  });

  console.log(`\nFound ${families.length} families from Mananthavady diocese:`);

  let totalMembers = 0;
  for (const f of families) {
    console.log(`\n======================================================`);
    console.log(`🏠 Family / House: ${f.houseName} (${f.familyCode || 'No Code'})`);
    console.log(`📍 Unit / Ward: ${f.unit?.unitName || 'Unassigned'} | Parish: ${f.parish.parishName}`);
    console.log(`⛪ Origin Diocese: ${f.originDiocese} | Origin Parish: ${f.originParish || 'N/A'}`);
    console.log(`👥 Members (${f.members.length}):`);
    for (const m of f.members) {
      totalMembers++;
      console.log(`   - [${m.role}] ${m.fullName} ${m.phone ? `(📞 ${m.phone})` : ''}`);
    }
  }

  // Check if any other records mention Mananthavady in general notes or student metadata
  const otherMatches = await prisma.family.findMany({
    where: {
      NOT: {
        originDiocese: {
          contains: 'manan',
          mode: 'insensitive',
        },
      },
      OR: [
        { generalNotes: { contains: 'mananthavady', mode: 'insensitive' } },
        { originParish: { contains: 'mananthavady', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      houseName: true,
      originDiocese: true,
      originParish: true,
      generalNotes: true,
    },
  });
  console.log('Other families with Mananthavady in notes/parish:', otherMatches);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
