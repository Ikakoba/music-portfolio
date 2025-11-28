const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'music_secret';

function createToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, is_admin: !!user.is_admin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).send('Не авторизован');
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).send('Токен недействителен');
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).send('Требуется админ');
  }
  next();
}

module.exports = { createToken, requireAuth, requireAdmin };