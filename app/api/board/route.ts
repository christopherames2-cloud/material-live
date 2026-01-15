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

    // Get location (default to Glendora for now)
    const locationId = request.nextUrl.searchParams.get('location') || '1';

    // Get all spots with their staging data
    const spots = db.prepare(`
      SELECT 
        ss.id,
        ss.code,
        ss.name,
        ss.spot_type,
        ss.grid_row,
        ss.grid_col,
        sr.id as staging_id,
        sr.request_id,
        sr.job_num,
        sr.job_name,
        sr.job_address,
        sr.pack_number,
        sr.item_descriptions,
        sr.status,
        sr.staged_at,
        po.ce_ponum as po_num
      FROM staging_spots ss
      LEFT JOIN staging_records sr ON ss.id = sr.spot_id AND sr.status IN ('staged', 'ready')
      LEFT JOIN purchase_orders po ON sr.po_id = po.id
      WHERE ss.location_id = ? AND ss.active = 1
      ORDER BY ss.spot_type, ss.grid_row, ss.grid_col
    `).all(parseInt(locationId));

    // Group by spot type
    const spotTypes = [
      'will_call_construction',
      'will_call_service',
      'staging',
      'delivery',
      'long_term',
      'pending_returns'
    ];

    const sections = spotTypes.map(type => ({
      type,
      title: type,
      className: type.replace(/_/g, '-'),
      spots: spots.filter((s: any) => s.spot_type === type)
    })).filter(s => s.spots.length > 0);

    return NextResponse.json({ sections });
  } catch (error) {
    console.error('Board API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
