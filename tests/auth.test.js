const { app, prisma, request, limparBanco, criarUsuarioLogado } = require('./helpers');

const usuario = { nome: 'Maria Silva', email: 'maria@teste.com', senha: 'senha12345' };

beforeAll(limparBanco);
afterAll(() => prisma.$disconnect());

describe('POST /auth/registro', () => {
  test('cria usuário e não expõe o hash da senha', async () => {
    const res = await request(app).post('/auth/registro').send(usuario).expect(201);
    expect(res.body).toMatchObject({ id: expect.any(Number), nome: 'Maria Silva', email: 'maria@teste.com' });
    expect(res.body).not.toHaveProperty('senhaHash');
    expect(res.body).not.toHaveProperty('totpSecret');

    const salvo = await prisma.usuario.findUnique({ where: { email: usuario.email } });
    expect(salvo.senhaHash).not.toBe(usuario.senha);
  });

  test('normaliza o e-mail e recusa duplicado (409)', async () => {
    const res = await request(app)
      .post('/auth/registro')
      .send({ ...usuario, email: '  MARIA@teste.com ' })
      .expect(409);
    expect(res.body).toEqual({ erro: 'E-mail já cadastrado', codigo: 'EMAIL_IN_USE' });
  });

  test('valida campos com mensagens claras (400)', async () => {
    const res = await request(app).post('/auth/registro').send({ nome: 'A', email: 'invalido', senha: '123' }).expect(400);
    expect(res.body.codigo).toBe('VALIDATION_ERROR');
    expect(res.body.detalhes.map((d) => d.campo).sort()).toEqual(['email', 'nome', 'senha']);
  });

  test('JSON malformado retorna 400', async () => {
    const res = await request(app)
      .post('/auth/registro')
      .set('Content-Type', 'application/json')
      .send('{"nome": ')
      .expect(400);
    expect(res.body.codigo).toBe('INVALID_JSON');
  });
});

describe('POST /auth/login', () => {
  test('retorna token JWT com credenciais corretas', async () => {
    const res = await request(app).post('/auth/login').send({ email: usuario.email, senha: usuario.senha }).expect(200);
    expect(res.body.token.split('.')).toHaveLength(3);
    expect(res.body.tipo).toBe('Bearer');
    expect(res.body.usuario.email).toBe(usuario.email);
  });

  test('senha errada e e-mail inexistente dão a mesma resposta (401)', async () => {
    const senhaErrada = await request(app).post('/auth/login').send({ email: usuario.email, senha: 'errada123' }).expect(401);
    const inexistente = await request(app).post('/auth/login').send({ email: 'nao@existe.com', senha: 'errada123' }).expect(401);
    expect(senhaErrada.body).toEqual(inexistente.body);
    expect(senhaErrada.body.codigo).toBe('INVALID_CREDENTIALS');
  });

  test('exige e-mail e senha (400)', async () => {
    await request(app).post('/auth/login').send({}).expect(400);
  });
});

describe('Rotas gerais', () => {
  test('GET / responde status da API', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.body.status).toBe('ok');
  });

  test('rota inexistente retorna 404 em JSON', async () => {
    const res = await request(app).get('/nao-existe').expect(404);
    expect(res.body.codigo).toBe('ROUTE_NOT_FOUND');
  });

  test('corpo acima de 100kb retorna 413', async () => {
    const res = await request(app).post('/auth/registro').send({ nome: 'a'.repeat(120 * 1024) }).expect(413);
    expect(res.body.codigo).toBe('PAYLOAD_TOO_LARGE');
  });

  test('token de conta excluída não acessa nada (401)', async () => {
    const { auth } = await criarUsuarioLogado();
    await request(app).delete('/usuarios/me').set(auth).expect(204);
    const res = await request(app).post('/pastas').set(auth).send({ nome: 'Fantasma' }).expect(401);
    expect(res.body.codigo).toBe('TOKEN_INVALID');
  });

  test('documentação OpenAPI disponível', async () => {
    const res = await request(app).get('/docs.json').expect(200);
    expect(res.body.openapi).toMatch(/^3\./);
    await request(app).get('/docs/').expect(200);
  });
});
