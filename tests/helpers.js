const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');

let contador = 0;

async function limparBanco() {
  await prisma.logAcesso.deleteMany();
  await prisma.credencial.deleteMany();
  await prisma.pasta.deleteMany();
  await prisma.usuario.deleteMany();
}

/** Registra um usuário novo e devolve { token, usuario, auth } onde auth é o header pronto. */
async function criarUsuarioLogado(dados = {}) {
  contador += 1;
  const usuario = { nome: 'Usuário Teste', email: `user${contador}-${Date.now()}@teste.com`, senha: 'senha12345', ...dados };
  await request(app).post('/auth/registro').send(usuario).expect(201);
  const res = await request(app).post('/auth/login').send({ email: usuario.email, senha: usuario.senha }).expect(200);
  return { token: res.body.token, usuario: res.body.usuario, senha: usuario.senha, auth: { Authorization: `Bearer ${res.body.token}` } };
}

module.exports = { app, prisma, request, limparBanco, criarUsuarioLogado };
