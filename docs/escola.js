const escolasMenu = [
  ['cruzeiro1.html', 'CEMI Cruzeiro'],
  ['asanorte.html', 'CEM Asa Norte'],
  ['elefantebranco.html', 'CEM Elefante Branco'],
  ['freire.html', 'CEM Paulo Freire'],
  ['leste.html', 'CEM St Leste'],
  ['oeste.html', 'CEM St Oeste']
];

const statusClass = {
  'Ativo': 'status-ativo',
  'Suspenso': 'status-suspenso',
  'Não Iniciado': 'status-nao-iniciado',
  'Nao Iniciado': 'status-nao-iniciado'
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function normalizarStatus(status) {
  return status || 'Não Iniciado';
}

function statusTone(status) {
  return statusClass[normalizarStatus(status)] || 'status-default';
}

function montarMenuEscolas() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  const menu = document.getElementById('schools-dropdown');
  if (!menu) return;

  menu.innerHTML = escolasMenu.map(([href, label]) => (
    `<a class="school-link ${href === current ? 'active' : ''}" href="${href}">${label}</a>`
  )).join('');
}

function montarLogosInstitucionais() {
  const headerRow = document.querySelector('.glass-nav .shell');
  const brand = headerRow?.querySelector('a[href="index.html"]');
  if (!headerRow || !brand || headerRow.querySelector('.institutional-logos')) return;

  const logos = document.createElement('div');
  logos.className = 'institutional-logos';
  logos.setAttribute('aria-label', 'Logos institucionais');
  logos.innerHTML = `
    <img src="img/1200px-Instituto_Federal_de_Brasília_-_Marca_Vertical_2015.svg.png" alt="Instituto Federal de Brasília">
    <img src="img/banner.jpg" alt="PIBIC">
  `;
  brand.insertAdjacentElement('afterend', logos);
}

function fontesUnicas(programas) {
  const fontes = [];
  const vistos = new Set();

  programas.forEach(programa => {
    (programa.fontes || []).forEach(fonte => {
      if (!vistos.has(fonte.url)) {
        vistos.add(fonte.url);
        fontes.push(fonte);
      }
    });
  });

  return fontes;
}

function contarPorStatus(programas) {
  return programas.reduce((acc, programa) => {
    const status = normalizarStatus(programa.status);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

function renderMetric(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderProgramas(programas) {
  const container = document.getElementById('programs-list');

  if (!programas.length) {
    container.innerHTML = '<div class="panel p-6 text-slate-500">Nenhum programa encontrado para esta escola.</div>';
    return;
  }

  container.innerHTML = programas.map(programa => {
    const status = normalizarStatus(programa.status);
    const fontes = (programa.fontes || []).slice(0, 4).map(fonte =>
      `<a class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-[#0f5e9c] hover:bg-blue-50" href="${escapeHtml(fonte.url)}" target="_blank" rel="noopener">${escapeHtml(fonte.titulo)}</a>`
    ).join('');

    return `
      <article class="program-card overflow-hidden">
        <button class="accordion-header w-full p-5 text-left" aria-expanded="false">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase text-slate-500">${escapeHtml(programa.programa_id || 'Programa')}</p>
              <h3 class="mt-1 text-xl font-black text-slate-950">${escapeHtml(programa.programa_nome || 'Programa sem nome')}</h3>
            </div>
            <span class="status-pill ${statusTone(status)}">${escapeHtml(status)}</span>
          </div>
        </button>
        <div class="accordion-content">
          <div class="program-body border-t border-slate-200 p-5">
            ${programa.programa_descricao || '<p>Descrição não disponível.</p>'}
            ${fontes ? `<div class="mt-5 flex flex-wrap gap-2">${fontes}</div>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('.accordion-header').forEach(button => {
    button.addEventListener('click', () => {
      const content = button.nextElementSibling;
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      content.style.maxHeight = expanded ? null : `${content.scrollHeight}px`;
    });
  });
}

function renderFontes(programas) {
  const container = document.getElementById('sources-list');
  const fontes = fontesUnicas(programas).slice(0, 6);

  if (!fontes.length) {
    container.innerHTML = '<p class="text-sm text-slate-500">Nenhuma fonte vinculada aos programas desta escola.</p>';
    return;
  }

  container.innerHTML = fontes.map(fonte => `
    <a class="source-card block p-4 hover:border-[#0f5e9c]" href="${escapeHtml(fonte.url)}" target="_blank" rel="noopener">
      <span class="block text-sm font-black text-[#0f5e9c]">${escapeHtml(fonte.titulo)}</span>
      <span class="mt-1 block truncate text-xs text-slate-500">${escapeHtml(fonte.url)}</span>
    </a>
  `).join('');
}

function renderResumo(escola, programas) {
  const status = contarPorStatus(programas);
  const ativos = status.Ativo || 0;
  const suspensos = status.Suspenso || 0;
  const naoIniciados = status['Não Iniciado'] || status['Nao Iniciado'] || 0;
  const total = programas.length || 1;

  document.getElementById('school-name').textContent = document.body.dataset.schoolTitle || escola?.nome || 'Escola';
  document.getElementById('school-subtitle').textContent = `${programas.length} programas monitorados nesta unidade`;
  document.getElementById('school-badge').textContent = escola?.status_geral || (suspensos ? 'Atenção' : ativos ? 'Em execução' : 'Não iniciado');

  renderMetric('metric-total', programas.length);
  renderMetric('metric-active', ativos);
  renderMetric('metric-suspended', suspensos);
  renderMetric('metric-idle', naoIniciados);

  document.getElementById('progress-active').style.width = `${(ativos / total) * 100}%`;
  document.getElementById('progress-suspended').style.width = `${(suspensos / total) * 100}%`;
  document.getElementById('progress-idle').style.width = `${(naoIniciados / total) * 100}%`;
  document.getElementById('summary-copy').textContent = `${ativos} ativo(s), ${suspensos} suspenso(s) e ${naoIniciados} não iniciado(s).`;
}

async function carregarPaginaEscola() {
  montarMenuEscolas();
  montarLogosInstitucionais();

  const idEscola = Number(document.body.dataset.schoolId);
  const hero = document.getElementById('school-hero');
  hero.style.backgroundImage = `url('${document.body.dataset.schoolImage}')`;

  try {
    const [dadosResponse, mapaResponse] = await Promise.all([
      fetch('/api/dados-completos'),
      fetch('/api/escolas-mapa')
    ]);

    if (!dadosResponse.ok || !mapaResponse.ok) throw new Error('Falha ao carregar API');

    const dados = await dadosResponse.json();
    const mapa = await mapaResponse.json();
    const programas = dados.filter(item => Number(item.escola_id) === idEscola);
    const escola = (mapa.escolas || []).find(item => Number(item.id) === idEscola);

    renderResumo(escola, programas);
    renderProgramas(programas);
    renderFontes(programas);
    document.getElementById('updated-at').textContent = `Dados atualizados em ${new Date(mapa.atualizado_em).toLocaleString('pt-BR')}`;
  } catch (error) {
    document.getElementById('programs-list').innerHTML = '<div class="panel p-6 text-red-700">Não foi possível carregar os dados externos desta escola.</div>';
    document.getElementById('sources-list').innerHTML = '<p class="text-sm text-red-700">Fontes indisponíveis no momento.</p>';
  }
}

document.addEventListener('DOMContentLoaded', carregarPaginaEscola);
