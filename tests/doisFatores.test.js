const { authenticator } = require('otplib');
const { app, prisma, request, criarUsuarioLogado } = require('./helpers');

afterAll(() => prisma.$disconnect());

/** Gera um código que com certeza não é o atual (nem o vizinho aceito pela janela). */
const codigoErrado = (segredo) => {
  const valido = authenticator.generate(segredo);
  return String((Number(valido) + 500000) % 1000000).padStart(6, '0');
};

/** Cria usuário logado com 2FA já ativo e devolve também o segredo. */
async function usuarioCom2fa() {
  const u = await criarUsuarioLogado();
  const { body } = await request(app).post('/auth/2fa/ativar').set(u.auth).expect(200);
  await request(app)
    .post('/auth/2fa/verificar')
    .set(u.auth)
    .send({ codigo: authenticator.generate(body.segredo) })
    .expect(200);
  return { ...u, segredo: body.segredo };
}

describe('POST /auth/2fa/ativar', () => {
  test('gera segredo, link otpauth e QR code, ainda sem ativar', async () => {
    const u = await criarUsuarioLogado();
    const res = await request(app).post('/auth/2fa/ativar').set(u.auth).expect(200);

    expect(res.body.segredo).toMatch(/^[A-Z2-7]+$/);
    expect(res.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);

    const me = await request(app).get('/usuarios/me').set(u.auth).expect(200);
    expect(me.body.totpAtivo).toBe(false);
  });

  test('guarda o segredo cifrado no banco, nunca em texto puro', async () => {
    const u = await criarUsuarioLogado();
    const { body } = await request(app).post('/auth/2fa/ativar').set(u.auth).expect(200);

    const salvo = await prisma.usuario.findUnique({ where: { id: u.usuario.id } });
    expect(salvo.totpSecret).not.toContain(body.segredo);
    expect(JSON.parse(salvo.totpSecret)).toHaveProperty('authTag');
  });

  test('exige token (401)', async () => {
    await request(app).post('/auth/2fa/ativar').expect(401);
  });

  test('recusa se o 2FA já está ativo (409)', async () => {
    const u = await usuarioCom2fa();
    const res = await request(app).post('/auth/2fa/ativar').set(u.auth).expect(409);
    expect(res.body.codigo).toBe('TOTP_ALREADY_ACTIVE');
  });
});

describe('POST /auth/2fa/verificar', () => {
  test('código correto ativa o 2FA', async () => {
    const u = await criarUsuarioLogado();
    const { body } = await request(app).post('/auth/2fa/ativar').set(u.auth).expect(200);

    const res = await request(app)
      .post('/auth/2fa/verificar')
      .set(u.auth)
      .send({ codigo: authenticator.generate(body.segredo) })
      .expect(200);
    expect(res.body.totpAtivo).toBe(true);

    const me = await request(app).get('/usuarios/me').set(u.auth).expect(200);
    expect(me.body.totpAtivo).toBe(true);
    expect(me.body).not.toHaveProperty('totpSecret');
  });

  test('código errado não ativa (401)', async () => {
    const u = await criarUsuarioLogado();
    const { body } = await request(app).post('/auth/2fa/ativar').set(u.auth).expect(200);

    const res = await request(app)
      .post('/auth/2fa/verificar')
      .set(u.auth)
      .send({ codigo: codigoErrado(body.segredo) })
      .expect(401);
    expect(res.body.codigo).toBe('TOTP_INVALID');
  });

  test('recusa se o 2FA já está ativo (409)', async () => {
    const u = await usuarioCom2fa();
    const res = await request(app)
      .post('/auth/2fa/verificar')
      .set(u.auth)
      .send({ codigo: authenticator.generate(u.segredo) })
      .expect(409);
    expect(res.body.codigo).toBe('TOTP_ALREADY_ACTIVE');
  });

  test('sem ativação iniciada (400)', async () => {
    const u = await criarUsuarioLogado();
    const res = await request(app).post('/auth/2fa/verificar').set(u.auth).send({ codigo: '123456' }).expect(400);
    expect(res.body.codigo).toBe('TOTP_NOT_STARTED');
  });

  test('valida o formato do código (400)', async () => {
    const u = await criarUsuarioLogado();
    const res = await request(app).post('/auth/2fa/verificar').set(u.auth).send({ codigo: '12ab' }).expect(400);
    expect(res.body.codigo).toBe('VALIDATION_ERROR');
    expect(res.body.detalhes[0].campo).toBe('codigo');
  });
});

