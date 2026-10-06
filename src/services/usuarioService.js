const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const { jwtSecret, jwtExpiresIn, bcryptRounds } = require('../config');
const { codigoValido } = require('../lib/totp');

// Hash fixo usado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails estão cadastrados
const HASH_FALSO = bcrypt.hashSync('senha-inexistente', 10);

const formatar = ({ senhaHash, totpSecret, ...usuario }) => usuario;

async function garantirEmailLivre(email, ignorarId) {
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente && existente.id !== ignorarId) {
    throw new AppError(409, 'E-mail já cadastrado', 'EMAIL_IN_USE');
  }
}

async function registrar({ nome, email, senha }) {
  await garantirEmailLivre(email);
  const usuario = await prisma.usuario.create({
    data: { nome, email, senhaHash: await bcrypt.hash(senha, bcryptRounds) },
  });
  return formatar(usuario);
}

async function login({ email, senha, codigo }) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const senhaOk = await bcrypt.compare(senha, usuario ? usuario.senhaHash : HASH_FALSO);
  if (!usuario || !senhaOk) {
    throw new AppError(401, 'E-mail ou senha incorretos', 'INVALID_CREDENTIALS');
  }

  // Só depois da senha correta, para não revelar a quem não sabe a senha que a conta tem 2FA
  if (usuario.totpAtivo) {
    if (!codigo) {
      throw new AppError(401, 'Informe o código do app autenticador no campo "codigo"', 'TOTP_REQUIRED');
    }
    if (!codigoValido(usuario.totpSecret, codigo)) {
      throw new AppError(401, 'Código 2FA inválido', 'TOTP_INVALID');
    }
  }

  const token = jwt.sign({ sub: String(usuario.id) }, jwtSecret, { expiresIn: jwtExpiresIn });
  return { token, tipo: 'Bearer', expiraEm: jwtExpiresIn, usuario: formatar(usuario) };
}

async function buscar(id) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw AppError.naoEncontrado('Usuário não encontrado');
  return formatar(usuario);
}

async function atualizar(id, { nome, email, senha, senhaAtual }) {
  await buscar(id);
  if (senha || email) {
    const { senhaHash } = await prisma.usuario.findUnique({ where: { id } });
    if (!(await bcrypt.compare(senhaAtual, senhaHash))) {
      throw new AppError(401, 'Senha atual incorreta', 'INVALID_PASSWORD');
    }
  }
  if (email) await garantirEmailLivre(email, id);
  const data = { nome, email };
  if (senha) data.senhaHash = await bcrypt.hash(senha, bcryptRounds);
  return formatar(await prisma.usuario.update({ where: { id }, data }));
}

async function remover(id) {
  await buscar(id);
  await prisma.usuario.delete({ where: { id } });
}

module.exports = { registrar, login, buscar, atualizar, remover };
