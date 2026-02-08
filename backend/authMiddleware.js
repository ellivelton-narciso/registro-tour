const jwt = require('jsonwebtoken');
const pool = require('./db/connection');

module.exports = async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ error: 'Token malformado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      'SELECT id FROM tokens WHERE token = $1 AND expire_at > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    req.user = decoded;

    return next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'Token inválido.' });
  }
};
