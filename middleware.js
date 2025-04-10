import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(request) {
  const token = request.cookies.get('auth')?.value;
  const isAuthenticated = request.cookies.get('isAuthenticated')?.value === 'true';

  // Se l'utente è sulla pagina di login e ha già un token valido, reindirizza a /messages
  if (request.nextUrl.pathname === '/login' && token && isAuthenticated) {
    return NextResponse.redirect(new URL('/messages', request.url));
  }

  // Se l'utente non è autenticato e sta cercando di accedere a /messages, reindirizza a /login
  if (request.nextUrl.pathname === '/messages' && (!token || !isAuthenticated)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/messages', '/login'],
}; 