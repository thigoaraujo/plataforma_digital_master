const express = require('express');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;
const ZERO_SHEETS_URL = 'https://api.zerosheets.com/v1/hcj';
const CACHE_TTL_MS = 5 * 60 * 1000;
let dadosCache = { ts: 0, data: null };
const COORDENADAS_FALLBACK = {
  'CEMI Cruzeiro': [-15.789, -47.9401],
  'CEM Asa Norte': [-15.750, -47.880],
  'CEM Elefante Branco': [-15.800, -47.860],
  'CEM Elefetante Branco': [-15.800, -47.860],
  'CEM Paulo Freire': [-15.770, -47.890],
  'CEM St Leste': [-15.790, -47.870],
  'CEM St Oeste': [-15.780, -47.880]
};
const SIGLAS_ESCOLAS = {
  'CEMI Cruzeiro': 'CEMI',
  'CEM Asa Norte': 'CAN',
  'CEM Elefante Branco': 'CEB',
  'CEM Elefetante Branco': 'CEB',
  'CEM Paulo Freire': 'CPF',
  'CEM St Leste': 'CSL',
  'CEM St Oeste': 'CSO'
};

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

function parseCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value).trim().replace(/\s/g, '');
  const candidates = [
    normalized,
    normalized.replace(',', ''),
    normalized.replace(',', '.'),
    normalized.replace(/\.(?=.*\.)/g, '').replace(',', '.')
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function normalizeStatus(status) {
  const valor = String(status || '').trim();
  return valor || 'Não Iniciado';
}

function getRawValue(item, keys, fallback = '') {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      return item[key];
    }
  }
  return fallback;
}

function extrairFontes(html) {
  const texto = String(html || '');
  const fontes = [];
  const vistos = new Set();
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  let match;

  while ((match = regex.exec(texto)) !== null) {
    const url = match[1].trim();
    const titulo = match[2].replace(/<[^>]+>/g, '').trim() || url;
    if (!vistos.has(url)) {
      vistos.add(url);
      fontes.push({ titulo, url });
    }
  }

  return fontes;
}

