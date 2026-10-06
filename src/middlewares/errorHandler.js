const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');
const AppError = require('../errors/AppError');

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota ${req.method} ${req.path} não encontrada`, codigo: 'ROUTE_NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message, codigo: err.codigo });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: 'Dados inválidos',
      codigo: 'VALIDATION_ERROR',
      detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON malformado no corpo da requisição', codigo: 'INVALID_JSON' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisição muito grande (máximo 100kb)', codigo: 'PAYLOAD_TOO_LARGE' });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({ erro: 'Registro já existe', codigo: 'CONFLICT' });
  }

  console.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor', codigo: 'INTERNAL_ERROR' });
}

module.exports = { errorHandler, rotaNaoEncontrada };
