import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import pool, { ensureSchema } from '@/lib/db';
import { WATCHLIST } from '@/lib/market-data';
import type { RowDataPacket } from 'mysql2';

type TradeSide = 'buy' | 'sell';

interface TradeBody {
  coin?: unknown;
  type?: unknown;
  quantity?: unknown;
}

interface BalanceRow extends RowDataPacket {
  balance: string | number;
}

interface HoldingRow extends RowDataPacket {
  amount: string | number;
  avg_price: string | number;
}

function isTradeSide(value: unknown): value is TradeSide {
  return value === 'buy' || value === 'sell';
}

async function getExecutionPrice(symbol: string, fallbackPrice: number) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`, {
      cache: 'no-store',
    });
    if (!res.ok) return fallbackPrice;

    const data = await res.json() as { price?: string };
    const price = Number(data.price);
    return Number.isFinite(price) && price > 0 ? price : fallbackPrice;
  } catch {
    return fallbackPrice;
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const user = verifyToken(token);
    const { coin, type, quantity } = await req.json() as TradeBody;

    if (typeof coin !== 'string' || !isTradeSide(type)) {
      return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
    }

    const coinInfo = WATCHLIST.find(c => c.sym === coin);
    if (!coinInfo) {
      return NextResponse.json({ error: '지원하지 않는 코인입니다' }, { status: 400 });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: '잘못된 수량입니다' }, { status: 400 });
    }

    const price = await getExecutionPrice(coinInfo.sym, coinInfo.price);
    const total = qty * price;

    await ensureSchema();

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [userRows] = await connection.execute<BalanceRow[]>(
        'SELECT balance FROM users WHERE id = ? FOR UPDATE',
        [user.id]
      );
      if (!userRows[0]) {
        await connection.rollback();
        return NextResponse.json({ error: '사용자 없음' }, { status: 404 });
      }

      const balance = Number(userRows[0].balance);

      if (type === 'buy') {
        if (balance < total) {
          await connection.rollback();
          return NextResponse.json({ error: '잔고가 부족합니다' }, { status: 400 });
        }

        const [existing] = await connection.execute<HoldingRow[]>(
          'SELECT amount, avg_price FROM holdings WHERE user_id = ? AND coin_id = ? FOR UPDATE',
          [user.id, coin]
        );

        if (existing.length > 0) {
          const currentAmount = Number(existing[0].amount);
          const newAmount = currentAmount + qty;
          const newAvgPrice = (Number(existing[0].avg_price) * currentAmount + total) / newAmount;
          await connection.execute(
            'UPDATE holdings SET amount = ?, avg_price = ? WHERE user_id = ? AND coin_id = ?',
            [newAmount, newAvgPrice, user.id, coin]
          );
        } else {
          await connection.execute(
            'INSERT INTO holdings (user_id, coin_id, coin_name, amount, avg_price) VALUES (?, ?, ?, ?, ?)',
            [user.id, coin, coinInfo.name, qty, price]
          );
        }

        await connection.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [total, user.id]);

      } else {
        const [existing] = await connection.execute<HoldingRow[]>(
          'SELECT amount, avg_price FROM holdings WHERE user_id = ? AND coin_id = ? FOR UPDATE',
          [user.id, coin]
        );

        if (existing.length === 0 || Number(existing[0].amount) < qty) {
          await connection.rollback();
          return NextResponse.json({ error: '보유 수량이 부족합니다' }, { status: 400 });
        }

        const newAmount = Number(existing[0].amount) - qty;
        if (newAmount < 0.000001) {
          await connection.execute('DELETE FROM holdings WHERE user_id = ? AND coin_id = ?', [user.id, coin]);
        } else {
          await connection.execute('UPDATE holdings SET amount = ? WHERE user_id = ? AND coin_id = ?', [newAmount, user.id, coin]);
        }

        await connection.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [total, user.id]);
      }

      await connection.execute(
        'INSERT INTO trades (user_id, coin_id, coin_name, type, amount, price, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user.id, coin, coinInfo.name, type, qty, price, total]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return NextResponse.json({ ok: true, message: '거래 완료', price, total });

  } catch (error) {
    console.error('[trade]', error);
    return NextResponse.json({ error: '거래 실패' }, { status: 500 });
  }
}
