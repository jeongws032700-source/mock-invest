import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import pool, { ensureSchema } from '@/lib/db';
import { signToken } from '@/lib/auth';
import type { ResultSetHeader } from 'mysql2';

function hasMysqlCode(error: unknown, code: string) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === code;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 });
    }

    await ensureSchema();

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, balance) VALUES (?, ?, ?)',
      [email, hash, 10_000_000]
    );

    const token = signToken({ id: result.insertId, email });

    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return NextResponse.json({ ok: true }, { status: 201 });

  } catch (error) {
    if (hasMysqlCode(error, 'ER_DUP_ENTRY')) {
      return NextResponse.json({ error: '이미 사용중인 이메일입니다.' }, { status: 409 });
    }
    console.error('[register]', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
