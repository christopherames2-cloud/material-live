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

    const purchaseOrders = db.prepare(`
      SELECT 
        po.id,
        po.ce_ponum,
        po.vendor_name,
        po.po_date,
        po.request_id,
        po.status,
        (SELECT COUNT(*) FROM po_items WHERE po_id = po.id) as items_count
      FROM purchase_orders po
      WHERE po.status IN ('open', 'partial')
      ORDER BY po.po_date DESC
    `).all();

    return NextResponse.json({ purchaseOrders });
  } catch (error) {
    console.error('POs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