function criarSiglaMapa(nome, nomeCurto) {
  if (SIGLAS_ESCOLAS[nome]) return SIGLAS_ESCOLAS[nome];

  const curto = String(nomeCurto || '').trim();
  if (curto && curto.length <= 5 && !['CEM', 'CED'].includes(curto.toUpperCase())) {
    return curto.toUpperCase();
  }

  return String(nome || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(parte => parte[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();
}

function formatarDados(rawData) {
  return rawData.map(item => ({
    escola_id: Number(getRawValue(item, ['escola_id', 'EscolaID', '_escola_id'], 0)),
    escola_nome: getRawValue(item, ['escola_nome', 'EscolaNome']),
    escola_nome_curto: getRawValue(item, ['escola_nome_curto', 'EscolaNomeCurto']),
    latitude: parseCoordinate(getRawValue(item, ['latitude', 'Latitude'], null)),
    longitude: parseCoordinate(getRawValue(item, ['longitude', 'Longitude'], null)),
    programa_id: getRawValue(item, ['programa_id', 'ProgramaID', '_programa_id']),
    programa_nome: getRawValue(item, ['programa_nome', 'ProgramaNome']),
    programa_descricao: getRawValue(item, ['programa_descricao', 'Descricao']),
    status: normalizeStatus(getRawValue(item, ['status', 'Status'], 'Não Iniciado')),
    fontes: extrairFontes(getRawValue(item, ['programa_descricao', 'Descricao']))
  }));
}

async function buscarDadosCompletos() {
  if (dadosCache.data && Date.now() - dadosCache.ts < CACHE_TTL_MS) {
    return dadosCache.data;
  }

  const response = await fetch(ZERO_SHEETS_URL);

  if (!response.ok) {
    throw new Error(`ZeroSheets HTTP ${response.status}`);
  }

  const rawData = await response.json();

  if (!Array.isArray(rawData)) {
    throw new Error('Formato inesperado da ZeroSheets');
  }

  const dadosFormatados = formatarDados(rawData);
  dadosCache = { ts: Date.now(), data: dadosFormatados };
  return dadosFormatados;
}

function agregarEscolasParaMapa(dados) {
  const escolas = new Map();

  dados.forEach(item => {
    if (!item.escola_id || !item.escola_nome) return;

    if (!escolas.has(item.escola_id)) {
      escolas.set(item.escola_id, {
        id: item.escola_id,
        nome: item.escola_nome,
        nome_curto: item.escola_nome_curto || item.escola_nome,
        sigla_mapa: criarSiglaMapa(item.escola_nome, item.escola_nome_curto),
        latitude: item.latitude,
        longitude: item.longitude,
        origem_coordenada: item.latitude !== null && item.longitude !== null ? 'API externa' : 'Fallback local',
        total_programas: 0,
        ativos: 0,
        suspensos: 0,
        nao_iniciados: 0,
        programas: [],
        fontes: [],
        fonte_dados: ZERO_SHEETS_URL
      });
    }

    const escola = escolas.get(item.escola_id);
    if (escola.latitude === null && item.latitude !== null) {
      escola.latitude = item.latitude;
      escola.origem_coordenada = 'API externa';
    }
    if (escola.longitude === null && item.longitude !== null) {
      escola.longitude = item.longitude;
      escola.origem_coordenada = 'API externa';
    }

    escola.total_programas += 1;
    if (item.status === 'Ativo') escola.ativos += 1;
    else if (item.status === 'Suspenso') escola.suspensos += 1;
    else escola.nao_iniciados += 1;

    escola.programas.push({
      id: item.programa_id,
      nome: item.programa_nome,
      status: item.status
    });

    item.fontes.forEach(fonte => {
      if (!escola.fontes.some(existing => existing.url === fonte.url)) {
        escola.fontes.push(fonte);
      }
    });
  });

  return Array.from(escolas.values())
    .map(escola => {
      if (!Number.isFinite(escola.latitude) || !Number.isFinite(escola.longitude)) {
        const fallback = COORDENADAS_FALLBACK[escola.nome];
        if (fallback) {
          escola.latitude = fallback[0];
          escola.longitude = fallback[1];
          escola.origem_coordenada = 'Fallback local';
        }
      }
      return escola;
    })
    .filter(escola => Number.isFinite(escola.latitude) && Number.isFinite(escola.longitude))
    .map(escola => ({
      ...escola,
      status_geral: escola.suspensos > 0
        ? 'Atenção'
        : escola.ativos > 0
          ? 'Em execução'
          : 'Não iniciado',
      fontes: escola.fontes.slice(0, 6)
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

app.get('/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.get('/api/dados-completos', async (req, res) => {
  try {
    res.json(await buscarDadosCompletos());
  } catch (err) {
    console.error('Erro ao buscar dados:', err);
    res.status(502).json({ error: 'Falha ao buscar dados externos.' });
  }
});

app.get('/api/escolas-mapa', async (req, res) => {
  try {
    const dados = await buscarDadosCompletos();
    const escolas = agregarEscolasParaMapa(dados);

    res.json({
      atualizado_em: new Date(dadosCache.ts).toISOString(),
      origem: ZERO_SHEETS_URL,
      escolas,
      resumo: {
        total_escolas: escolas.length,
        total_programas: dados.length,
        ativos: dados.filter(item => item.status === 'Ativo').length,
        suspensos: dados.filter(item => item.status === 'Suspenso').length,
        nao_iniciados: dados.filter(item => item.status !== 'Ativo' && item.status !== 'Suspenso').length
      }
    });
  } catch (err) {
    console.error('Erro ao buscar dados do mapa:', err);
    res.status(502).json({ error: 'Falha ao preparar dados do mapa.' });
  }
});

app.get('/api/programas', async (req, res) => {
  try {
    const dados = await buscarDadosCompletos();
    const programasUnicos = [];
    const seen = new Set();

    dados.forEach(item => {
      const programaNome = item.programa_nome || '';
      if (programaNome && programaNome.trim() !== '' && !seen.has(programaNome)) {
        seen.add(programaNome);
        programasUnicos.push({
          id: item.programa_id,
          nome: programaNome,
          descricao: item.programa_descricao || '',
          fontes: item.fontes || []
        });
      }
    });

    res.json(programasUnicos);
  } catch (err) {
    console.error('Erro ao buscar programas:', err);
    res.status(502).json({ error: 'Falha ao buscar programas externos.' });
  }
});

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
