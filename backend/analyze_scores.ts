import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyze() {
  const orgs = ["คณะวิศวกรรมศาสตร์", "คณะวิทยาศาสตร์"];

  for (const orgName of orgs) {
    console.log(`\n=== Analysis for ${orgName} ===`);
    const org = await prisma.organization.findUnique({ where: { name: orgName } });
    if (!org) {
      console.log('Not found in DB');
      continue;
    }

    const stat = await prisma.facultyDailyStat.findFirst({
      where: { organizationId: org.id },
      orderBy: { date: 'desc' }
    });
    console.log(`Latest Score: ${stat?.securityScore}`);
    console.log(`Total Issues: ${stat?.totalIssues}, High: ${stat?.highCount}, Med: ${stat?.mediumCount}`);

    // Get latest import ID
    const latestImport = await prisma.import.findFirst({
      orderBy: { importDate: 'desc' }
    });

    // Group issues by type and sum impact
    const issues = await prisma.issue.findMany({
      where: { 
        organizationId: org.id,
        importId: latestImport?.id
      },
    });

    const impactMap = new Map();
    for (const issue of issues) {
      const type = issue.issueTypeTitle;
      const severity = issue.severity;
      const key = `[${severity}] ${type}`;
      if (!impactMap.has(key)) {
        impactMap.set(key, { count: 0, impact: 0 });
      }
      const data = impactMap.get(key);
      data.count += 1;
      data.impact += issue.scoreImpact;
    }

    const sortedImpacts = Array.from(impactMap.entries())
      .sort((a, b) => b[1].impact - a[1].impact)
      .slice(0, 5);

    console.log('\nTop 5 Issue Types driving the score down:');
    for (const [key, data] of sortedImpacts) {
      console.log(`${key} -> Count: ${data.count}, Total Impact: ${data.impact.toFixed(2)}`);
    }
  }
  
  await prisma.$disconnect();
}

analyze().catch(console.error);
