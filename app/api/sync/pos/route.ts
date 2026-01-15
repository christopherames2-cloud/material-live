import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Simple API key auth for sync agent
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
    const { purchaseOrders } = body;

    if (!Array.isArray(purchaseOrders)) {
      return NextResponse.json({ error: 'purchaseOrders must be an array' }, { status: 400 });
    }

    const db = getDb();
    let inserted = 0;
    let updated = 0;

    for (const po of purchaseOrders) {
      // Check if PO exists
      const existing = db.prepare('SELECT id FROM purchase_orders WHERE ce_ponum = ?').get(po.ponum);

      if (existing) {
        // Update existing PO
        db.prepare(`
          UPDATE purchase_orders SET
            vendor_num = ?,
            vendor_name = ?,
            po_date = ?,
            blurb = ?,
            request_id = ?,
            ce_attachid = ?,
            status = ?,
            synced_at = CURRENT_TIMESTAMP
          WHERE ce_ponum = ?
        `).run(
          po.vennum,
          po.vendor_name,
          po.podate,
          po.blurb,
          po.user_5,
          po.attachid,
          po.status || 'open',
          po.ponum
        );
        updated++;

        // Sync PO items
        if (po.items && Array.isArray(po.items)) {
          const poRecord = db.prepare('SELECT id FROM purchase_orders WHERE ce_ponum = ?').get(po.ponum) as { id: number };
          
          for (const item of po.items) {
            const existingItem = db.prepare('SELECT id FROM po_items WHERE po_id = ? AND ce_itemid = ?').get(poRecord.id, item.itemid);
            
            if (existingItem) {
              db.prepare(`
                UPDATE po_items SET
                  item_order = ?,
                  item_num = ?,
                  description = ?,
                  vendor_item_num = ?,
                  outstanding = ?,
                  received = ?,
                  unposted = ?
                WHERE po_id = ? AND ce_itemid = ?
              `).run(
                item.order,
                item.itemnum,
                item.des,
                item.venitemnum,
                item.outstanding || 0,
                item.received || 0,
                item.unposted || 0,
                poRecord.id,
                item.itemid
              );
            } else {
              const itemResult = db.prepare(`
                INSERT INTO po_items (po_id, ce_itemid, item_order, item_num, description, vendor_item_num, outstanding, received, unposted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                poRecord.id,
                item.itemid,
                item.order,
                item.itemnum,
                item.des,
                item.venitemnum,
                item.outstanding || 0,
                item.received || 0,
                item.unposted || 0
              );

              // Sync distributions for this item
              if (item.distributions && Array.isArray(item.distributions)) {
                const itemId = itemResult.lastInsertRowid;
                for (const dist of item.distributions) {
                  db.prepare(`
                    INSERT OR REPLACE INTO po_distributions (po_item_id, ce_itemid, job_num, job_name, phase_num, phase_name, cat_num, cat_name, outstanding, received, unposted)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).run(
                    itemId,
                    dist.itemid,
                    dist.jobnum,
                    dist.job_name,
                    dist.phasenum,
                    dist.phase_name,
                    dist.catnum,
                    dist.cat_name,
                    dist.outstanding || 0,
                    dist.received || 0,
                    dist.unposted || 0
                  );
                }
              }
            }
          }
        }
      } else {
        // Insert new PO
        const result = db.prepare(`
          INSERT INTO purchase_orders (ce_ponum, vendor_num, vendor_name, po_date, blurb, request_id, ce_attachid, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          po.ponum,
          po.vennum,
          po.vendor_name,
          po.podate,
          po.blurb,
          po.user_5,
          po.attachid,
          po.status || 'open'
        );
        inserted++;

        // Insert PO items
        if (po.items && Array.isArray(po.items)) {
          const poId = result.lastInsertRowid;
          
          for (const item of po.items) {
            const itemResult = db.prepare(`
              INSERT INTO po_items (po_id, ce_itemid, item_order, item_num, description, vendor_item_num, outstanding, received, unposted)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              poId,
              item.itemid,
              item.order,
              item.itemnum,
              item.des,
              item.venitemnum,
              item.outstanding || 0,
              item.received || 0,
              item.unposted || 0
            );

            // Insert distributions for this item
            if (item.distributions && Array.isArray(item.distributions)) {
              const itemId = itemResult.lastInsertRowid;
              for (const dist of item.distributions) {
                db.prepare(`
                  INSERT INTO po_distributions (po_item_id, ce_itemid, job_num, job_name, phase_num, phase_name, cat_num, cat_name, outstanding, received, unposted)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  itemId,
                  dist.itemid,
                  dist.jobnum,
                  dist.job_name,
                  dist.phasenum,
                  dist.phase_name,
                  dist.catnum,
                  dist.cat_name,
                  dist.outstanding || 0,
                  dist.received || 0,
                  dist.unposted || 0
                );
              }
            }
          }
        }
      }
    }

    // Log the sync
    db.prepare(`
      INSERT INTO sync_log (sync_type, status, records_synced, completed_at)
      VALUES ('pos', 'success', ?, CURRENT_TIMESTAMP)
    `).run(inserted + updated);

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      total: purchaseOrders.length
    });
  } catch (error: any) {
    console.error('PO Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}
