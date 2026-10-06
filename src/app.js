const express = require('express');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi');
const { errorHandler, rotaNaoEncontrada } = require('./middlewares/errorHandler');

const app = express();

// Atrás de proxy/túnel (Cloudflare, Render...), usa o IP real do cliente no rate limit
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Cofre de Senhas API' }));
app.get('/docs.json', (req, res) => res.json(openapi));

app.use(helmet());
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => res.json({ nome: 'Cofre de Senhas API', status: 'ok', docs: '/docs' }));

app.use('/auth', require('./routes/auth.routes'));
app.use('/usuarios', require('./routes/usuarios.routes'));
app.use('/pastas', require('./routes/pastas.routes'));
app.use('/credenciais', require('./routes/credenciais.routes'));
app.use('/gerador', require('./routes/gerador.routes'));

app.use(rotaNaoEncontrada);
app.use(errorHandler);

module.exports = app;
