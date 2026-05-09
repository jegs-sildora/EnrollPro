const { PrismaClient } = require("./src/generated/prisma/index.js");
const prisma = new PrismaClient();

async function main() {
  const table = "sections";
  
  const constraints = await prisma.$queryRawUnsafe(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = '${table}'::regclass;
  `);

  const indexes = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = '${table}';
  `);

  const triggers = await prisma.$queryRawUnsafe(`
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = '${table}'::regclass;
  `);

  console.log(`Constraints for ${table}:`, JSON.stringify(constraints, null, 2));
  console.log(`Indexes for ${table}:`, JSON.stringify(indexes, null, 2));
  console.log(`Triggers for ${table}:`, JSON.stringify(triggers, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
