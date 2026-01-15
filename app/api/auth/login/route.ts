import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { username, pin } = await request.json();

    if (!username || !pin) {
      return NextResponse.json(
        { success: false, error: 'Username and PIN are required' },
        { status: 400 }
      );
    }

    const result = authenticateUser(username, pin);

    if (result.success) {
      return NextResponse.json({
        success: true,
        user: result.user,
        token: result.token,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
