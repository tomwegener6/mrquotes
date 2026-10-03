import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.MRQUOTES_PASSWORD || 'Hollanddr1#';
const PROTECTED_PATHS = ['/', '/analyze', '/market', '/api'];
const BLOCKED_PATHS = ['/data'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block /data route only in production
  if (process.env.NODE_ENV === 'production') {
    if (BLOCKED_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Allow login routes
  if (pathname === '/login' || pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  // Check if this is a protected path
  const isProtected = PROTECTED_PATHS.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for password cookie
  const passwordCookie = request.cookies.get('mrquotes_auth')?.value;

  if (!passwordCookie || passwordCookie !== PASSWORD) {
    // Redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
