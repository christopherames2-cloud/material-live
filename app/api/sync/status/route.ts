import { NextRequest, NextResponse } from 'next/server';
import { getDb, validateSession } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = validateSession(token);
    if (!session.valid) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const db = getDb();

    // Get last sync for each type
    const syncTypes = ['pos', 'locations', 'received', 'jobs'];
    const syncStatus: Record<string, any> = {};

    for (const type of syncTypes) {
      const lastSync = db.prepare(`
        SELECT sync_type, status, records_synced, completed_at
        FROM sync_log
        WHERE sync_type = ?
        ORDER BY completed_at DESC
        LIMIT 1
      `).get(type);

      syncStatus[type] = lastSync || { sync_type: type, status: 'never', records_synced: 0, completed_at: null };
    }

    // Get total counts
    const counts = {
      purchaseOrders: (db.prepare('SELECT COUNT(*) as count FROM purchase_orders').get() as { count: number }).count,
      poItems: (db.prepare('SELECT COUNT(*) as count FROM po_items').get() as { count: number }).count,
      receivedItems: (db.prepare('SELECT COUNT(*) as count FROM received_items').get() as { count: number }).count,
      locations: (db.prepare('SELECT COUNT(*) as count FROM locations').get() as { count: number }).count,
    };

    // Check if jobs table exists
    try {
      const jobCount = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
      counts['jobs' as keyof typeof counts] = jobCount.count;
    } catch {
      counts['jobs' as keyof typeof counts] = 0;
    }

    return NextResponse.json({
      syncStatus,
      counts
    });
  } catch (error: any) {
    console.error('Sync Status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: error.message },
      { status: 500 }
    );
  }
}
