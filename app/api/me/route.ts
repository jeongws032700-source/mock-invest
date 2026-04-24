import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import pool, { ensureSchema } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const user = verifyToken(token);

    await ensureSchema();

    const [userRows] = await pool.execute(
      'SELECT id, email, balance FROM users WHERE id = ?',
      [user.id]
    ) as any;

    if (!userRows[0]) return NextResponse.json({ error: '사용자 없음' }, { status: 404 });

    const [holdings] = await pool.execute(
      'SELECT coin_id AS coin, amount AS quantity, avg_price FROM holdings WHERE user_id = ?',
      [user.id]
    ) as any;

    const [trades] = await pool.execute(
      'SELECT coin_id AS coin, type, amount AS quantity, price, total, created_at FROM trades WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [user.id]
    ) as any;

    return NextResponse.json({
      email:        userRows[0].email,
      balance:      Number(userRows[0].balance),
      positions:    holdings.map((h: any) => ({ coin: h.coin, quantity: Number(h.quantity), avg_price: Number(h.avg_price) })),
      transactions: trades,
    });
  } catch (e) {
    console.error('[me]', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
