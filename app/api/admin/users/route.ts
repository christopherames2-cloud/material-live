import { NextRequest, NextResponse } from 'next/server';
import { getDb, validateSession } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = validateSession(token);
    if (!session.valid || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = getDb();
    const users = db.prepare(`
      SELECT id, username, full_name, role, active, last_login
      FROM users
      ORDER BY username
    `).all();

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Admin Users API error:', error);
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
    if (!session.valid || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { username, fullName, pin, role } = body;

    if (!username || !fullName || !pin || !role) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 4 digits' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if username exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toUpperCase());
    if (existing) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    const pinHash = bcrypt.hashSync(pin, 10);

    db.prepare(`
      INSERT INTO users (username, full_name, pin_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(username.toUpperCase(), fullName, pinHash, role);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin Users POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
