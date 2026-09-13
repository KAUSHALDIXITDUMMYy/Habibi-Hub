import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface HistoricalTalentRecord {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  home_market?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
  pb_profile_url?: string;
  th_profile_url?: string;
  is_demos_staff_id?: number;
  no_show_count?: number;
  completed_jobs_count?: number;
  notes?: string;
}

export async function importHistoricalTalent(filePath?: string) {
  const targetPath = filePath || path.join(process.cwd(), 'data', 'sample_historical_talent.json');
  
  if (!fs.existsSync(targetPath)) {
    console.error(`❌ Import file not found at: ${targetPath}`);
    process.exit(1);
  }

  console.log(`📦 Loading historical talent export from: ${targetPath}`);
  const rawData = fs.readFileSync(targetPath, 'utf-8');
  const records: HistoricalTalentRecord[] = JSON.parse(rawData);

  let insertedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const record of records) {
    try {
      // Check if talent exists by email or phone
      const existing = await prisma.talent.findFirst({
        where: {
          OR: [
            { email: record.email },
            { phone: record.phone }
          ]
        }
      });

      if (existing) {
        await prisma.talent.update({
          where: { talentId: existing.talentId },
          data: {
            isDemosStaffId: record.is_demos_staff_id || existing.isDemosStaffId,
            completedJobsCount: Math.max(existing.completedJobsCount, record.completed_jobs_count || 0),
            noShowCount: Math.max(existing.noShowCount, record.no_show_count || 0),
            notes: record.notes ? `${existing.notes || ''}\n[Imported]: ${record.notes}`.trim() : existing.notes
          }
        });
        updatedCount++;
      } else {
        await prisma.talent.create({
          data: {
            firstName: record.first_name,
            lastName: record.last_name,
            email: record.email,
            phone: record.phone,
            homeMarket: record.home_market,
            latitude: record.latitude,
            longitude: record.longitude,
            source: record.source || 'IS-Demos Export',
            pbProfileUrl: record.pb_profile_url,
            thProfileUrl: record.th_profile_url,
            isDemosStaffId: record.is_demos_staff_id,
            noShowCount: record.no_show_count || 0,
            completedJobsCount: record.completed_jobs_count || 0,
            notes: record.notes
          }
        });
        insertedCount++;
      }
    } catch (err) {
      console.error(`❌ Error importing record (${record.email}):`, err);
      errorCount++;
    }
  }

  console.log(`
📊 Historical Talent Import Summary:
───────────────────────────────────
  ✨ Total Processed: ${records.length}
  ➕ Created (New)   : ${insertedCount}
  🔄 Updated (Exist): ${updatedCount}
  ⚠️  Errors         : ${errorCount}
───────────────────────────────────
  `);

  await prisma.$disconnect();
}

// Run CLI script if invoked directly
if (process.argv[1]?.endsWith('importHistoricalTalent.ts') || process.argv[1]?.endsWith('importHistoricalTalent.js')) {
  const customFile = process.argv.find((arg: string) => arg.startsWith('--file='))?.split('=')[1];
  importHistoricalTalent(customFile).catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
}
