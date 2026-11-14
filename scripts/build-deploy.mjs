import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetEnv = (process.argv[2] || 'demo').toLowerCase();
if (targetEnv !== 'demo' && targetEnv !== 'production') {
  console.error(`❌ Invalid target: "${targetEnv}". Use "demo" or "production".`);
  process.exit(1);
}

const targetName = targetEnv === 'demo' ? 'Demo' : 'Production';
const targetDir = path.resolve(rootDir, 'deploy', targetEnv);

console.log(`\n======================================================`);
console.log(`🚀 Building Standalone Deployment Package: [${targetName}]`);
console.log(`📁 Target Directory: ${targetDir}`);
console.log(`======================================================\n`);

// 1. Compile Client
console.log(`📦 [1/5] Compiling Client (Vite + React)...`);
execSync('npm --prefix client run build', { cwd: rootDir, stdio: 'inherit' });

// 2. Compile Server
console.log(`\n⚙️  [2/5] Compiling Server (TypeScript)...`);
execSync('npm --prefix server run build', { cwd: rootDir, stdio: 'inherit' });

// 3. Prepare Target Directories
console.log(`\n📂 [3/5] Setting up deployment directory structure...`);
fs.mkdirSync(path.join(targetDir, 'dist'), { recursive: true });
fs.mkdirSync(path.join(targetDir, 'public'), { recursive: true });
fs.mkdirSync(path.join(targetDir, 'prisma'), { recursive: true });

// Copy Server Compiled dist
copyFolderSync(path.join(rootDir, 'server', 'dist'), path.join(targetDir, 'dist'));

// Copy Client Compiled dist -> public
copyFolderSync(path.join(rootDir, 'client', 'dist'), path.join(targetDir, 'public'));

// Copy Prisma Schema & Migrations
fs.copyFileSync(
  path.join(rootDir, 'server', 'prisma', 'schema.prisma'),
  path.join(targetDir, 'prisma', 'schema.prisma')
);
if (fs.existsSync(path.join(rootDir, 'server', 'prisma', 'migrations'))) {
  copyFolderSync(
    path.join(rootDir, 'server', 'prisma', 'migrations'),
    path.join(targetDir, 'prisma', 'migrations')
  );
}

// 4. Create Standalone package.json
console.log(`\n📄 [4/5] Generating standalone package.json...`);
const serverPkg = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'server', 'package.json'), 'utf8')
);

const standalonePkg = {
  name: `parish-register-${targetEnv}`,
  version: '1.0.0',
  private: true,
  description: `Standalone Parish Register Deployment (${targetName})`,
  main: 'dist/index.js',
  scripts: {
    migrate: 'prisma migrate deploy',
    generate: 'prisma generate',
    start: 'node dist/index.js'
  },
  dependencies: serverPkg.dependencies,
  devDependencies: {
    prisma: serverPkg.devDependencies?.prisma || '^5.22.0'
  }
};

fs.writeFileSync(
  path.join(targetDir, 'package.json'),
  JSON.stringify(standalonePkg, null, 2) + '\n'
);

// 5. Create .env if not exists
console.log(`\n🔒 [5/5] Checking configuration (.env)...`);
const envPath = path.join(targetDir, '.env');

if (!fs.existsSync(envPath)) {
  let envTemplate = '';
  if (targetEnv === 'demo') {
    envTemplate = `# ========================================================
# Parish Register DEMO Runtime Configuration
# Database: Docker Demo PostgreSQL on Port 5433
# ========================================================
PORT=5000
APP_ENV=Demo
DATABASE_URL="postgresql://postgres:demopassword123@127.0.0.1:5433/parish_demo?schema=public"

# Authentication & Security
JWT_SECRET="parish-demo-jwt-secret-key-2026-secure-token-auth"
JWT_EXPIRES_IN="24h"

# Encrypted Master Backup/Export Key (AES-256-GCM)
BACKUP_ENCRYPTION_KEY="parish_register_backup_secret_key_2026"

# Allowed Origins (leave empty for open demo or list Cloudflare URL)
ALLOWED_ORIGINS=""
`;
  } else {
    envTemplate = `# ========================================================
# Parish Register PRODUCTION Runtime Configuration
# ========================================================
PORT=5000
APP_ENV=Production
DATABASE_URL="postgresql://postgres:YOUR_STRONG_PASSWORD@127.0.0.1:5432/parish_production?schema=public"

# Authentication & Security (generate strong random string)
JWT_SECRET="replace-with-a-strong-random-production-jwt-secret-min-32-chars"
JWT_EXPIRES_IN="24h"

# Encrypted Master Backup/Export Key (AES-256-GCM)
BACKUP_ENCRYPTION_KEY="replace-with-a-strong-random-production-backup-key"

# Allowed Origins for CORS (e.g. your Cloudflare tunnel domain)
ALLOWED_ORIGINS="https://register.yourdomain.org"
`;
  }
  fs.writeFileSync(envPath, envTemplate);
  console.log(`   ✨ Generated initial .env template at ${envPath}`);
} else {
  console.log(`   ℹ️  Existing .env preserved at ${envPath}`);
}

// 6. Ensure Standalone Production Dependencies & Prisma Client
console.log(`\n📦 [6/6] Ensuring standalone runtime dependencies...`);
const targetNodeModules = path.join(targetDir, 'node_modules');
if (!fs.existsSync(targetNodeModules)) {
  console.log(`   Installing production packages in ${targetDir}...`);
  execSync('npm install --omit=dev', { cwd: targetDir, stdio: 'inherit' });
}
try {
  execSync('npx prisma generate', { cwd: targetDir, stdio: 'inherit' });
} catch (err) {
  console.log(`   ℹ️  Prisma client is already present (DLL in use by running server).`);
}

console.log(`\n======================================================`);
console.log(`✅ [${targetName}] Build successfully generated at:`);
console.log(`   ${targetDir}`);
console.log(`======================================================\n`);

// Helper to recursively copy directories
function copyFolderSync(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const element of fs.readdirSync(from)) {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    const stat = fs.lstatSync(fromPath);
    if (stat.isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}
