import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.MRQUOTES_PASSWORD || 'Hollanddr1#';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password || password !== PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Create response and set auth cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('mrquotes_auth', password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
