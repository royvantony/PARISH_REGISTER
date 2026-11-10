import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillComments() {
  const csvPath = path.resolve(__dirname, '../../data/parish_register_master.csv');
  console.log(`Reading CSV from: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(csvPath, 'utf8');
  const records: Record<string, string>[] = parse(rawContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Total rows in CSV: ${records.length}`);

  // Fetch all existing families
  const allFamilies = await prisma.family.findMany({
    include: {
      members: true,
    },
  });
  console.log(`Total families in DB: ${allFamilies.length}`);

  // Build lookups
  // 1. familyCode
  const byFamilyCode = new Map<string, typeof allFamilies[0]>();
  // 2. houseName (normalized)
  const byHouseName = new Map<string, typeof allFamilies[0]>();
  // 3. headFullName (normalized)
  const byHeadName = new Map<string, typeof allFamilies[0]>();

  for (const f of allFamilies) {
    if (f.familyCode) {
      byFamilyCode.set(f.familyCode.trim().toUpperCase(), f);
    }
    if (f.houseName) {
      const norm = f.houseName.trim().toLowerCase();
      if (!byHouseName.has(norm)) {
        byHouseName.set(norm, f);
      }
    }
    if (f.headFullName) {
      const norm = f.headFullName.trim().toLowerCase();
      if (!byHeadName.has(norm)) {
        byHeadName.set(norm, f);
      }
    }
    // Also add HEAD member if present
    const headMember = f.members.find((m) => m.role === 'HEAD');
    if (headMember && headMember.fullName) {
      const norm = headMember.fullName.trim().toLowerCase();
      if (!byHeadName.has(norm)) {
        byHeadName.set(norm, f);
      }
    }
  }

  let rowsWithComments = 0;
  let matchedCount = 0;
  let updatedCount = 0;
  let alreadyPresentCount = 0;
  const unmergedRows: Array<{ rowNum: number; house: string; head: string; code: string; comment: string }> = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const comment = (row['Comments (DD.MM.YY - put comments)'] || row['Comments'] || row['General Notes'] || '').trim();
    if (!comment) continue;

    rowsWithComments++;

    const csvCode = (row['Parish Family ID'] || '').trim().toUpperCase();
    const csvHouse = (row['House Name (Veettuperu)|text-1'] || '').trim();
    const csvHead = (row['Name|name-1'] || '').trim();

    let matchedFamily = csvCode ? byFamilyCode.get(csvCode) : null;
    let matchType = 'familyCode';

    if (!matchedFamily && csvHouse) {
      matchedFamily = byHouseName.get(csvHouse.toLowerCase());
      matchType = 'houseName';
    }

    if (!matchedFamily && csvHead) {
      matchedFamily = byHeadName.get(csvHead.toLowerCase());
      matchType = 'headFullName';
    }

    if (!matchedFamily) {
      unmergedRows.push({
        rowNum: i + 1,
        house: csvHouse,
        head: csvHead,
        code: csvCode,
        comment,
      });
      continue;
    }

    matchedCount++;

    const existingNotes = (matchedFamily.generalNotes || '').trim();

    // Check if the comment is already contained in generalNotes
    if (existingNotes.includes(comment)) {
      alreadyPresentCount++;
      continue;
    }

    // Merge notes
    const newNotes = existingNotes ? `${existingNotes}\n\n${comment}` : comment;

    await prisma.family.update({
      where: { id: matchedFamily.id },
      data: {
        generalNotes: newNotes,
      },
    });

    // Update in-memory reference
    matchedFamily.generalNotes = newNotes;
    updatedCount++;
  }

  console.log('\n--- Backfill Summary ---');
  console.log(`CSV rows with comments: ${rowsWithComments}`);
  console.log(`Matched to DB families: ${matchedCount}`);
  console.log(`Updated with comments: ${updatedCount}`);
  console.log(`Already present: ${alreadyPresentCount}`);
  console.log(`Unmatched rows: ${unmergedRows.length}`);

  if (unmergedRows.length > 0) {
    console.log('Unmatched rows details:', JSON.stringify(unmergedRows, null, 2));
  }

  // Also verify DB count of families with generalNotes
  const familiesWithNotes = await prisma.family.count({
    where: {
      generalNotes: {
        not: null,
      },
    },
  });
  console.log(`Total families in DB with generalNotes now: ${familiesWithNotes}`);
}

backfillComments()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
