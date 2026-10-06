const jwt = require('jsonwebtoken');
const { app, prisma, request, limparBanco, criarUsuarioLogado } = require('./helpers');

beforeAll(limparBanco);
afterAll(() => prisma.$disconnect());

describe('Proteção JWT', () => {
  test('sem token retorna 401 TOKEN_MISSING', async () => {
    const res = await request(app).get('/usuarios/me').expect(401);
    expect(res.body.codigo).toBe('TOKEN_MISSING');
  });

  test('token inválido retorna 401 TOKEN_INVALID', async () => {
    const res = await request(app).get('/usuarios/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
    expect(res.body.codigo).toBe('TOKEN_INVALID');
  });

  test('token assinado com outro segredo é rejeitado', async () => {
    const token = jwt.sign({ sub: '1' }, 'outro-segredo');
    await request(app).get('/usuarios/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  test('token expirado retorna 401 TOKEN_EXPIRED', async () => {
    const token = jwt.sign({ sub: '1', exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
    const res = await request(app).get('/usuarios/me').set('Authorization', `Bearer ${token}`).expect(401);
    expect(res.body.codigo).toBe('TOKEN_EXPIRED');
  });
});

describe('/usuarios/me', () => {
  test('GET retorna o usuário do token', async () => {
    const { auth, usuario } = await criarUsuarioLogado({ nome: 'João' });
    const res = await request(app).get('/usuarios/me').set(auth).expect(200);
    expect(res.body).toMatchObject({ id: usuario.id, nome: 'João', totpAtivo: false });
    expect(res.body).not.toHaveProperty('senhaHash');
  });

  test('PUT atualiza só o nome sem pedir a senha atual', async () => {
    const { auth } = await criarUsuarioLogado();
    const res = await request(app).put('/usuarios/me').set(auth).send({ nome: 'Só o Nome' }).expect(200);
    expect(res.body.nome).toBe('Só o Nome');
  });

  test('PUT atualiza nome e senha (nova senha passa a valer no login)', async () => {
    const { auth, usuario, senha } = await criarUsuarioLogado();
    const res = await request(app)
      .put('/usuarios/me')
      .set(auth)
      .send({ nome: 'Novo Nome', senha: 'novaSenha999', senhaAtual: senha })
      .expect(200);
    expect(res.body.nome).toBe('Novo Nome');

    await request(app).post('/auth/login').send({ email: usuario.email, senha: 'novaSenha999' }).expect(200);
    await request(app).post('/auth/login').send({ email: usuario.email, senha: 'senha12345' }).expect(401);
  });

  test('PUT recusa e-mail de outro usuário (409) e corpo vazio (400)', async () => {
    const outro = await criarUsuarioLogado();
    const { auth } = await criarUsuarioLogado();
    await request(app).put('/usuarios/me').set(auth).send({ email: outro.usuario.email, senhaAtual: 'senha12345' }).expect(409);
    await request(app).put('/usuarios/me').set(auth).send({}).expect(400);
    await request(app).put('/usuarios/me').set(auth).send({ campoQueNaoExiste: 1 }).expect(400);
    await request(app).put('/usuarios/me').set(auth).send({ senhaAtual: 'senha12345' }).expect(400);
  });

  test('PUT de senha ou e-mail sem a senha atual dá 400', async () => {
    const { auth } = await criarUsuarioLogado();
    for (const corpo of [{ senha: 'novaSenha999' }, { email: 'novo@teste.com' }]) {
      const res = await request(app).put('/usuarios/me').set(auth).send(corpo).expect(400);
      expect(res.body.detalhes).toEqual([{ campo: 'senhaAtual', mensagem: 'Informe a senha atual para trocar a senha ou o e-mail' }]);
    }
  });

  test('PUT com senha atual errada dá 401 e não altera nada', async () => {
    const { auth, usuario, senha } = await criarUsuarioLogado();
    const res = await request(app)
      .put('/usuarios/me')
      .set(auth)
      .send({ email: 'roubado@teste.com', senhaAtual: 'chuteErrado1' })
      .expect(401);
    expect(res.body.codigo).toBe('INVALID_PASSWORD');

    await request(app).post('/auth/login').send({ email: usuario.email, senha }).expect(200);
  });

  test('PUT com senha atual errada não revela se o e-mail novo já existe', async () => {
    const outro = await criarUsuarioLogado();
    const { auth } = await criarUsuarioLogado();
    await request(app).put('/usuarios/me').set(auth).send({ email: outro.usuario.email, senhaAtual: 'chuteErrado1' }).expect(401);
  });

  test('DELETE remove a conta e todo o cofre em cascata', async () => {
    const { auth, usuario } = await criarUsuarioLogado();
    const pasta = await request(app).post('/pastas').set(auth).send({ nome: 'Trabalho' }).expect(201);
    await request(app).post('/credenciais').set(auth).send({ titulo: 'X', senha: 'y', pastaId: pasta.body.id }).expect(201);

    await request(app).delete('/usuarios/me').set(auth).expect(204);

    const res = await request(app).get('/usuarios/me').set(auth).expect(401);
    expect(res.body.codigo).toBe('TOKEN_INVALID');
    expect(await prisma.pasta.count({ where: { usuarioId: usuario.id } })).toBe(0);
    expect(await prisma.credencial.count({ where: { usuarioId: usuario.id } })).toBe(0);
  });
});
