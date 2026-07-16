import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SUBRUBROS_SAU } from "./seed-subrubros-sau-data";
import { crearSubrubroEstandar } from "../src/lib/subrubroEstandar";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = new PrismaClient({ adapter });

async function main() {
  for (const s of SUBRUBROS_SAU) {
    await crearSubrubroEstandar(db, { ...s, origen: "sau_ago2022" });
  }
  console.log(`Sembrados ${SUBRUBROS_SAU.length} subrubros SAU.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
