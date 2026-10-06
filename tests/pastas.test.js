const { app, prisma, request, limparBanco, criarUsuarioLogado } = require('./helpers');

let dono;
let intruso;

beforeAll(async () => {
  await limparBanco();
  dono = await criarUsuarioLogado();
  intruso = await criarUsuarioLogado();
});
afterAll(() => prisma.$disconnect());

describe('CRUD /pastas', () => {
  let pastaId;

  test('exige autenticação', async () => {
    await request(app).get('/pastas').expect(401);
  });

  test('POST cria pasta', async () => {
    const res = await request(app).post('/pastas').set(dono.auth).send({ nome: 'Bancos' }).expect(201);
    expect(res.body).toMatchObject({ nome: 'Bancos', usuarioId: dono.usuario.id, totalCredenciais: 0 });
    pastaId = res.body.id;
  });

  test('POST recusa nome duplicado (409) e nome vazio (400)', async () => {
    await request(app).post('/pastas').set(dono.auth).send({ nome: 'Bancos' }).expect(409);
    await request(app).post('/pastas').set(dono.auth).send({ nome: '   ' }).expect(400);
  });

  test('outro usuário pode ter pasta com o mesmo nome', async () => {
    await request(app).post('/pastas').set(intruso.auth).send({ nome: 'Bancos' }).expect(201);
  });

  test('GET lista só as pastas do usuário', async () => {
    const res = await request(app).get('/pastas').set(dono.auth).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(pastaId);
  });

  test('GET /:id busca a pasta; id inválido dá 400', async () => {
    const res = await request(app).get(`/pastas/${pastaId}`).set(dono.auth).expect(200);
    expect(res.body.nome).toBe('Bancos');
    await request(app).get('/pastas/abc').set(dono.auth).expect(400);
    await request(app).get('/pastas/999999').set(dono.auth).expect(404);
  });

  test('PUT renomeia', async () => {
    const res = await request(app).put(`/pastas/${pastaId}`).set(dono.auth).send({ nome: 'Financeiro' }).expect(200);
    expect(res.body.nome).toBe('Financeiro');
  });

  test('usuário não acessa pasta de outro (404)', async () => {
    await request(app).get(`/pastas/${pastaId}`).set(intruso.auth).expect(404);
    await request(app).put(`/pastas/${pastaId}`).set(intruso.auth).send({ nome: 'Hack' }).expect(404);
    await request(app).delete(`/pastas/${pastaId}`).set(intruso.auth).expect(404);
    await request(app).get(`/pastas/${pastaId}/credenciais`).set(intruso.auth).expect(404);
  });
});

describe('GET /pastas/:id/credenciais (relacionamento)', () => {
  test('retorna a pasta com as credenciais dela e nenhuma senha', async () => {
    const pasta = (await request(app).post('/pastas').set(dono.auth).send({ nome: 'Redes' }).expect(201)).body;
    const outra = (await request(app).post('/pastas').set(dono.auth).send({ nome: 'Outra' }).expect(201)).body;
    await request(app).post('/credenciais').set(dono.auth).send({ titulo: 'Instagram', senha: 's1', pastaId: pasta.id });
    await request(app).post('/credenciais').set(dono.auth).send({ titulo: 'Facebook', senha: 's2', pastaId: pasta.id });
    await request(app).post('/credenciais').set(dono.auth).send({ titulo: 'Fora', senha: 's3', pastaId: outra.id });

    const res = await request(app).get(`/pastas/${pasta.id}/credenciais`).set(dono.auth).expect(200);
    expect(res.body).toMatchObject({ id: pasta.id, nome: 'Redes', totalCredenciais: 2 });
    expect(res.body.credenciais.map((c) => c.titulo)).toEqual(['Facebook', 'Instagram']);
    for (const c of res.body.credenciais) {
      expect(c).not.toHaveProperty('senha');
      expect(c).not.toHaveProperty('senhaCifrada');
    }
  });

  test('DELETE da pasta mantém as credenciais, sem pasta', async () => {
    const pasta = (await request(app).post('/pastas').set(dono.auth).send({ nome: 'Temporária' }).expect(201)).body;
    const cred = (await request(app).post('/credenciais').set(dono.auth).send({ titulo: 'Fica', senha: 'x', pastaId: pasta.id })).body;

    await request(app).delete(`/pastas/${pasta.id}`).set(dono.auth).expect(204);
    await request(app).get(`/pastas/${pasta.id}`).set(dono.auth).expect(404);

    const res = await request(app).get(`/credenciais/${cred.id}`).set(dono.auth).expect(200);
    expect(res.body.pastaId).toBeNull();
  });
});
