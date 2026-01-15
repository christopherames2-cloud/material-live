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

    const records = db.prepare(`
      SELECT 
        sr.*,
        ss.code as spot_code,
        ss.name as spot_name,
        u.full_name as staged_by_name
      FROM staging_records sr
      LEFT JOIN staging_spots ss ON sr.spot_id = ss.id
      LEFT JOIN users u ON sr.staged_by = u.id
      WHERE sr.status IN ('staged', 'ready')
      ORDER BY sr.staged_at DESC
    `).all();

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Staging API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Field users cannot stage items
    if (session.user?.role === 'field') {
      return NextResponse.json({ error: 'Field users cannot stage items' }, { status: 403 });
    }

    const body = await request.json();
    const {
      poId,
      itemIds,
      spotId,
      customLocation,
      packNumber,
      notes,
      jobNum,
      jobName,
      requestId,
      itemDescriptions,
    } = body;

    const db = getDb();

    // Check if spot is available (if specified)
    if (spotId) {
      const existingStaging = db.prepare(`
        SELECT id FROM staging_records 
        WHERE spot_id = ? AND status IN ('staged', 'ready')
      `).get(spotId);

      if (existingStaging) {
        return NextResponse.json(
          { error: 'This spot is already occupied' },
          { status: 400 }
        );
      }
    }

    // Create staging record
    const result = db.prepare(`
      INSERT INTO staging_records (
        po_id, request_id, job_num, job_name, spot_id, custom_location,
        pack_number, item_descriptions, notes, status, staged_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'staged', ?)
    `).run(
      poId || null,
      requestId || null,
      jobNum || null,
      jobName || null,
      spotId || null,
      customLocation || null,
      packNumber || null,
      itemDescriptions || null,
      notes || null,
      session.user?.id || null
    );

    return NextResponse.json({
      success: true,
      stagingId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Staging POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
