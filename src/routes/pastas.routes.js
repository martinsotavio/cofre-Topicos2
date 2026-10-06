const { Router } = require('express');
const schemas = require('../schemas');
const autenticar = require('../middlewares/auth');
const { validarBody, parseId } = require('../middlewares/validate');
const pastaService = require('../services/pastaService');

const router = Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  res.json(await pastaService.listar(req.usuarioId));
});

router.post('/', validarBody(schemas.pasta), async (req, res) => {
  res.status(201).json(await pastaService.criar(req.usuarioId, req.body));
});

router.get('/:id', async (req, res) => {
  res.json(await pastaService.buscar(req.usuarioId, parseId(req.params.id)));
});

router.get('/:id/credenciais', async (req, res) => {
  res.json(await pastaService.listarCredenciais(req.usuarioId, parseId(req.params.id)));
});

router.put('/:id', validarBody(schemas.pasta), async (req, res) => {
  res.json(await pastaService.atualizar(req.usuarioId, parseId(req.params.id), req.body));
});

router.delete('/:id', async (req, res) => {
  await pastaService.remover(req.usuarioId, parseId(req.params.id));
  res.status(204).end();
});

module.exports = router;
