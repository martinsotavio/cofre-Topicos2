const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const schemas = require('../schemas');
const autenticar = require('../middlewares/auth');
const { validarBody } = require('../middlewares/validate');
const usuarioService = require('../services/usuarioService');
const doisFatoresService = require('../services/doisFatoresService');

const router = Router();

// Protege contra força bruta no login/registro
const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) =>
    res.status(429).json({ erro: 'Muitas tentativas, tente novamente em alguns minutos', codigo: 'TOO_MANY_REQUESTS' }),
});

router.use(limitador);

router.post('/registro', validarBody(schemas.registro), async (req, res) => {
  res.status(201).json(await usuarioService.registrar(req.body));
});

router.post('/login', validarBody(schemas.login), async (req, res) => {
  res.json(await usuarioService.login(req.body));
});

// 2FA (TOTP): exigem o usuário logado
router.post('/2fa/ativar', autenticar, async (req, res) => {
  res.json(await doisFatoresService.ativar(req.usuarioId));
});

router.post('/2fa/verificar', autenticar, validarBody(schemas.verificar2fa), async (req, res) => {
  res.json(await doisFatoresService.verificar(req.usuarioId, req.body));
});

router.post('/2fa/desativar', autenticar, validarBody(schemas.desativar2fa), async (req, res) => {
  res.json(await doisFatoresService.desativar(req.usuarioId, req.body));
});

module.exports = router;
