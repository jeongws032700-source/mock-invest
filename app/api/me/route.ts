import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import pool, { ensureSchema } from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket {
  email: string;
  balance: string | number;
}

interface HoldingRow extends RowDataPacket {
  coin: string;
  quantity: string | number;
  avg_price: string | number;
}

interface TradeRow extends RowDataPacket {
  coin: string;
  type: 'buy' | 'sell';
  quantity: string | number;
  price: string | number;
  total: string | number;
  created_at: string | Date;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const user = verifyToken(token);

    await ensureSchema();

    const [userRows] = await pool.execute<UserRow[]>(
      'SELECT id, email, balance FROM users WHERE id = ?',
      [user.id]
    );

    if (!userRows[0]) return NextResponse.json({ error: '사용자 없음' }, { status: 404 });

    const [holdings] = await pool.execute<HoldingRow[]>(
      'SELECT coin_id AS coin, amount AS quantity, avg_price FROM holdings WHERE user_id = ?',
      [user.id]
    );

    const [trades] = await pool.execute<TradeRow[]>(
      'SELECT coin_id AS coin, type, amount AS quantity, price, total, created_at FROM trades WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [user.id]
    );

    return NextResponse.json({
      email:        userRows[0].email,
      balance:      Number(userRows[0].balance),
      positions:    holdings.map(h => ({ coin: h.coin, quantity: Number(h.quantity), avg_price: Number(h.avg_price) })),
      transactions: trades.map(t => ({
        coin: t.coin,
        type: t.type,
        quantity: Number(t.quantity),
        price: Number(t.price),
        total: Number(t.total),
        created_at: t.created_at,
      })),
    });
  } catch (e) {
    console.error('[me]', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
