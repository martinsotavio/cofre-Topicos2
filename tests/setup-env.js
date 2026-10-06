// Carregado antes de cada arquivo de teste: banco separado e chaves fixas de teste
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.VAULT_KEY = '0'.repeat(64);
process.env.BCRYPT_ROUNDS = '4';
