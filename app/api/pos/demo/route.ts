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

    const db = getDb();

    // Generate a demo PO number
    const lastPO = db.prepare('SELECT MAX(ce_ponum) as maxPO FROM purchase_orders').get() as { maxPO: number | null };
    const newPONum = (lastPO.maxPO || 4000) + 1;

    // Create demo PO
    const poResult = db.prepare(`
      INSERT INTO purchase_orders (ce_ponum, vendor_name, po_date, blurb, request_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      newPONum,
      'Demo HVAC Supplier',
      new Date().toISOString().split('T')[0],
      'Demo PO for testing',
      `${23000000 + Math.floor(Math.random() * 1000000)}`,
      'open'
    );

    const poId = poResult.lastInsertRowid;

    // Add demo items
    const demoItems = [
      { num: 'HVAC-001', desc: '5 Ton Rooftop Unit', outstanding: 1, job: 'SG0023', jobName: 'OCSD Plant 2' },
      { num: 'DUCT-102', desc: 'Flex Duct 12" x 25\'', outstanding: 10, job: 'SG0023', jobName: 'OCSD Plant 2' },
      { num: 'FILT-200', desc: 'MERV-13 Filter 20x20x1', outstanding: 24, job: 'SL0006', jobName: 'Delta Airlines' },
    ];

    for (let i = 0; i < demoItems.length; i++) {
      const item = demoItems[i];
      const itemResult = db.prepare(`
        INSERT INTO po_items (po_id, item_order, item_num, description, outstanding, received)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(poId, i, item.num, item.desc, item.outstanding, 0);

      const itemId = itemResult.lastInsertRowid;

      // Add distribution
      db.prepare(`
        INSERT INTO po_distributions (po_item_id, job_num, job_name, outstanding, received)
        VALUES (?, ?, ?, ?, ?)
      `).run(itemId, item.job, item.jobName, item.outstanding, 0);
    }

    return NextResponse.json({ 
      success: true, 
      poNum: newPONum,
      message: `Demo PO #${newPONum} created with 3 items`
    });
  } catch (error) {
    console.error('Demo PO API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
