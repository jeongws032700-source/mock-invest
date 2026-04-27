import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=krw',
      { next: { revalidate: 60 } }
      // revalidate: 60 — Next.js ISR 기능. 60초마다 새 데이터로 갱신
      // 매 요청마다 CoinGecko 호출하면 rate limit 걸릴 수 있어서 캐싱하는 거야
    );

    const data = await res.json();
    // { bitcoin: { krw: 130000000 }, ethereum: { krw: 5000000 } } 이런 형태로 옴

    return NextResponse.json({
      BTC: data.bitcoin.krw,   // 비트코인 원화 현재가
      ETH: data.ethereum.krw,  // 이더리움 원화 현재가
    });

  } catch {
    return NextResponse.json(
      { error: '시세 조회 실패' },
      { status: 500 }
    );
  }
}
