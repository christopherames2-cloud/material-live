import { NextRequest, NextResponse } from 'next/server';
import { getDb, validateSession } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const db = getDb();

    const items = db.prepare(`
      SELECT 
        pi.id,
        pi.item_num,
        pi.description,
        pi.outstanding,
        pi.received,
        pd.job_num,
        pd.job_name
      FROM po_items pi
      LEFT JOIN po_distributions pd ON pi.id = pd.po_item_id
      WHERE pi.po_id = ?
      ORDER BY pi.item_order
    `).all(parseInt(id));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('PO Items API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
