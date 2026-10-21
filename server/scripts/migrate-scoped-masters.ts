import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Migrating NativeDiocese & RolePermission to Parish-Scoped Tables ---');

  // 1. NativeDiocese
  console.log('1. Migrating NativeDiocese table...');
  await prisma.$executeRawUnsafe(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'NativeDiocese' AND column_name = 'parishId'
      ) THEN
        ALTER TABLE "NativeDiocese" ADD COLUMN "parishId" INTEGER DEFAULT 1 NOT NULL;
        ALTER TABLE "NativeDiocese" DROP CONSTRAINT IF EXISTS "NativeDiocese_dioceseName_key";
        CREATE UNIQUE INDEX IF NOT EXISTS "NativeDiocese_parishId_dioceseName_key" ON "NativeDiocese"("parishId", "dioceseName");
        ALTER TABLE "NativeDiocese" ADD CONSTRAINT "NativeDiocese_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  // 2. RolePermission
  console.log('2. Migrating RolePermission table...');
  await prisma.$executeRawUnsafe(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'RolePermission' AND column_name = 'parishId'
      ) THEN
        ALTER TABLE "RolePermission" ADD COLUMN "parishId" INTEGER DEFAULT 1 NOT NULL;
        ALTER TABLE "RolePermission" DROP CONSTRAINT IF EXISTS "RolePermission_role_module_key";
        CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_parishId_role_module_key" ON "RolePermission"("parishId", "role", "module");
        ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  console.log('3. Ensuring only Parish 1 (Brisbane) has data right now...');
  await prisma.$executeRawUnsafe(`DELETE FROM "NativeDiocese" WHERE "parishId" != 1`);
  await prisma.$executeRawUnsafe(`DELETE FROM "RolePermission" WHERE "parishId" != 1`);
  await prisma.$executeRawUnsafe(`DELETE FROM "FamilyUnit" WHERE "parishId" != 1`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Family" WHERE "parishId" != 1`);
  await prisma.$executeRawUnsafe(`DELETE FROM "ParishUser" WHERE "parishId" IS NOT NULL AND "parishId" != 1`);

  const brisbaneDioceses = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "NativeDiocese" WHERE "parishId" = 1`);
  const brisbanePerms = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "RolePermission" WHERE "parishId" = 1`);
  const otherDioceses = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "NativeDiocese" WHERE "parishId" != 1`);
  const otherPerms = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "RolePermission" WHERE "parishId" != 1`);

  console.log(`Brisbane NativeDioceses count: ${brisbaneDioceses[0]?.count}`);
  console.log(`Brisbane RolePermissions count: ${brisbanePerms[0]?.count}`);
  console.log(`Other parishes NativeDioceses count: ${otherDioceses[0]?.count}`);
  console.log(`Other parishes RolePermissions count: ${otherPerms[0]?.count}`);

  console.log('✅ Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
