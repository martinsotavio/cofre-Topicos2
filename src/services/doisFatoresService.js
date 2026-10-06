const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const prisma = require('../lib/prisma');
const AppError = require('../errors/AppError');
const { authenticator, guardarSegredo, codigoValido } = require('../lib/totp');
const { buscar } = require('./usuarioService');

const EMISSOR = 'Cofre de Senhas';

async function buscarComSegredo(id) {
  await buscar(id);
  return prisma.usuario.findUnique({ where: { id } });
}

/** Gera um segredo novo (ainda inativo) e devolve o QR code para o app autenticador. */
async function ativar(id) {
  const usuario = await buscarComSegredo(id);
  if (usuario.totpAtivo) {
    throw new AppError(409, '2FA já está ativo', 'TOTP_ALREADY_ACTIVE');
  }

  const segredo = authenticator.generateSecret();
  await prisma.usuario.update({ where: { id }, data: { totpSecret: guardarSegredo(segredo) } });

  const otpauthUrl = authenticator.keyuri(usuario.email, EMISSOR, segredo);
  return {
    segredo,
    otpauthUrl,
    qrCode: await QRCode.toDataURL(otpauthUrl),
    instrucoes: 'Leia o QR code no app autenticador e confirme em POST /auth/2fa/verificar com o código gerado',
  };
}

/** Confirma o primeiro código do app e liga o 2FA. */
async function verificar(id, { codigo }) {
  const usuario = await buscarComSegredo(id);
  if (usuario.totpAtivo) {
    throw new AppError(409, '2FA já está ativo', 'TOTP_ALREADY_ACTIVE');
  }
  if (!usuario.totpSecret) {
    throw new AppError(400, 'Inicie a ativação em POST /auth/2fa/ativar', 'TOTP_NOT_STARTED');
  }
  if (!codigoValido(usuario.totpSecret, codigo)) {
    throw new AppError(401, 'Código 2FA inválido', 'TOTP_INVALID');
  }

  await prisma.usuario.update({ where: { id }, data: { totpAtivo: true } });
  return { mensagem: '2FA ativado', totpAtivo: true };
}

/** Desliga o 2FA; exige a senha da conta e um código válido. */
async function desativar(id, { senha, codigo }) {
  const usuario = await buscarComSegredo(id);
  if (!usuario.totpAtivo) {
    throw new AppError(400, '2FA não está ativo', 'TOTP_NOT_ACTIVE');
  }
  if (!(await bcrypt.compare(senha, usuario.senhaHash))) {
    throw new AppError(401, 'Senha incorreta', 'INVALID_PASSWORD');
  }
  if (!codigoValido(usuario.totpSecret, codigo)) {
    throw new AppError(401, 'Código 2FA inválido', 'TOTP_INVALID');
  }

  await prisma.usuario.update({ where: { id }, data: { totpAtivo: false, totpSecret: null } });
  return { mensagem: '2FA desativado', totpAtivo: false };
}

module.exports = { ativar, verificar, desativar };
