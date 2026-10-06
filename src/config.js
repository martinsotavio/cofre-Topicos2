require('dotenv').config({ quiet: true });

for (const nome of ['DATABASE_URL', 'JWT_SECRET', 'VAULT_KEY']) {
  if (!process.env[nome]) {
    throw new Error(`Variável de ambiente ${nome} não definida (veja .env.example)`);
  }
}

const vaultKey = Buffer.from(process.env.VAULT_KEY, 'hex');
if (vaultKey.length !== 32) {
  throw new Error('VAULT_KEY deve ter 32 bytes em hexadecimal (64 caracteres)');
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  vaultKey,
};
