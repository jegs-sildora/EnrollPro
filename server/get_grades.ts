import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const levels = await prisma.gradeLevel.findMany()
  console.log(levels)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
