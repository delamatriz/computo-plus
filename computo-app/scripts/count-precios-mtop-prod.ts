import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

p.precioMTOP.count().then(async (n) => {
  console.log("PrecioMTOP en producción:", n);
  await p.$disconnect();
});
