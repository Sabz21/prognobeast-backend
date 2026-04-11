import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@PrognoBeast2024!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: "prognobeast@gmail.com" },
    update: {},
    create: {
      firstName: "Admin",
      lastName: "PrognoBeast",
      email: "prognobeast@gmail.com",
      passwordHash,
      role: "ADMIN",
      status: "APPROVED",
    },
  });

  console.log(`✅ Compte admin créé : ${admin.email}`);
  console.log(`🔑 Mot de passe par défaut : ${adminPassword}`);
  console.log(`   → Changez-le via ADMIN_PASSWORD dans .env`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
