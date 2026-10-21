"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    const email = 'dev@diocese.org.au';
    const plainPassword = 'DevSuperAdmin2026!';
    const passwordHash = await bcrypt_1.default.hash(plainPassword, 10);
    const devUser = await prisma.parishUser.upsert({
        where: { email },
        update: {
            role: client_1.UserRole.DIOCESAN_ADMIN,
            parishId: null, // Global access across all parishes
            isActive: true,
            passwordHash: passwordHash,
        },
        create: {
            fullName: 'Diocesan Super Admin (Developer)',
            email: email,
            passwordHash: passwordHash,
            role: client_1.UserRole.DIOCESAN_ADMIN,
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
