import { PrismaClient, Role, CompetitionStatus, EvalMetric, CompetitionCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed script must not run in production environment');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash('admin123456', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@competition-platform.com' },
    update: {},
    create: {
      email: 'admin@competition-platform.com',
      name: 'Admin',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const host = await prisma.user.upsert({
    where: { email: 'host@competition-platform.com' },
    update: {},
    create: {
      email: 'host@competition-platform.com',
      name: 'Demo Host',
      passwordHash: await bcrypt.hash('host123456', 12),
      role: Role.HOST,
    },
  });

  const participant = await prisma.user.upsert({
    where: { email: 'user@competition-platform.com' },
    update: {},
    create: {
      email: 'user@competition-platform.com',
      name: 'Demo User',
      passwordHash: await bcrypt.hash('user123456', 12),
      role: Role.PARTICIPANT,
    },
  });

  const comp = await prisma.competition.upsert({
    where: { slug: 'titanic-survival-prediction' },
    update: {},
    create: {
      hostId: host.id,
      title: 'Titanic Survival Prediction',
      slug: 'titanic-survival-prediction',
      description: `# Titanic Survival Prediction

## Overview
Predict which passengers survived the Titanic shipwreck.

## Data
The dataset contains passenger information such as age, sex, class, and fare paid.

## Evaluation
Submissions are evaluated using **Accuracy** - the percentage of correctly predicted outcomes.`,
      rules: `## Rules
- Maximum 5 submissions per day
- Teams of up to 4 members allowed
- No private sharing of code
- Public kernels are encouraged`,
      status: CompetitionStatus.ACTIVE,
      category: CompetitionCategory.GETTING_STARTED,
      tags: ['beginner', 'tabular', 'classification'],
      prize: 'Knowledge',
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      evalMetric: EvalMetric.ACCURACY,
      pubPrivSplit: 0.3,
      maxTeamSize: 4,
      maxDailySubs: 5,
    },
  });

  console.log('Seed complete:', { admin: admin.email, host: host.email, participant: participant.email, competition: comp.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
