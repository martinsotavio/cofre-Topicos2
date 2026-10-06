const { authenticator } = require('otplib');
const { cifrar, decifrar } = require('./crypto');

// Aceita o código do período anterior/seguinte (±30s) para tolerar relógios fora de sincronia
authenticator.options = { window: 1 };

/** O segredo TOTP fica cifrado no banco (AES-256-GCM), como as senhas do cofre. */
const guardarSegredo = (segredo) => JSON.stringify(cifrar(segredo));

/** Confere um código de 6 dígitos contra o segredo salvo do usuário. */
function codigoValido(totpSecret, codigo) {
  return Boolean(totpSecret) && authenticator.check(codigo, decifrar(JSON.parse(totpSecret)));
}

module.exports = { authenticator, guardarSegredo, codigoValido };
