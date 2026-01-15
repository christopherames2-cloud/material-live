import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'No token provided' },
        { status: 401 }
      );
    }

    const result = validateSession(token);

    if (result.valid) {
      return NextResponse.json({
        valid: true,
        user: result.user,
      });
    } else {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired session' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
