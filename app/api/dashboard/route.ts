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

    // Get stats
    const totalStaged = db.prepare(`
      SELECT COUNT(*) as count FROM staging_records WHERE status = 'staged'
    `).get() as { count: number };

    const readyForPickup = db.prepare(`
      SELECT COUNT(*) as count FROM staging_records WHERE status = 'ready'
    `).get() as { count: number };

    const pendingDelivery = db.prepare(`
      SELECT COUNT(*) as count FROM staging_records WHERE status IN ('staged', 'ready')
    `).get() as { count: number };

    const openPOs = db.prepare(`
      SELECT COUNT(*) as count FROM purchase_orders WHERE status IN ('open', 'partial')
    `).get() as { count: number };

    // Get recent activity (staging records with joins)
    const recentActivity = db.prepare(`
      SELECT 
        sr.staged_at as time,
        CASE sr.status
          WHEN 'staged' THEN 'Item Staged'
          WHEN 'ready' THEN 'Ready for Pickup'
          WHEN 'picked_up' THEN 'Picked Up'
          WHEN 'delivered' THEN 'Delivered'
          ELSE sr.status
        END as action,
        sr.request_id as requestId,
        COALESCE(ss.code, sr.custom_location, '-') as location,
        COALESCE(u.username, 'System') as user
      FROM staging_records sr
      LEFT JOIN staging_spots ss ON sr.spot_id = ss.id
      LEFT JOIN users u ON sr.staged_by = u.id
      ORDER BY sr.staged_at DESC
      LIMIT 10
    `).all();

    return NextResponse.json({
      stats: {
        totalStaged: totalStaged.count,
        readyForPickup: readyForPickup.count,
        pendingDelivery: pendingDelivery.count,
        openPOs: openPOs.count,
      },
      recentActivity,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
