const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Recria o banco de teste do zero: apaga o arquivo e aplica as migrations
module.exports = () => {
  const arquivo = path.join(__dirname, '..', 'prisma', 'test.db');
  fs.rmSync(arquivo, { force: true });
  fs.rmSync(`${arquivo}-journal`, { force: true });
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  });
};
