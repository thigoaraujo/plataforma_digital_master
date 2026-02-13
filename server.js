const express = require('express');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch'); // Importação correta

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Saúde do servidor
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Rota de API para dados completos
app.get('/api/dados-completos', async (req, res) => {
  try {
    const url = 'https://api.zerosheets.com/v1/hcj';
    const response = await fetch(url, {
      method: 'GET'
    });

    if (!response.ok) {
      console.error(`ZeroSheets HTTP ${response.status}`);
      return res.status(502).json({ error: `Falha ao buscar dados (HTTP ${response.status})` });
    }

    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
      console.error('ZeroSheets retornou formato não-array');
      return res.status(502).json({ error: 'Formato inesperado da ZeroSheets' });
    }

    // Log the first item to see the structure
    if (rawData.length > 0) {
      console.log('Sample data item:', rawData[0]);
    }

    // Transformar os dados para o formato que o frontend espera
    const dadosFormatados = rawData.map(item => ({
      escola_id: Number(item.escola_id ?? item.EscolaID ?? item._escola_id ?? 0),
      escola_nome: item.escola_nome ?? item.EscolaNome ?? '',
      escola_nome_curto: item.escola_nome_curto ?? item.EscolaNomeCurto ?? '',
      latitude: Number(item.latitude ?? item.Latitude ?? 0),
      longitude: Number(item.longitude ?? item.Longitude ?? 0),
      programa_id: Number(item.programa_id ?? item.ProgramaID ?? item._programa_id ?? 0),
      programa_nome: item.programa_nome ?? item.ProgramaNome ?? '',
      programa_descricao: item.programa_descricao ?? item.Descricao ?? '',
      status: item.status ?? item.Status ?? 'Não Iniciado'
    }));

    res.json(dadosFormatados);
  } catch (err) {
    console.error('Erro ao buscar dados:', err);
    res.status(500).json({ error: 'Falha ao buscar dados.' });
  }
});

// Rota de API para programas
app.get('/api/programas', async (req, res) => {
  try {
    const url = 'https://api.zerosheets.com/v1/hcj';
    const response = await fetch(url, {
      method: 'GET'
    });

    if (!response.ok) {
      console.error(`ZeroSheets HTTP ${response.status}`);
      return res.status(502).json({ error: `Falha ao buscar programas (HTTP ${response.status})` });
    }

    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
      console.error('ZeroSheets retornou formato não-array');
      return res.status(502).json({ error: 'Formato inesperado da ZeroSheets' });
    }

    // Filtrar e transformar os dados para programas únicos
    const programasUnicos = [];
    const seen = new Set();
    rawData.forEach(item => {
      const programaNome = item.programa_nome ?? item.ProgramaNome ?? '';
      if (programaNome && programaNome.trim() !== '' && !seen.has(programaNome)) {
        seen.add(programaNome);
        programasUnicos.push({
          id: Number(item.programa_id ?? item.ProgramaID ?? item._programa_id),
          nome: programaNome,
          descricao: item.programa_descricao ?? item.Descricao ?? ''
        });
      }
    });

    res.json(programasUnicos);
  } catch (err) {
    console.error('Erro ao buscar programas:', err);
    res.status(500).json({ error: 'Falha ao buscar programas.' });
  }
});

// Rotas amigáveis para páginas HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dados', (req, res) => res.sendFile(path.join(__dirname, 'public', 'Dados.html')));
app.get('/dados.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'Dados.html')));
app.get('/mapa', (req, res) => res.sendFile(path.join(__dirname, 'public', 'Mapa.html')));
app.get('/pg2', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pg2.html')));
app.get('/asanorte', (req, res) => res.sendFile(path.join(__dirname, 'public', 'asanorte.html')));
app.get('/cruzeiro1', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cruzeiro1.html')));
app.get('/elefantebranco', (req, res) => res.sendFile(path.join(__dirname, 'public', 'elefantebranco.html')));
app.get('/freire', (req, res) => res.sendFile(path.join(__dirname, 'public', 'freire.html')));
app.get('/leste', (req, res) => res.sendFile(path.join(__dirname, 'public', 'leste.html')));
app.get('/oeste', (req, res) => res.sendFile(path.join(__dirname, 'public', 'oeste.html')));

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
