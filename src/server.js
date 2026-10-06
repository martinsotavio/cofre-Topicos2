const { port } = require('./config');
const app = require('./app');

app.listen(port, () => {
  console.log(`Cofre de Senhas API rodando em http://localhost:${port}`);
  console.log(`Documentação: http://localhost:${port}/docs`);
});
