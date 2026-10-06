const { Prisma } = require('@prisma/client');
const { errorHandler } = require('../src/middlewares/errorHandler');

/** Resposta falsa do Express que guarda status e corpo. */
function respostaFalsa() {
  const res = {};
  res.status = (codigo) => Object.assign(res, { statusCode: codigo });
  res.json = (corpo) => Object.assign(res, { corpo });
  return res;
}

describe('errorHandler', () => {
  test('erro inesperado vira 500 genérico, sem vazar detalhes internos', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = respostaFalsa();

    errorHandler(new Error('senha do banco: 123'), {}, res);

    expect(res.statusCode).toBe(500);
    expect(res.corpo).toEqual({ erro: 'Erro interno do servidor', codigo: 'INTERNAL_ERROR' });
    console.error.mockRestore();
  });

  test('violação de chave única do Prisma (P2002) vira 409', () => {
    const res = respostaFalsa();
    const erro = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'teste' });

    errorHandler(erro, {}, res);

    expect(res.statusCode).toBe(409);
    expect(res.corpo.codigo).toBe('CONFLICT');
  });
});
