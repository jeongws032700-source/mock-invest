import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import pool from '@/lib/db';
import { WATCHLIST } from '@/lib/market-data';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const user = verifyToken(token);
    const { coin, type, quantity, price } = await req.json();

    if (!coin || !type || !quantity || !price || quantity <= 0 || price <= 0) {
      return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
    }

    const coinInfo = WATCHLIST.find(c => c.sym === coin);
    const coinName = coinInfo?.name ?? coin;
    const total    = quantity * price;

    const [userRows] = await pool.execute(
      'SELECT balance FROM users WHERE id = ?',
      [user.id]
    ) as any;
    const balance = Number(userRows[0].balance);

    if (type === 'buy') {
      if (balance < total) return NextResponse.json({ error: '잔고가 부족합니다' }, { status: 400 });

      const [existing] = await pool.execute(
        'SELECT * FROM holdings WHERE user_id = ? AND coin_id = ?',
        [user.id, coin]
      ) as any;

      if (existing.length > 0) {
        const newAmount   = Number(existing[0].amount) + Number(quantity);
        const newAvgPrice = (Number(existing[0].avg_price) * Number(existing[0].amount) + total) / newAmount;
        await pool.execute(
          'UPDATE holdings SET amount = ?, avg_price = ? WHERE user_id = ? AND coin_id = ?',
          [newAmount, newAvgPrice, user.id, coin]
        );
      } else {
        await pool.execute(
          'INSERT INTO holdings (user_id, coin_id, coin_name, amount, avg_price) VALUES (?, ?, ?, ?, ?)',
          [user.id, coin, coinName, quantity, price]
        );
      }

      await pool.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [total, user.id]);

    } else if (type === 'sell') {
      const [existing] = await pool.execute(
        'SELECT * FROM holdings WHERE user_id = ? AND coin_id = ?',
        [user.id, coin]
      ) as any;

      if (existing.length === 0 || Number(existing[0].amount) < quantity) {
        return NextResponse.json({ error: '보유 수량이 부족합니다' }, { status: 400 });
      }

      const newAmount = Number(existing[0].amount) - Number(quantity);
      if (newAmount < 0.000001) {
        await pool.execute('DELETE FROM holdings WHERE user_id = ? AND coin_id = ?', [user.id, coin]);
      } else {
        await pool.execute('UPDATE holdings SET amount = ? WHERE user_id = ? AND coin_id = ?', [newAmount, user.id, coin]);
      }

      await pool.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [total, user.id]);
    } else {
      return NextResponse.json({ error: '잘못된 거래 유형' }, { status: 400 });
    }

    await pool.execute(
      'INSERT INTO trades (user_id, coin_id, coin_name, type, amount, price, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user.id, coin, coinName, type, quantity, price, total]
    );

    return NextResponse.json({ ok: true, message: '거래 완료' });

  } catch (error) {
    console.error('[trade]', error);
    return NextResponse.json({ error: '거래 실패' }, { status: 500 });
  }
}
