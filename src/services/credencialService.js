const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const { cifrar, decifrar } = require('../lib/crypto');

const comPasta = { pasta: { select: { id: true, nome: true } } };

// Nunca devolve a senha (nem cifrada) nas respostas comuns; só via /revelar
const formatar = ({ senhaCifrada, iv, authTag, ...credencial }) => credencial;

async function garantirPasta(usuarioId, pastaId) {
  if (pastaId == null) return;
  const pasta = await prisma.pasta.findFirst({ where: { id: pastaId, usuarioId } });
  if (!pasta) throw AppError.naoEncontrado('Pasta não encontrada');
}

async function registrarLog(usuarioId, credencialId, acao) {
  await prisma.logAcesso.create({ data: { usuarioId, credencialId, acao } });
}

async function buscarDoUsuario(usuarioId, id) {
  const credencial = await prisma.credencial.findFirst({ where: { id, usuarioId }, include: comPasta });
  if (!credencial) throw AppError.naoEncontrado('Credencial não encontrada');
  return credencial;
}

async function listar(usuarioId, { pastaId, busca } = {}) {
  const credenciais = await prisma.credencial.findMany({
    where: {
      usuarioId,
      ...(pastaId !== undefined && { pastaId }),
      ...(busca && { titulo: { contains: busca } }),
    },
    include: comPasta,
    orderBy: { titulo: 'asc' },
  });
  return credenciais.map(formatar);
}

async function buscar(usuarioId, id) {
  return formatar(await buscarDoUsuario(usuarioId, id));
}

async function criar(usuarioId, { senha, ...dados }) {
  await garantirPasta(usuarioId, dados.pastaId);
  const credencial = await prisma.credencial.create({
    data: { ...dados, ...cifrar(senha), usuarioId },
    include: comPasta,
  });
  await registrarLog(usuarioId, credencial.id, 'CRIAR');
  return formatar(credencial);
}

async function atualizar(usuarioId, id, { senha, ...dados }) {
  await buscarDoUsuario(usuarioId, id);
  await garantirPasta(usuarioId, dados.pastaId);
  const credencial = await prisma.credencial.update({
    where: { id },
    data: { ...dados, ...(senha && cifrar(senha)) },
    include: comPasta,
  });
  await registrarLog(usuarioId, id, 'ATUALIZAR');
  return formatar(credencial);
}

async function remover(usuarioId, id) {
  await buscarDoUsuario(usuarioId, id);
  await prisma.credencial.delete({ where: { id } });
}

async function revelar(usuarioId, id) {
  const credencial = await buscarDoUsuario(usuarioId, id);
  await registrarLog(usuarioId, id, 'REVELAR');
  return { id: credencial.id, titulo: credencial.titulo, login: credencial.login, senha: decifrar(credencial) };
}

async function listarLogs(usuarioId, id) {
  await buscarDoUsuario(usuarioId, id);
  return prisma.logAcesso.findMany({
    where: { credencialId: id },
    select: { id: true, acao: true, criadoEm: true },
    orderBy: { id: 'desc' },
  });
}

module.exports = { listar, buscar, criar, atualizar, remover, revelar, listarLogs };
