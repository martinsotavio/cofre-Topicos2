const crypto = require('crypto');
const { vaultKey } = require('../config');

const ALGORITMO = 'aes-256-gcm';

/** Cifra um texto com AES-256-GCM usando um IV aleatório por chamada. */
function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITMO, vaultKey, iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return {
    senhaCifrada: cifrado.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

/** Decifra e valida a integridade (authTag). Lança erro se o dado foi adulterado. */
function decifrar({ senhaCifrada, iv, authTag }) {
  const decipher = crypto.createDecipheriv(ALGORITMO, vaultKey, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(senhaCifrada, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

const CONJUNTOS = {
  minusculas: 'abcdefghijklmnopqrstuvwxyz',
  maiusculas: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numeros: '0123456789',
  simbolos: '!@#$%^&*()-_=+[]{};:,.<>?',
};

/** Gera senha com crypto.randomInt, garantindo ao menos um caractere de cada conjunto ativo. */
function gerarSenha({ tamanho = 20, maiusculas = true, numeros = true, simbolos = true } = {}) {
  const ativos = [CONJUNTOS.minusculas];
  if (maiusculas) ativos.push(CONJUNTOS.maiusculas);
  if (numeros) ativos.push(CONJUNTOS.numeros);
  if (simbolos) ativos.push(CONJUNTOS.simbolos);

  const todos = ativos.join('');
  const chars = ativos.map((c) => c[crypto.randomInt(c.length)]);
  while (chars.length < tamanho) chars.push(todos[crypto.randomInt(todos.length)]);

  // Fisher-Yates para não deixar os obrigatórios sempre no início
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = { cifrar, decifrar, gerarSenha };