describe('POST /auth/login com 2FA ativo', () => {
  test('sem código pede o 2FA (401 TOTP_REQUIRED)', async () => {
    const u = await usuarioCom2fa();
    const res = await request(app).post('/auth/login').send({ email: u.usuario.email, senha: u.senha }).expect(401);
    expect(res.body.codigo).toBe('TOTP_REQUIRED');
  });

  test('com código errado é recusado (401 TOTP_INVALID)', async () => {
    const u = await usuarioCom2fa();
    const res = await request(app)
      .post('/auth/login')
      .send({ email: u.usuario.email, senha: u.senha, codigo: codigoErrado(u.segredo) })
      .expect(401);
    expect(res.body.codigo).toBe('TOTP_INVALID');
  });

  test('com código correto retorna o token', async () => {
    const u = await usuarioCom2fa();
    const res = await request(app)
      .post('/auth/login')
      .send({ email: u.usuario.email, senha: u.senha, codigo: authenticator.generate(u.segredo) })
      .expect(200);
    expect(res.body.token.split('.')).toHaveLength(3);
    expect(res.body.usuario.totpAtivo).toBe(true);
  });

  test('senha errada não revela que a conta tem 2FA', async () => {
    const u = await usuarioCom2fa();
    const res = await request(app).post('/auth/login').send({ email: u.usuario.email, senha: 'errada123' }).expect(401);
    expect(res.body.codigo).toBe('INVALID_CREDENTIALS');
  });

  test('usuário sem 2FA continua entrando só com senha', async () => {
    const u = await criarUsuarioLogado();
    await request(app).post('/auth/login').send({ email: u.usuario.email, senha: u.senha }).expect(200);
  });
});

describe('POST /auth/2fa/desativar', () => {
  test('com senha e código corretos desliga o 2FA', async () => {
    const u = await usuarioCom2fa();
    const res = await request(app)
      .post('/auth/2fa/desativar')
      .set(u.auth)
      .send({ senha: u.senha, codigo: authenticator.generate(u.segredo) })
      .expect(200);
    expect(res.body.totpAtivo).toBe(false);

    const salvo = await prisma.usuario.findUnique({ where: { id: u.usuario.id } });
    expect(salvo.totpSecret).toBeNull();
    await request(app).post('/auth/login').send({ email: u.usuario.email, senha: u.senha }).expect(200);
  });

  test('senha errada (401)', async () => {
    const u = await usuarioCom2fa();
    const res = await request(app)
      .post('/auth/2fa/desativar')
      .set(u.auth)
      .send({ senha: 'errada123', codigo: authenticator.generate(u.segredo) })
      .expect(401);
    expect(res.body.codigo).toBe('INVALID_PASSWORD');
  });

  test('código errado (401)', async () => {
    const u = await usuarioCom2fa();
    const res = await request(app)
      .post('/auth/2fa/desativar')
      .set(u.auth)
      .send({ senha: u.senha, codigo: codigoErrado(u.segredo) })
      .expect(401);
    expect(res.body.codigo).toBe('TOTP_INVALID');
  });

  test('2FA não ativo (400)', async () => {
    const u = await criarUsuarioLogado();
    const res = await request(app).post('/auth/2fa/desativar').set(u.auth).send({ senha: u.senha, codigo: '123456' }).expect(400);
    expect(res.body.codigo).toBe('TOTP_NOT_ACTIVE');
  });
});
