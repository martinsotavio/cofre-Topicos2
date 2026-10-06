const { Router } = require('express');
const schemas = require('../schemas');
const autenticar = require('../middlewares/auth');
const { validarBody } = require('../middlewares/validate');
const usuarioService = require('../services/usuarioService');

const router = Router();
router.use(autenticar);

router.get('/me', async (req, res) => {
  res.json(await usuarioService.buscar(req.usuarioId));
});

router.put('/me', validarBody(schemas.atualizarUsuario), async (req, res) => {
  res.json(await usuarioService.atualizar(req.usuarioId, req.body));
});

router.delete('/me', async (req, res) => {
  await usuarioService.remover(req.usuarioId);
  res.status(204).end();
});

module.exports = router;
