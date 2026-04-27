import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    // 요청 body에서 이메일, 비밀번호 꺼내기

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요' },
        { status: 400 }
      );
      // 둘 중 하나라도 없으면 400 에러 반환
    }

    const hashed = await bcrypt.hash(password, 10);
    // 비밀번호를 해시로 암호화. 10은 암호화 강도 (높을수록 느리지만 안전)

    await pool.execute(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, hashed]
      // ?는 SQL 인젝션 방지용 파라미터. 직접 문자열 넣으면 위험해
    );

    
    return NextResponse.json(
      { message: '회원가입 성공' },
      { status: 201 }
      // 201은 "새로운 리소스가 생성됐다"는 HTTP 상태코드
    );

  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: '이미 사용중인 이메일입니다' },
        { status: 409 }
        // 409는 "충돌(Conflict)" — 이미 존재하는 데이터
      );
    }
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}