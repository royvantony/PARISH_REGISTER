"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting Parish Register Database Seeding...');
    // 1. Seed Brisbane Parish (SABN)
    const parish = await prisma.parish.upsert({
        where: { parishCode: 'SABN' },
        update: {},
        create: {
            parishCode: 'SABN',
            parishName: 'St. Alphonsa Syro-Malabar Catholic Parish',
            city: 'Brisbane North',
            state: 'QLD',
            postalCode: '4034',
            contactEmail: 'admin@stalphonsaparishbrisbane.org.au',
            contactPhone: '0488752642',
            idPrefix: 'SABN',
            nextFamilyNumber: 100450,
            isActive: true,
        },
    });
    console.log(`✅ Parish verified: ${parish.parishName} (Code: ${parish.parishCode})`);
    // 2. Seed Standardized Native Dioceses in India
    const dioceses = [
        { dioceseName: 'Ernakulam-Angamaly', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Changanassery', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Pala', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Irinjalakuda', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Thrissur', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Kothamangalam', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Palakkad', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Kanjirapally', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Idukki', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Thalassery', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Thamarassery', stateInIndia: 'Kerala', rite: 'Syro-Malabar' },
        { dioceseName: 'Kottayam', stateInIndia: 'Kerala', rite: 'Syro-Malabar / Knanaya' },
        { dioceseName: 'Mavelikkara', stateInIndia: 'Kerala', rite: 'Syro-Malankara' },
        { dioceseName: 'Kalyan', stateInIndia: 'Maharashtra', rite: 'Syro-Malabar' },
        { dioceseName: 'Shamshabad', stateInIndia: 'Telangana', rite: 'Syro-Malabar' },
        { dioceseName: 'Kottapuram', stateInIndia: 'Kerala', rite: 'Latin Catholic' },
    ];
    for (const d of dioceses) {
        await prisma.nativeDiocese.upsert({
            where: { dioceseName: d.dioceseName },
            update: {},
            create: d,
        });
    }
    console.log(`✅ Seeded ${dioceses.length} Indian dioceses.`);
    // 3. Seed Default Admin Users
    const defaultPassword = await bcrypt_1.default.hash('parishAdmin2026!', 10);
    const devPassword = await bcrypt_1.default.hash('DevSuperAdmin2026!', 10);
    // Diocesan Super Admin (Developer)
    await prisma.parishUser.upsert({
        where: { email: 'royvantony@gmail.com' },
        update: {
            fullName: 'Super Admin',
            role: client_1.UserRole.DIOCESAN_ADMIN,
            parishId: null,
            isActive: true,
        },
        create: {
            fullName: 'Super Admin',
            email: 'royvantony@gmail.com',
            passwordHash: devPassword,
            role: client_1.UserRole.DIOCESAN_ADMIN,
            parishId: null, // Full Diocese-Wide Access
            isActive: true,
        },
    });
    // Super Admin (Parish Priest)
    await prisma.parishUser.upsert({
        where: { email: 'priest@stalphonsabrisbane.org.au' },
        update: {},
        create: {
            fullName: 'Fr. Parish Priest',
            email: 'priest@stalphonsabrisbane.org.au',
            passwordHash: defaultPassword,
            role: client_1.UserRole.SUPER_ADMIN,
            parishId: parish.id,
            isActive: true,
        },
    });
    // Parish Admin (Secretary)
    await prisma.parishUser.upsert({
        where: { email: 'secretary@stalphonsabrisbane.org.au' },
        update: {},
        create: {
            fullName: 'Parish Secretary',
            email: 'secretary@stalphonsabrisbane.org.au',
            passwordHash: defaultPassword,
            role: client_1.UserRole.PARISH_ADMIN,
            parishId: parish.id,
            isActive: true,
        },
    });
    console.log('✅ Seeded default Super Admin and Parish Admin users.');
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
