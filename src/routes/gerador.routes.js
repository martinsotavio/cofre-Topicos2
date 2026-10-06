const { Router } = require('express');
const schemas = require('../schemas');
const { gerarSenha } = require('../lib/crypto');

const router = Router();

router.get('/', (req, res) => {
  const opcoes = schemas.gerador.parse(req.query);
  res.json({ senha: gerarSenha(opcoes), ...opcoes });
});

module.exports = router;
