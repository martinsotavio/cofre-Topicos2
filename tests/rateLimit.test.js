const { app, prisma, request } = require('./helpers');

afterAll(() => {
  process.env.NODE_ENV = 'test';
  return prisma.$disconnect();
});

test('rotas /auth bloqueiam após 20 tentativas em 15 minutos (429)', async () => {
  // O limitador fica desligado nos outros testes; aqui ligamos de propósito
  process.env.NODE_ENV = 'rate-limit';

  for (let i = 0; i < 20; i++) {
    await request(app).post('/auth/login').send({}).expect(400);
  }
  const res = await request(app).post('/auth/login').send({}).expect(429);
  expect(res.body.codigo).toBe('TOO_MANY_REQUESTS');
});
