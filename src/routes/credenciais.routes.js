const { Router } = require('express');
const schemas = require('../schemas');
const autenticar = require('../middlewares/auth');
const { validarBody, parseId } = require('../middlewares/validate');
const credencialService = require('../services/credencialService');

const router = Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  const { pastaId } = req.query;
  const filtros = schemas.filtrosCredencial.parse({ busca: req.query.busca });
  if (pastaId !== undefined) filtros.pastaId = parseId(pastaId);
  res.json(await credencialService.listar(req.usuarioId, filtros));
});

router.post('/', validarBody(schemas.criarCredencial), async (req, res) => {
  res.status(201).json(await credencialService.criar(req.usuarioId, req.body));
});

router.get('/:id', async (req, res) => {
  res.json(await credencialService.buscar(req.usuarioId, parseId(req.params.id)));
});

router.get('/:id/revelar', async (req, res) => {
  res.json(await credencialService.revelar(req.usuarioId, parseId(req.params.id)));
});

router.get('/:id/logs', async (req, res) => {
  res.json(await credencialService.listarLogs(req.usuarioId, parseId(req.params.id)));
});

router.put('/:id', validarBody(schemas.atualizarCredencial), async (req, res) => {
  res.json(await credencialService.atualizar(req.usuarioId, parseId(req.params.id), req.body));
});

router.delete('/:id', async (req, res) => {
  await credencialService.remover(req.usuarioId, parseId(req.params.id));
  res.status(204).end();
});

module.exports = router;
