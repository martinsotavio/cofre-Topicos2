const { app, prisma, request, limparBanco, criarUsuarioLogado } = require('./helpers');

let dono;
let intruso;
let pasta;

beforeAll(async () => {
  await limparBanco();
  dono = await criarUsuarioLogado();
  intruso = await criarUsuarioLogado();
  pasta = (await request(app).post('/pastas').set(dono.auth).send({ nome: 'Dev' })).body;
});
afterAll(() => prisma.$disconnect());

const nova = { titulo: 'GitHub', url: 'https://github.com', login: 'maria', senha: 'super-secreta-123', notas: 'pessoal' };

describe('CRUD /credenciais', () => {
  let id;

  test('exige autenticação', async () => {
    await request(app).get('/credenciais').expect(401);
    await request(app).post('/credenciais').send(nova).expect(401);
  });

  test('POST cria credencial sem devolver a senha', async () => {
    const res = await request(app).post('/credenciais').set(dono.auth).send({ ...nova, pastaId: pasta.id }).expect(201);
    expect(res.body).toMatchObject({ titulo: 'GitHub', login: 'maria', pasta: { id: pasta.id, nome: 'Dev' } });
    expect(res.body).not.toHaveProperty('senha');
    expect(res.body).not.toHaveProperty('senhaCifrada');
    id = res.body.id;
  });

  test('a senha fica cifrada no banco', async () => {
    const salvo = await prisma.credencial.findUnique({ where: { id } });
    expect(salvo.senhaCifrada).not.toBe(nova.senha);
    expect(salvo.senhaCifrada).not.toContain('secreta');
    expect(salvo.iv).toBeTruthy();
    expect(salvo.authTag).toBeTruthy();
  });

  test('POST valida campos (400)', async () => {
    const res = await request(app).post('/credenciais').set(dono.auth).send({ url: 'nao-e-url' }).expect(400);
    expect(res.body.detalhes.map((d) => d.campo).sort()).toEqual(['senha', 'titulo', 'url']);
  });

  test('POST com pasta de outro usuário dá 404', async () => {
    const res = await request(app).post('/credenciais').set(intruso.auth).send({ ...nova, pastaId: pasta.id }).expect(404);
    expect(res.body.erro).toBe('Pasta não encontrada');
  });

  test('GET lista com filtros por pasta e busca', async () => {
    await request(app).post('/credenciais').set(dono.auth).send({ titulo: 'Gmail', senha: 'abc' }).expect(201);

    expect((await request(app).get('/credenciais').set(dono.auth).expect(200)).body).toHaveLength(2);
    const porPasta = await request(app).get(`/credenciais?pastaId=${pasta.id}`).set(dono.auth).expect(200);
    expect(porPasta.body.map((c) => c.titulo)).toEqual(['GitHub']);
    const busca = await request(app).get('/credenciais?busca=Gm').set(dono.auth).expect(200);
    expect(busca.body.map((c) => c.titulo)).toEqual(['Gmail']);

    expect((await request(app).get('/credenciais').set(intruso.auth).expect(200)).body).toHaveLength(0);
  });

  test('busca repetida na URL dá 400, não erro interno', async () => {
    const res = await request(app).get('/credenciais?busca=a&busca=b').set(dono.auth).expect(400);
    expect(res.body.detalhes[0].campo).toBe('busca');
  });

  test('pastaId como texto dá 400 com mensagem em português', async () => {
    const res = await request(app).post('/credenciais').set(dono.auth).send({ titulo: 'a', senha: 'b', pastaId: '1' }).expect(400);
    expect(res.body.detalhes[0]).toEqual({ campo: 'pastaId', mensagem: 'pastaId deve ser um número' });
  });

  test('GET /:id busca uma credencial', async () => {
    const res = await request(app).get(`/credenciais/${id}`).set(dono.auth).expect(200);
    expect(res.body.titulo).toBe('GitHub');
    await request(app).get('/credenciais/999999').set(dono.auth).expect(404);
  });

  test('GET /:id/revelar decifra a senha', async () => {
    const res = await request(app).get(`/credenciais/${id}/revelar`).set(dono.auth).expect(200);
    expect(res.body).toEqual({ id, titulo: 'GitHub', login: 'maria', senha: 'super-secreta-123' });
  });

  test('PUT atualiza parcialmente e recifra a senha nova', async () => {
    const antes = await prisma.credencial.findUnique({ where: { id } });
    const res = await request(app).put(`/credenciais/${id}`).set(dono.auth).send({ senha: 'nova-senha', pastaId: null }).expect(200);
    expect(res.body).toMatchObject({ titulo: 'GitHub', pastaId: null });

    const depois = await prisma.credencial.findUnique({ where: { id } });
    expect(depois.iv).not.toBe(antes.iv);
    const revelada = await request(app).get(`/credenciais/${id}/revelar`).set(dono.auth).expect(200);
    expect(revelada.body.senha).toBe('nova-senha');

    await request(app).put(`/credenciais/${id}`).set(dono.auth).send({}).expect(400);
  });

  test('GET /:id/logs mostra o histórico de acesso', async () => {
    const res = await request(app).get(`/credenciais/${id}/logs`).set(dono.auth).expect(200);
    expect(res.body.map((l) => l.acao)).toEqual(['REVELAR', 'ATUALIZAR', 'REVELAR', 'CRIAR']);
  });

  test('usuário não acessa credencial de outro (404)', async () => {
    await request(app).get(`/credenciais/${id}`).set(intruso.auth).expect(404);
    await request(app).get(`/credenciais/${id}/revelar`).set(intruso.auth).expect(404);
    await request(app).get(`/credenciais/${id}/logs`).set(intruso.auth).expect(404);
    await request(app).put(`/credenciais/${id}`).set(intruso.auth).send({ titulo: 'hack' }).expect(404);
    await request(app).delete(`/credenciais/${id}`).set(intruso.auth).expect(404);
  });

  test('DELETE remove a credencial', async () => {
    await request(app).delete(`/credenciais/${id}`).set(dono.auth).expect(204);
    await request(app).get(`/credenciais/${id}`).set(dono.auth).expect(404);
  });
});

describe('GET /gerador', () => {
  test('gera senha com padrão de 20 caracteres', async () => {
    const res = await request(app).get('/gerador').expect(200);
    expect(res.body.senha).toHaveLength(20);
  });

  test('aceita opções e valida limites', async () => {
    const res = await request(app).get('/gerador?tamanho=10&simbolos=false&numeros=false&maiusculas=false').expect(200);
    expect(res.body.senha).toMatch(/^[a-z]{10}$/);
    await request(app).get('/gerador?tamanho=3').expect(400);
    await request(app).get('/gerador?simbolos=talvez').expect(400);
  });
});
