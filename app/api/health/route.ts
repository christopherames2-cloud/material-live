import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // Test database connectivity
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const poCount = db.prepare('SELECT COUNT(*) as count FROM purchase_orders').get() as { count: number };
    const spotCount = db.prepare('SELECT COUNT(*) as count FROM staging_spots').get() as { count: number };
    const locationCount = db.prepare('SELECT COUNT(*) as count FROM locations').get() as { count: number };

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      counts: {
        users: userCount.count,
        purchaseOrders: poCount.count,
        stagingSpots: spotCount.count,
        locations: locationCount.count,
      },
      env: {
        nodeEnv: process.env.NODE_ENV,
        dbPath: process.env.DB_PATH || 'default (./materialive.db)',
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      database: 'failed',
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
