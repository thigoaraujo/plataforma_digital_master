const express = require('express');
const router = express.Router();
const escolasController = require('../controllers/escolasController');

// Rota para listar escolas
router.get('/', escolasController.listarEscolas);

// Rota para adicionar uma escola
router.post('/', escolasController.adicionarEscola);

module.exports = router;
