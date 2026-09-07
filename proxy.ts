import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== request.headers.get('host'))
          return NextResponse.json(
            { error: 'Origen no permitido.' },
            { status: 403 },
          );
      } catch {
        return NextResponse.json(
          { error: 'Origen no permitido.' },
          { status: 403 },
        );
      }
    }
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
