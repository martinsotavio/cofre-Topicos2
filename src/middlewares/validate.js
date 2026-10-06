const AppError = require('../errors/AppError');

/** Valida req.body com um schema zod; erros viram 400 no errorHandler. */
const validarBody = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body ?? {});
  next();
};

/** Converte :id da rota em inteiro positivo. */
function parseId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'ID inválido', 'INVALID_ID');
  }
  return id;
}

module.exports = { validarBody, parseId };
