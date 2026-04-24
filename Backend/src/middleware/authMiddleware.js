const jwt = require('jsonwebtoken');

/**
 * Bắt buộc header: Authorization: Bearer <accessToken>
 * Gắn req.user = { id: ma_tai_khoan, role: ma_vai_tro }
 */
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Yêu cầu đăng nhập (thiếu Bearer token).' });
    }
    const token = header.slice(7).trim();
    if (!token) {
        return res.status(401).json({ message: 'Yêu cầu đăng nhập.' });
    }
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'CLINICARE_SECRET_KEY');
        req.user = { id: payload.id, role: payload.role };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
}

module.exports = { authMiddleware };
