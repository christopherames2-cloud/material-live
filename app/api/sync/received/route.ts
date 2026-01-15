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
    const { receivedItems } = body;

    if (!Array.isArray(receivedItems)) {
      return NextResponse.json({ error: 'receivedItems must be an array' }, { status: 400 });
    }

    const db = getDb();
    let inserted = 0;
    let updated = 0;

    for (const item of receivedItems) {
      // Look up the PO id from ce_ponum
      const po = db.prepare('SELECT id FROM purchase_orders WHERE ce_ponum = ?').get(item.ponum) as { id: number } | undefined;

      const existing = db.prepare('SELECT id FROM received_items WHERE ce_serialnum = ?').get(item.serialnum);

      if (existing) {
        db.prepare(`
          UPDATE received_items SET
            po_id = ?,
            ce_ponum = ?,
            ce_itemnum = ?,
            job_num = ?,
            received_date = ?,
            quantity = ?,
            synced_at = CURRENT_TIMESTAMP
          WHERE ce_serialnum = ?
        `).run(
          po?.id || null,
          item.ponum,
          item.itemnum,
          item.jobnum,
          item.date,
          item.quantity,
          item.serialnum
        );
        updated++;
      } else {
        db.prepare(`
          INSERT INTO received_items (ce_serialnum, po_id, ce_ponum, ce_itemnum, job_num, received_date, quantity)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.serialnum,
          po?.id || null,
          item.ponum,
          item.itemnum,
          item.jobnum,
          item.date,
          item.quantity
        );
        inserted++;
      }
    }

    // Log the sync
    db.prepare(`
      INSERT INTO sync_log (sync_type, status, records_synced, completed_at)
      VALUES ('received', 'success', ?, CURRENT_TIMESTAMP)
    `).run(inserted + updated);

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      total: receivedItems.length
    });
  } catch (error: any) {
    console.error('Received Items Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}
