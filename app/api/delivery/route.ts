import { NextRequest, NextResponse } from 'next/server';
import { getDb, validateSession } from '@/lib/db';

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

    // Field users cannot process deliveries
    if (session.user?.role === 'field') {
      return NextResponse.json({ error: 'Field users cannot process deliveries' }, { status: 403 });
    }

    const body = await request.json();
    const {
      stagingRecordId,
      signerName,
      signerFirstInitial,
      signerLastName,
      signatureData,
    } = body;

    if (!stagingRecordId || !signerName || !signatureData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check staging record exists
    const stagingRecord = db.prepare(
      'SELECT * FROM staging_records WHERE id = ?'
    ).get(stagingRecordId) as any;

    if (!stagingRecord) {
      return NextResponse.json(
        { error: 'Staging record not found' },
        { status: 404 }
      );
    }

    // Create delivery record
    const deliveryResult = db.prepare(`
      INSERT INTO deliveries (
        staging_record_id,
        delivery_date,
        signer_name,
        signer_first_initial,
        signer_last_name,
        signature_data,
        signed_at,
        delivered_by
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(
      stagingRecordId,
      new Date().toISOString().split('T')[0],
      signerName,
      signerFirstInitial,
      signerLastName,
      signatureData,
      session.user?.id || null
    );

    // Update staging record status
    db.prepare(`
      UPDATE staging_records SET status = 'picked_up' WHERE id = ?
    `).run(stagingRecordId);

    return NextResponse.json({
      success: true,
      deliveryId: deliveryResult.lastInsertRowid,
      message: 'Delivery confirmed successfully'
    });
  } catch (error) {
    console.error('Delivery API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const deliveries = db.prepare(`
      SELECT 
        d.*,
        sr.request_id,
        sr.job_num,
        sr.job_name,
        sr.item_descriptions,
        u.full_name as delivered_by_name
      FROM deliveries d
      JOIN staging_records sr ON d.staging_record_id = sr.id
      LEFT JOIN users u ON d.delivered_by = u.id
      ORDER BY d.signed_at DESC
      LIMIT 50
    `).all();

    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error('Delivery GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
