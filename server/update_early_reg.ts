import { PrismaClient } from './src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const apps = await prisma.enrollmentApplication.findMany({
    where: {
      learner: {
        lrn: {
          in: ['117463100300', '111111111111']
        }
      }
    },
    include: {
      learner: true
    }
  });
  console.log(JSON.stringify(apps, null, 2));

  // Let's just fix it by updating them to be isEarlyRegistrant: true
  for (const app of apps) {
    if (!app.isEarlyRegistrant) {
      await prisma.enrollmentApplication.update({
        where: { id: app.id },
        data: { isEarlyRegistrant: true }
      });
      console.log(`Updated app ${app.id} for LRN ${app.learner?.lrn}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
