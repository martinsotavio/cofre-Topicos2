const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const AppError = require('../errors/AppError');
const prisma = require('../lib/prisma');

/** Exige header "Authorization: Bearer <token>" e injeta req.usuarioId. */
async function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new AppError(401, 'Token não informado. Use o header Authorization: Bearer <token>', 'TOKEN_MISSING');
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError(401, 'Token expirado, faça login novamente', 'TOKEN_EXPIRED');
    }
    throw new AppError(401, 'Token inválido', 'TOKEN_INVALID');
  }

  // O JWT continua válido depois que a conta é excluída; sem esta checagem a conta "fantasma" geraria erro no banco
  const usuario = await prisma.usuario.findUnique({ where: { id: Number(payload.sub) }, select: { id: true } });
  if (!usuario) {
    throw new AppError(401, 'Token inválido: a conta não existe mais', 'TOKEN_INVALID');
  }

  req.usuarioId = usuario.id;
  next();
}

module.exports = autenticar;
