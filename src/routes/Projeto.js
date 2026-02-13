const express = require('express');
const router = express.Router();
const projetosController = require('../controllers/projetosController');

// Rota para listar projetos
router.get('/', projetosController.listarProjetos);

// Rota para adicionar um projeto
router.post('/', projetosController.adicionarProjeto);

module.exports = router;
