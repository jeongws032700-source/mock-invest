import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production.');
  }
  return 'mock-invest-secret';
}

export async function proxy(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  // 쿠키에서 토큰 꺼내기

  const protectedPaths = ['/dashboard'];
  // 로그인 해야만 접근 가능한 페이지 목록

  const isProtected = protectedPaths.some(path =>
    req.nextUrl.pathname.startsWith(path)
  );
  // 현재 접근하려는 URL이 보호된 경로인지 확인

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', req.url));
    // 보호된 경로인데 토큰 없으면 로그인 페이지로 강제 이동
  }

  if (isProtected && token) {
    try {
      const secret = new TextEncoder().encode(getJwtSecret());
      await jwtVerify(token, secret);
      // jose로 토큰 검증. 미들웨어는 jose만 쓸 수 있어 (Next.js 제약)
    } catch {
      return NextResponse.redirect(new URL('/login', req.url));
      // 토큰이 만료됐거나 변조됐으면 로그인 페이지로
    }
  }

  return NextResponse.next();
  // 문제 없으면 그냥 통과
}

export const config = {
  matcher: ['/dashboard/:path*'],
  // 이 미들웨어를 dashboard 경로에서만 실행
};
