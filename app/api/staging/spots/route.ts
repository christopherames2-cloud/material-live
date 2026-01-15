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
    const availableOnly = request.nextUrl.searchParams.get('available') === 'true';
    const locationId = request.nextUrl.searchParams.get('location') || '1';

    let query = `
      SELECT 
        ss.id,
        ss.code,
        ss.name,
        ss.spot_type,
        ss.grid_row,
        ss.grid_col
      FROM staging_spots ss
      WHERE ss.location_id = ? AND ss.active = 1
    `;

    if (availableOnly) {
      query += `
        AND ss.id NOT IN (
          SELECT spot_id FROM staging_records 
          WHERE spot_id IS NOT NULL AND status IN ('staged', 'ready')
        )
      `;
    }

    query += ' ORDER BY ss.spot_type, ss.grid_row, ss.grid_col';

    const spots = db.prepare(query).all(parseInt(locationId));

    return NextResponse.json({ spots });
  } catch (error) {
    console.error('Staging Spots API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
