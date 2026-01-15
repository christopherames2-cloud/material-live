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
    const { locations } = body;

    if (!Array.isArray(locations)) {
      return NextResponse.json({ error: 'locations must be an array' }, { status: 400 });
    }

    const db = getDb();
    let inserted = 0;
    let updated = 0;

    for (const loc of locations) {
      // Only sync locations where type = 1
      if (loc.type !== 1) continue;

      const existing = db.prepare('SELECT id FROM locations WHERE ce_locationnum = ?').get(loc.locationnum);

      if (existing) {
        db.prepare(`
          UPDATE locations SET
            name = ?,
            type = ?,
            synced_at = CURRENT_TIMESTAMP
          WHERE ce_locationnum = ?
        `).run(loc.name, loc.type, loc.locationnum);
        updated++;
      } else {
        db.prepare(`
          INSERT INTO locations (ce_locationnum, name, type)
          VALUES (?, ?, ?)
        `).run(loc.locationnum, loc.name, loc.type);
        inserted++;
      }
    }

    // Log the sync
    db.prepare(`
      INSERT INTO sync_log (sync_type, status, records_synced, completed_at)
      VALUES ('locations', 'success', ?, CURRENT_TIMESTAMP)
    `).run(inserted + updated);

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      total: locations.length
    });
  } catch (error: any) {
    console.error('Location Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}
