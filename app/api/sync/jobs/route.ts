import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const SYNC_API_KEY = process.env.SYNC_API_KEY || 'materialive-sync-key-change-me';

function validateSyncKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('X-Sync-Key');
  return authHeader === SYNC_API_KEY;
}

export async function POST(request: NextRequest) {
  if (!validateSyncKey(request)) {
    return NextResponse.json({ error: 'Invalid sync key' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { jobs } = body;

    if (!Array.isArray(jobs)) {
      return NextResponse.json({ error: 'jobs must be an array' }, { status: 400 });
    }

    const db = getDb();

    // Create jobs table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_num TEXT UNIQUE NOT NULL,
        name TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        status TEXT,
        ce_attachid INTEGER,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    let inserted = 0;
    let updated = 0;

    for (const job of jobs) {
      const existing = db.prepare('SELECT id FROM jobs WHERE job_num = ?').get(job.jobnum);

      if (existing) {
        db.prepare(`
          UPDATE jobs SET
            name = ?,
            address = ?,
            city = ?,
            state = ?,
            zip = ?,
            status = ?,
            ce_attachid = ?,
            synced_at = CURRENT_TIMESTAMP
          WHERE job_num = ?
        `).run(
          job.name,
          job.address,
          job.city,
          job.state,
          job.zip,
          job.status,
          job.attachid,
          job.jobnum
        );
        updated++;
      } else {
        db.prepare(`
          INSERT INTO jobs (job_num, name, address, city, state, zip, status, ce_attachid)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          job.jobnum,
          job.name,
          job.address,
          job.city,
          job.state,
          job.zip,
          job.status,
          job.attachid
        );
        inserted++;
      }
    }

    // Log the sync
    db.prepare(`
      INSERT INTO sync_log (sync_type, status, records_synced, completed_at)
      VALUES ('jobs', 'success', ?, CURRENT_TIMESTAMP)
    `).run(inserted + updated);

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      total: jobs.length
    });
  } catch (error: any) {
    console.error('Jobs Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}
