const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const credencialService = require('./credencialService');

const comContagem = { _count: { select: { credenciais: true } } };

const formatar = ({ _count, ...pasta }) => ({ ...pasta, totalCredenciais: _count.credenciais });

async function garantirNomeLivre(usuarioId, nome, ignorarId) {
  const existente = await prisma.pasta.findUnique({ where: { usuarioId_nome: { usuarioId, nome } } });
  if (existente && existente.id !== ignorarId) {
    throw new AppError(409, 'Já existe uma pasta com esse nome', 'FOLDER_NAME_IN_USE');
  }
}

async function listar(usuarioId) {
  const pastas = await prisma.pasta.findMany({ where: { usuarioId }, include: comContagem, orderBy: { nome: 'asc' } });
  return pastas.map(formatar);
}

/** Busca filtrando pelo dono: pasta de outro usuário responde 404, sem revelar que existe. */
async function buscar(usuarioId, id) {
  const pasta = await prisma.pasta.findFirst({ where: { id, usuarioId }, include: comContagem });
  if (!pasta) throw AppError.naoEncontrado('Pasta não encontrada');
  return formatar(pasta);
}

async function criar(usuarioId, { nome }) {
  await garantirNomeLivre(usuarioId, nome);
  return formatar(await prisma.pasta.create({ data: { nome, usuarioId }, include: comContagem }));
}

async function atualizar(usuarioId, id, { nome }) {
  await buscar(usuarioId, id);
  await garantirNomeLivre(usuarioId, nome, id);
  return formatar(await prisma.pasta.update({ where: { id }, data: { nome }, include: comContagem }));
}

/** Remove a pasta; as credenciais dela não são apagadas, ficam sem pasta (onDelete: SetNull). */
async function remover(usuarioId, id) {
  await buscar(usuarioId, id);
  await prisma.pasta.delete({ where: { id } });
}

async function listarCredenciais(usuarioId, id) {
  const pasta = await buscar(usuarioId, id);
  const credenciais = await credencialService.listar(usuarioId, { pastaId: id });
  return { ...pasta, credenciais };
}

module.exports = { listar, buscar, criar, atualizar, remover, listarCredenciais };
