import jwt from 'jsonwebtoken';

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;

    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production.');
    }

    return 'mock-invest-secret';
}

// 토큰 만들기 - 로그인성공했을 때 id, email 담아서 토큰 발급
export function signToken(payload: { id: number; email: string }) {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d'});
    //7일짜리 토큰
}

// 토큰 검증 — 요청 헤더에 담긴 토큰이 유효한지 확인
export function verifyToken(token: string) {
    return jwt.verify(token, getJwtSecret()) as { id: number; email: string };
    // 유효하면 토큰 안에 담긴 유저 정보 반환
    // 유효하지 않으면 에러 던짐
}
