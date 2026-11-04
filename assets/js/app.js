/* ==========================================================================
   La Ursinhas — lógica da página
   Sem dependências. Tudo degrada com elegância: quando a API falha, a página
   mostra o último dado salvo em cache ou uma mensagem com botão de tentar
   de novo (nunca fica presa em "Carregando...").
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  // Codifica HTML de verdade. A versão anterior devolvia os caracteres
  // intactos, o que deixava qualquer dado vindo da API sem escapar.
  const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ENTIDADES[c]);

  const norm = (s) => String(s === null || s === undefined ? '' : s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  const DIA = 864e5;
  const FUSO = 'America/Recife';

  /* ------------------------------------------------------------------
     Cache local (funciona mesmo em navegação privada onde lança)
     ------------------------------------------------------------------ */
  const CACHE = {
    ler(chave) {
      try {
        const bruto = localStorage.getItem(chave);
        return bruto ? JSON.parse(bruto) : null;
      } catch (e) { return null; }
    },
    gravar(chave, valor) {
      try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* ignora */ }
    }
  };

  /* ------------------------------------------------------------------
     fetch com timeout e repetição
     ------------------------------------------------------------------ */
  async function fetchJson(url, opcoes) {
    const cfg = opcoes || {};
    const timeout = cfg.timeout || 12000;
    const tentativas = cfg.tentativas || 3;
    let ultimoErro = null;

    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      if (cfg.sinal && cfg.sinal.aborted) throw new Error('cancelado');
      const ctrl = new AbortController();
      const relogio = setTimeout(function () { ctrl.abort(); }, timeout);
      const aoCancelar = function () { ctrl.abort(); };
      if (cfg.sinal) cfg.sinal.addEventListener('abort', aoCancelar, { once: true });

      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
          credentials: 'omit'
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (json && json.error) {
          throw new Error((json.error.info || json.error.code) || 'erro da API');
        }
        return json;
      } catch (erro) {
        ultimoErro = erro;
        if (cfg.sinal && cfg.sinal.aborted) throw erro;
        if (tentativa < tentativas) await espera(500 * tentativa);
      } finally {
        clearTimeout(relogio);
        if (cfg.sinal) cfg.sinal.removeEventListener('abort', aoCancelar);
      }
    }
    throw ultimoErro || new Error('falha de rede');
  }

  /* ------------------------------------------------------------------
     Dados
     ------------------------------------------------------------------ */
  const ALAS = [
    { nome: 'Bezerros', lat: -8.23, lon: -35.80, ala: 'Ala dos Papangus', aniv: [5, 18, null] },
    { nome: 'Recife',   lat: -8.05, lon: -34.88, ala: 'Ala do Frevo',     aniv: [3, 12, 1537] },
    { nome: 'Olinda',   lat: -8.01, lon: -34.86, ala: 'Ala dos Bonecos',  aniv: [3, 12, 1535] }
  ];

  const GIRIAS = [
    ['Arretado', 'muito bom, incrível', 'Esse frevo tá arretado!'],
    ['Avexado', 'apressado, aflito, sem paciência', 'Calma, não precisa ficar avexado.'],
    ['Oxente', 'expressão de surpresa ou espanto', 'Oxente, já é Carnaval?'],
    ['Visse', '“viu?”, usado pra confirmar o que foi dito', 'Chega cedo, visse?'],
    ['Aperreio', 'aflição, confusão, problema', 'Que aperreio esse trânsito!'],
    ['Fuleiro', 'de má qualidade, mixuruca', 'Essa fantasia ficou fuleira.'],
    ['Mangar', 'zombar, tirar sarro', 'Para de mangar de mim!'],
    ['Pelejar', 'esforçar-se, lutar pra conseguir algo', 'Pelejei o dia todo pra achar ingresso.'],
    ['Lascado', 'em apuros, numa situação difícil', 'Se chover agora, tamo lascado.'],
    ['Vixe', 'expressão de surpresa, espanto ou lamento', 'Vixe, esqueci a sombrinha!'],
    ['Cabra', 'homem, sujeito', 'Aquele cabra é gente boa.'],
    ['Mainha', 'mãe, forma carinhosa', 'Mainha fez bolo de rolo.'],
    ['Painho', 'pai, forma carinhosa', 'Painho vem buscar a gente.'],
    ['Matuto', 'pessoa do interior, do campo', 'O matuto sabe de tudo.'],
    ['Presepada', 'confusão, façanha desastrada', 'Que presepada foi aquela?'],
    ['Frevar', 'dançar frevo', 'Bora frevar até o sol nascer!'],
    ['Papangu', 'folião mascarado do Carnaval de Bezerros', 'O papangu saiu na rua com a máscara nova.']
  ];

  const FATOS = [
    ['O Centro Histórico de Olinda é Patrimônio Mundial da UNESCO desde 1982.', 'UNESCO · Centro Histórico de Olinda', 'https://whc.unesco.org/en/list/189'],
    ['O frevo, arte do Carnaval do Recife, foi inscrito pela UNESCO como Patrimônio Cultural Imaterial da Humanidade em 2012.', 'UNESCO · Frevo', 'https://ich.unesco.org/en/RL/00603'],
    ['Fernando de Noronha, junto com o Atol das Rocas, é Patrimônio Mundial Natural da UNESCO desde 2001.', 'UNESCO · Ilhas Atlânticas Brasileiras', 'https://whc.unesco.org/en/list/1000']
  ];

  // Diretório La Ursa. x/y posicionam o marcador no mapa (percentual).
  const CIDADES_URSA = [
    {
      nome: 'Recife', icone: '🎪', x: 82.82, y: 42.74,
      grupo: 'La Ursa do Bonde', fundador: 'O Bonde (Cid Cavalcanti)', ano: 1991,
      variacao: 'Litoral tradicional',
      descricao: 'A agremiação fundadora da La Ursa no Recife, preservando a tradição do caçador, domador e do urso de papel-machê. Desfile oficial desde 1948.',
      contato: '@obonde no Instagram'
    },
    {
      nome: 'Olinda', icone: '🐘', x: 82.97, y: 41.24,
      grupo: 'La Ursa dos Bonecos', fundador: 'Coletivo Bonecos de Olinda', ano: 1978,
      variacao: 'Litoral clássico',
      descricao: 'Integrante do carnaval de Olinda, com máscaras de papel-machê artesanais e batucada no Centro Histórico.',
      contato: '@coletivobonecos'
    },
    {
      nome: 'Bezerros', icone: '🐼', x: 70.2, y: 48.1,
      grupo: 'La Ursa dos Papangus', fundador: 'Bloco dos Papangus', ano: 1965,
      variacao: 'Agreste',
      descricao: 'No Agreste de Pernambuco, as máscaras têm formatos estilizados e os desfiles ocorrem em ruas estreitas com instrumentos simples (latas, retalhos de madeira).',
      contato: '@blocodospapangus'
    },
    {
      nome: 'Caruaru', icone: '🏙️', x: 75.4, y: 52.1,
      grupo: 'La Ursa de Caruaru', fundador: 'Comunidade local', ano: 1952,
      variacao: 'Interior',
      descricao: 'Uma das cidades do interior com forte tradição da La Ursa, com concursos de fantasia e desfiles nas principais avenidas.',
      contato: 'Prefeitura de Caruaru'
    },
    {
      nome: 'Garanhuns', icone: '🎭', x: 61.94, y: 73.70,
      grupo: 'La Ursa de Garanhuns', fundador: 'Associação cultural', ano: 1988,
      variacao: 'Interior',
      descricao: 'Presente nos festejos de janeiro e no Carnaval, com participação de grupos escolares e comunitários.',
      contato: 'Associação cultural local'
    },
    {
      nome: 'Jaboatão', icone: '🌊', x: 81.10, y: 44.93,
      grupo: 'La Ursa de Jaboatão', fundador: 'Coletivo de artistas', ano: 1995,
      variacao: 'Litoral',
      descricao: 'Presente no Carnaval de Rua do Grande Recife, com batucadas e moreirinhas.',
      contato: 'Coletivo artístico'
    },
    {
      nome: 'Paulista', icone: '🏖️', x: 81.87, y: 45.00,
      grupo: 'La Ursa de Paulista', fundador: 'Moradores locais', ano: 2005,
      variacao: 'Litoral',
      descricao: 'Grupo emergente que resgata a tradição nas praias do litoral sul de PE.',
      contato: 'Grupo comunitário'
    },
    {
      nome: 'São Caetano', icone: '🐻', x: 79.20, y: 41.59,
      grupo: 'La Ursa de São Caetano', fundador: 'Coletivo local', ano: null,
      variacao: 'Agreste',
      descricao: 'No Agreste, as máscaras têm formatos distintos, às vezes lembrando um panda, e os desfiles adotam o formato de escolas de samba.',
      contato: 'Coletivo local'
    },
    {
      nome: 'São Lourenço da Mata', icone: '👑', x: 79.74, y: 41.96,
      grupo: 'Urso Branco de Cangaçá', fundador: 'Comunidade local', ano: null,
      variacao: 'Litoral / Agreste',
      descricao: 'Cidade com concurso anual para eleger a La Ursa mais bonita — o Urso Branco de Cangaçá completa 47 anos de história.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Arcoverde', icone: '🐺', x: 54.71, y: 56.30,
      grupo: 'La Ursa de Arcoverde', fundador: 'Comunidade local', ano: null,
      variacao: 'Sertão',
      descricao: 'Grupo do Sertão, com desfiles que misturam a tradição da ursa ao frevo de rua.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Salgueiro', icone: '🌵', x: 27.2, y: 41.7,
      grupo: 'La Ursa de Salgueiro', fundador: 'Comunidade local', ano: null,
      variacao: 'Sertão',
      descricao: 'Tradição sertaneja mantida com reisados e desfiles de rua no centro da cidade.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Petrolina', icone: '🌴', x: 10.32, y: 91.85,
      grupo: 'La Ursa de Petrolina', fundador: 'Comunidade local', ano: null,
      variacao: 'Sertão / Triângulo',
      descricao: 'No extremo oeste do estado, a tradição atravessa o São Francisco e ganha características próprias do Triângulo.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Araripina', icone: '🎪', x: 10.32, y: 25.19,
      grupo: 'La Ursa de Araripina', fundador: 'Comunidade local', ano: null,
      variacao: 'Sertão / Araripe',
      descricao: 'Tradição do Araripe, no extremo oeste, com desfiles que misturam a ursa e as fantasias gigantescas.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Afogados da Ingazeira', icone: '💧', x: 38.6, y: 36.7,
      grupo: 'La Ursa de Afogados', fundador: 'Comunidade local', ano: null,
      variacao: 'Sertão',
      descricao: 'Grupo sertanejo com desfiles no centro da cidade e participação da circuitada do Ano Novo.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Palmares', icone: '🌿', x: 32.90, y: 45.56,
      grupo: 'La Ursa de Palmares', fundador: 'Comunidade local', ano: null,
      variacao: 'Sertão / Zona da Mata',
      descricao: 'Tradição da Zona da Mata, entre o Agreste e o Sertão, com desfiles durante as festas juninas.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Goiana', icone: '🍊', x: 68.39, y: 40.74,
      grupo: 'La Ursa de Goiana', fundador: 'Comunidade local', ano: null,
      variacao: 'Agreste',
      descricao: 'Cidade do Agreste com forte presença da brincadeira durante o Carnaval.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Surubim', icone: '🐓', x: 57.16, y: 34.44,
      grupo: 'La Ursa de Surubim', fundador: 'Comunidade local', ano: null,
      variacao: 'Agreste',
      descricao: 'Praticantes da ursa organizam desfiles e reisados no Agreste pernambucano.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Ouricuri', icone: '🎺', x: 43.7, y: 40.7,
      grupo: 'La Ursa de Ouricuri', fundador: 'Comunidade local', ano: null,
      variacao: 'Sertão / Agreste',
      descricao: 'Grupo do Agreste/Sertão com desfiles levados a cabo pelas escolas de samba da cidade.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Bodocó', icone: '🪨', x: 26.71, y: 32.59,
      grupo: 'La Ursa de Bodocó', fundador: 'Comunidade local', ano: null,
      variacao: 'Sertão / Araripe',
      descricao: 'Tradição da região do Araripe com participação ativa nos macrocircuitos e festivais locais.',
      contato: 'Comunidade local'
    },
    {
      nome: 'Timbaúba', icone: '🌽', x: 49.29, y: 26.30,
      grupo: 'La Ursa de Timbaúba', fundador: 'Comunidade local', ano: null,
      variacao: 'Agreste',
      descricao: 'Praticantes da ursa mantêm a tradição no Agreste, entre o Recife e o Araripe.',
      contato: 'Comunidade local'
    }
  ];

  // Cidades que ficam geograficamente coladas: viram um único marcador no
  // mapa (o Grande Recife) e aparecem separadas na lista.
  const GRUPOS_MAPA = [
    ['Recife', 'Olinda', 'Jaboatão', 'Paulista', 'São Caetano', 'São Lourenço da Mata']
  ];

  /* ------------------------------------------------------------------
     Datas: Carnaval e aniversários
     ------------------------------------------------------------------ */
  function hojeRecife() {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date()).split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }

  function fmt(ts, comAno) {
    const d = new Date(ts);
    const s = String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0');
    return comAno ? s + '/' + d.getUTCFullYear() : s;
  }

  function pascoa(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const x = h + l - 7 * m + 114;
    return Date.UTC(ano, Math.floor(x / 31) - 1, (x % 31) + 1);
  }

  const sabadoCarnaval = (ano) => pascoa(ano) - 50 * DIA;

  function atualizarContagem() {
    const hoje = hojeRecife();
    const ano = new Date(hoje).getUTCFullYear();
    let c = sabadoCarnaval(ano);
    if (hoje > c + 3 * DIA) c = sabadoCarnaval(ano + 1);
    const dias = Math.round((c - hoje) / DIA);

    let grande, linha;
    if (dias > 1) { grande = String(dias); linha = 'dias pro bloco sair'; }
    else if (dias === 1) { grande = '1'; linha = 'dia: é amanhã!'; }
    else if (dias === 0) { grande = 'HOJE'; linha = 'o bloco está na rua!'; }
    else { grande = '🥁'; linha = 'o Carnaval não para!'; }

    const elNum = $('contagem-numero');
    const elLinha = $('contagem-linha');
    const elPeriodo = $('contagem-periodo');
    if (elNum && elNum.textContent !== grande) elNum.textContent = grande;
    if (elLinha && elLinha.textContent !== linha) elLinha.textContent = linha;
    if (elPeriodo) {
      const texto = fmt(c) + ' a ' + fmt(c + 3 * DIA, true);
      if (elPeriodo.textContent !== texto) elPeriodo.textContent = texto;
    }
  }

  function aniversario(mes, dia, ano) {
    const hoje = hojeRecife();
    const y = new Date(hoje).getUTCFullYear();
    let p = Date.UTC(y, mes - 1, dia);
    if (p < hoje) p = Date.UTC(y + 1, mes - 1, dia);
    const faltam = Math.round((p - hoje) / DIA);
    const idade = ano ? ' (' + (new Date(p).getUTCFullYear() - ano) + ' anos)' : '';
    return { faltam: faltam, data: fmt(p), idade: idade };
  }

  /* ------------------------------------------------------------------
     Tema claro/escuro
     ------------------------------------------------------------------ */
  function iniciarTema() {
    const raiz = document.documentElement;
    const botao = $('tema-botao');
    if (!botao) return;
    const icone = botao.querySelector('[data-tema-icone]');
    const consulta = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    const salvo = (function () { try { return localStorage.getItem('laursinhas:tema'); } catch (e) { return null; } })();

    function escuroDoSistema() { return !!(consulta && consulta.matches); }

    function temaEfetivo() {
      const attr = raiz.getAttribute('data-theme');
      if (attr === 'dark') return 'escuro';
      if (attr === 'light') return 'claro';
      return escuroDoSistema() ? 'escuro' : 'claro';
    }

    function aplicar(t) {
      if (t === 'escuro') raiz.setAttribute('data-theme', 'dark');
      else if (t === 'claro') raiz.setAttribute('data-theme', 'light');
      else raiz.removeAttribute('data-theme');

      const efetivo = temaEfetivo();
      if (icone) icone.textContent = efetivo === 'escuro' ? '☀️' : '🌙';
      botao.setAttribute('aria-pressed', efetivo === 'escuro' ? 'true' : 'false');
      botao.setAttribute('title', efetivo === 'escuro'
        ? 'Mudar para tema claro'
        : 'Mudar para tema escuro');
    }

    aplicar(salvo || 'auto');

    botao.addEventListener('click', function () {
      const novo = temaEfetivo() === 'escuro' ? 'claro' : 'escuro';
      try { localStorage.setItem('laursinhas:tema', novo); } catch (e) { /* ignora */ }
      aplicar(novo);
    });

    if (consulta && typeof consulta.addEventListener === 'function') {
      consulta.addEventListener('change', function () {
        let atual = null;
        try { atual = localStorage.getItem('laursinhas:tema'); } catch (e) { atual = null; }
        if (!atual) aplicar('auto');
      });
    }
  }

  /* ------------------------------------------------------------------
     Diretório La Ursa: mapa, lista e detalhe
     ------------------------------------------------------------------ */
  let cidadeSelecionada = null;

  // Constrói os marcadores do mapa: cidades soltas viram um ponto cada;
  // grupos de cidades coladas viram um único marcador com a contagem.
  function construirMarcadores() {
    const caixas = [];
    const agrupadas = {};

    GRUPOS_MAPA.forEach(function (grupo) {
      const membros = grupo
        .map(function (nome) {
          return CIDADES_URSA.filter(function (c) { return c.nome === nome; })[0];
        })
        .filter(Boolean);
      if (!membros.length) return;
      agrupadas[grupo[0]] = membros;
      caixas.push({
        tipo: 'grupo',
        membros: membros,
        titulo: membros.length + ' cidades',
        rotulo: membros.map(function (m) { return m.nome; }).join(', '),
        x: membros.reduce(function (s, m) { return s + m.x; }, 0) / membros.length,
        y: membros.reduce(function (s, m) { return s + m.y; }, 0) / membros.length
      });
    });

    CIDADES_URSA.forEach(function (c) {
      const dentroDeGrupo = GRUPOS_MAPA.some(function (grupo) {
        return grupo.indexOf(c.nome) !== -1;
      });
      if (dentroDeGrupo) return;
      caixas.push({
        tipo: 'cidade',
        membros: [c],
        titulo: c.nome,
        rotulo: c.nome,
        x: c.x,
        y: c.y
      });
    });

    return caixas;
  }

  function montarMapa() {
    const caixa = $('mapa-marcadores');
    if (caixa) {
      caixa.textContent = '';
      construirMarcadores().forEach(function (item) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'mapa__marcador' + (item.tipo === 'grupo' ? ' mapa__marcador--grupo' : '');
        botao.style.left = item.x + '%';
        botao.style.top = item.y + '%';
        botao.title = item.tipo === 'grupo' ? item.rotulo : item.titulo;
        botao.setAttribute('aria-pressed', 'false');
        botao.setAttribute('aria-label', item.tipo === 'grupo'
          ? item.rotulo + ': ver as ' + item.membros.length + ' cidades'
          : item.titulo + ': ver a agremiação');
        if (item.tipo === 'grupo') botao.textContent = String(item.membros.length);
        botao.dataset.cidade = item.tipo === 'cidade' ? item.titulo : '';
        botao.addEventListener('click', function () {
          if (item.tipo === 'grupo') {
            mostrarLista(item.membros.map(function (m) { return m.nome; }), item.rotulo);
          } else {
            selecionarCidade(item.titulo, 'mapa');
          }
        });
        caixa.appendChild(botao);
      });
    }

    const sel = $('cidade-ursa');
    if (sel) {
      CIDADES_URSA.forEach(function (c) {
        const opt = document.createElement('option');
        opt.value = c.nome;
        opt.textContent = c.nome;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () {
        if (sel.value) selecionarCidade(sel.value, 'seletor');
      });
    }

    const alternar = $('btn-mapa-lista');
    const painel = $('painel-lista-ursa');
    if (alternar && painel) {
      alternar.addEventListener('click', function () {
        const aberto = painel.hasAttribute('hidden');
        if (aberto) {
          mostrarLista(null, null);
          painel.removeAttribute('hidden');
        } else {
          painel.setAttribute('hidden', '');
        }
        alternar.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        alternar.textContent = aberto ? 'Ver mapa' : 'Ver lista';
      });
    }

    const todas = $('lista-ursa-todas');
    if (todas) {
      todas.addEventListener('click', function () {
        mostrarLista(null, null);
      });
    }

    // Deixa a lista pronta antes de o usuário pedir para vê-la.
    preencherLista(null, null);
  }

  // Filtra (ou não) a lista de cidades do painel lateral.
  function preencherLista(cidades, titulo) {
    const lista = $('lista-ursa');
    const cabecalho = $('lista-ursa-titulo');
    const botaoTodas = $('lista-ursa-todas');
    if (!lista) return;

    const filtrada = cidades && cidades.length ? cidades : null;
    const nomes = filtrada
      ? filtrada
      : CIDADES_URSA.map(function (c) { return c.nome; });

    if (cabecalho) {
      cabecalho.textContent = titulo || ('Todas as cidades (' + nomes.length + ')');
    }
    if (botaoTodas) {
      if (filtrada) botaoTodas.removeAttribute('hidden');
      else botaoTodas.setAttribute('hidden', '');
    }

    lista.textContent = '';
    nomes.forEach(function (nome) {
      const li = document.createElement('li');
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.textContent = nome;
      botao.setAttribute('aria-pressed', 'false');
      botao.addEventListener('click', function () {
        selecionarCidade(nome, 'lista');
      });
      li.appendChild(botao);
      lista.appendChild(li);
    });
  }

  function mostrarLista(cidades, titulo) {
    const painel = $('painel-lista-ursa');
    if (!painel) return;
    preencherLista(cidades, titulo);
    painel.removeAttribute('hidden');
    const alternar = $('btn-mapa-lista');
    if (alternar) {
      alternar.setAttribute('aria-expanded', 'true');
      alternar.textContent = 'Ver mapa';
    }
  }

  function selecionarCidade(nome, origem) {
    const item = CIDADES_URSA.filter(function (c) { return c.nome === nome; })[0];
    if (!item) return;
    cidadeSelecionada = nome;

    const sel = $('cidade-ursa');
    if (sel && sel.value !== nome) sel.value = nome;

    $$('.mapa__marcador').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.cidade === nome ? 'true' : 'false');
    });
    $$('#lista-ursa button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.textContent === nome ? 'true' : 'false');
    });

    renderDetalheUrsa(item);

    if (origem === 'mapa' || origem === 'lista') {
      const detalhe = $('detalhe-ursa');
      if (detalhe && detalhe.scrollIntoView) {
        detalhe.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  function renderDetalheUrsa(c) {
    const alvo = $('detalhe-ursa');
    if (!alvo) return;

    const campos = [
      ['Fundador', c.fundador || '—'],
      ['Ano', c.ano ? String(c.ano) : '—'],
      ['Variação regional', c.variacao || '—'],
      ['Contato', c.contato || '—']
    ];

    const linksContato = /^https?:\/\//i.test(c.contato || '')
      ? '<a href="' + esc(c.contato) + '" target="_blank" rel="noopener">' + esc(c.contato) + '</a>'
      : esc(c.contato || '—');

    const urlIssue = 'https://github.com/laursinhas/laursinhas/issues/new?title=' +
      encodeURIComponent('La Ursa em ' + c.nome);

    alvo.innerHTML =
      '<div class="detalhe__cartao">' +
        '<h3>' + esc(c.icone || '🐻') + ' ' + esc(c.grupo) + '</h3>' +
        '<div class="detalhe__grade">' +
          campos.map(function (par) {
            return '<div class="detalhe__campo">' +
              '<span class="detalhe__rotulo">' + esc(par[0]) + '</span>' +
              '<span class="detalhe__valor">' + esc(par[1]) + '</span>' +
              '</div>';
          }).join('') +
        '</div>' +
        '<p>' + esc(c.descricao) + '</p>' +
        '<p class="detalhe__acao">Contato: ' + linksContato +
          ' · <a href="' + urlIssue + '" target="_blank" rel="noopener">corrigir ou completar</a></p>' +
      '</div>';
  }

  /* ------------------------------------------------------------------
     Termômetro das Alas
     ------------------------------------------------------------------ */
  function humor(t, chuva, code) {
    if (code >= 95) return ['⛈️', 'Trovoada! Bloco recolhido, frevo só dentro de casa.'];
    if (chuva > 0 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      return ['🌧️', 'Choveu! Abre a sombrinha que o frevo não para.'];
    }
    if (t >= 32) return ['🥵', 'Quente demais! Bloco na sombra com água de coco.'];
    if (t <= 22) return ['🧣', 'Fresquinho! Papangu de casaco hoje.'];
    return ['😎', 'Tempo bom, bloco liberado pra sair.'];
  }

  function horaRecife() {
    try {
      return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date());
    } catch (e) {
      const d = new Date();
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
  }

  function marcarHora() {
    const el = $('hora');
    if (el) el.textContent = horaRecife();
  }

  function renderAlas(itens, opcoes) {
    const caixa = $('temperatura-alas');
    if (!caixa) return;
    const cfg = opcoes || {};

    const temperaturas = itens.map(function (i) { return i.temp; });
    const maior = Math.max.apply(null, temperaturas);
    const estado = $('estado-clima');

    caixa.setAttribute('aria-busy', 'false');
    caixa.innerHTML = itens.map(function (x, i) {
      const quente = x.temp === maior;
      return '<article class="cartao-clima' + (quente ? ' cartao-clima--quente' : '') + '">' +
        (quente ? '<div class="selo">🔥 Ala mais quente</div>' : '') +
        '<div class="cartao-clima__topo">' +
          '<span class="cartao-clima__emoji" aria-hidden="true">' + x.emoji + '</span>' +
          '<span class="cartao-clima__temp">' + Math.round(x.temp) + '°C</span>' +
        '</div>' +
        '<div class="cartao-clima__nome">' + esc(x.nome) + '</div>' +
        '<div class="cartao-clima__ala">' + esc(x.ala) + '</div>' +
        '<p class="cartao-clima__frase">' + esc(x.frase) + '</p>' +
        '<div class="cartao-clima__aniversario">🎂 ' +
          (x.aniv.faltam === 0
            ? 'parabéns, é hoje!'
            : esc(x.aniv.data) + ' · faltam ' + x.aniv.faltam + ' dias') +
        '</div>' +
      '</article>';
    }).join('');

    renderAniversarios(itens);

    if (estado) {
      if (cfg.aoVivo) {
        estado.textContent = 'Fonte: Open-Meteo · atualizado às ' + esc(horaRecife()) +
          ' · renova a cada 10 minutos.';
      } else {
        const quando = cfg.quando ? new Date(cfg.quando) : null;
        const rotulo = quando
          ? new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(quando)
          : 'um tempo atrás';
        const deOnde = cfg.estatico ? 'o snapshot do repositório' : 'o último dado salvo';
        estado.innerHTML = '⚠️ Sem conexão com a API: mostrando ' + deOnde + ' (' +
          esc(rotulo) + '). <span class="aviso-antigo">offline</span>';
      }
    }
  }

  function renderAniversarios(itens) {
    const lista = $('aniversarios');
    if (!lista) return;
    lista.innerHTML = itens.slice().sort(function (a, b) {
      return a.aniv.faltam - b.aniv.faltam;
    }).map(function (x) {
      const quando = x.aniv.faltam === 0
        ? 'parabéns, é hoje!'
        : 'faltam ' + x.aniv.faltam + ' dias, em ' + esc(x.aniv.data);
      return '<li>🎂 <strong>' + esc(x.nome) + '</strong>: ' + quando + esc(x.aniv.idade) + '</li>';
    }).join('');
  }

  function erroClima(mensagem) {
    const caixa = $('temperatura-alas');
    if (caixa) {
      caixa.setAttribute('aria-busy', 'false');
      caixa.innerHTML = '<p class="erro">' + esc(mensagem) +
        '<br><button type="button" class="botao" data-tentar="clima">Tentar de novo</button></p>';
      const botao = caixa.querySelector('[data-tentar="clima"]');
      if (botao) botao.addEventListener('click', function () { atualizarClima(true); });
    }
    const estado = $('estado-clima');
    if (estado) estado.textContent = '';
  }

  async function usarReservaEstatica() {
    // Snapshot versionado no repositório (assets/clima.json), atualizado pelo
    // GitHub Actions. Último recurso antes de mostrar a mensagem de erro.
    try {
      const dados = await fetchJson('assets/clima.json', { timeout: 6000, tentativas: 1 });
      const lista = (dados && dados.ala) || [];
      if (!lista.length) return false;

      const itens = lista.map(function (a) {
        const par = humor(a.temp || 0, a.chuva || 0, a.code || 0);
        const base = ALAS.filter(function (x) { return x.nome === a.nome; })[0];
        return {
          nome: a.nome,
          ala: a.ala || (base ? base.ala : ''),
          temp: a.temp || 0,
          emoji: a.emoji || par[0],
          frase: a.frase || par[1],
          aniv: base ? aniversario(base.aniv[0], base.aniv[1], base.aniv[2]) : { faltam: 0, data: '—', idade: '' }
        };
      });

      renderAlas(itens, { aoVivo: false, quando: Date.parse(dados.gerado_em) || null, estatico: true });
      return true;
    } catch (erro) {
      return false;
    }
  }

  async function atualizarClima(forcar) {
    const caixa = $('temperatura-alas');
    const cache = CACHE.ler('laursinhas:clima');

    if (caixa && forcar) {
      caixa.setAttribute('aria-busy', 'true');
      caixa.innerHTML = '<p class="carregando">Atualizando o clima…</p>';
    }

    const lat = ALAS.map(function (a) { return a.lat; }).join(',');
    const lon = ALAS.map(function (a) { return a.lon; }).join(',');
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,precipitation,weather_code' +
      '&daily=temperature_2m_max,precipitation_probability_max&forecast_days=1&timezone=' + FUSO;

    try {
      const bruto = await fetchJson(url, { timeout: 12000, tentativas: 2 });
      const lista = Array.isArray(bruto) ? bruto : [bruto];

      const itens = ALAS.map(function (c, i) {
        const atual = (lista[i] && lista[i].current) || {};
        const temp = typeof atual.temperature_2m === 'number' ? atual.temperature_2m : 0;
        const chuva = typeof atual.precipitation === 'number' ? atual.precipitation : 0;
        const code = typeof atual.weather_code === 'number' ? atual.weather_code : 0;
        const par = humor(temp, chuva, code);
        return {
          nome: c.nome, ala: c.ala, temp: temp,
          emoji: par[0], frase: par[1], aniv: aniversario(c.aniv[0], c.aniv[1], c.aniv[2])
        };
      });

      CACHE.gravar('laursinhas:clima', { quando: Date.now(), itens: itens });
      renderAlas(itens, { aoVivo: true });
      marcarHora();
    } catch (erro) {
      if (cache && cache.itens && cache.itens.length) {
        renderAlas(cache.itens, { aoVivo: false, quando: cache.quando });
      } else if (!(await usarReservaEstatica())) {
        erroClima('Não deu pra buscar o clima agora. Tenta de novo daqui a pouco!');
      }
      marcarHora();
    }
  }

  /* ------------------------------------------------------------------
     Gíria do dia
     ------------------------------------------------------------------ */
  function iniciarGirias() {
    const gp = $('gp');
    const gs = $('gs');
    const ge = $('ge');
    const g = GIRIAS[Math.floor(hojeRecife() / DIA) % GIRIAS.length];
    if (gp) gp.textContent = g[0];
    if (gs) gs.textContent = g[1];
    if (ge) ge.textContent = '“' + g[2] + '”';

    const busca = $('busca');
    const lista = $('lista-girias');
    const contagem = $('contagem-girias');
    if (!busca || !lista) return;

    function mostrar(texto) {
      const alvo = norm(texto);
      const achados = GIRIAS.filter(function (x) {
        return norm(x[0] + ' ' + x[1]).indexOf(alvo) !== -1;
      });

      if (contagem) {
        contagem.textContent = texto.trim()
          ? achados.length + (achados.length === 1 ? ' resultado' : ' resultados')
          : GIRIAS.length + ' gírias no dicionário';
      }

      if (!achados.length) {
        lista.innerHTML = '<li class="erro">Nenhuma gíria encontrada. Que tal sugerir essa?</li>';
        return;
      }

      lista.innerHTML = achados.map(function (x) {
        return '<li><b>' + esc(x[0]) + '</b>: ' + esc(x[1]) +
          '<br><span class="exemplo">Ex.: ' + esc(x[2]) + '</span></li>';
      }).join('');
    }

    busca.addEventListener('input', function (e) { mostrar(e.target.value); });
    mostrar('');
  }

  /* ------------------------------------------------------------------
     Fatos
     ------------------------------------------------------------------ */
  function renderFatos() {
    const alvo = $('lista-fatos');
    if (!alvo) return;
    alvo.innerHTML = FATOS.map(function (f) {
      return '<div class="fato"><p>' + esc(f[0]) + '</p>' +
        '<p class="fonte">Fonte: <a href="' + esc(f[2]) + '" target="_blank" rel="noopener">' + esc(f[1]) + '</a></p></div>';
    }).join('');
  }

  /* ------------------------------------------------------------------
     Explore Pernambuco
     ------------------------------------------------------------------ */
  const URL_IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/26/municipios?orderBy=nome';

  async function carregarMunicipios() {
    const sel = $('cidade-pe');
    if (!sel) return;

    const cache = CACHE.ler('laursinhas:municipios');
    if (cache && cache.lista && cache.lista.length) {
      preencherMunicipios(sel, cache.lista);
      return;
    }

    try {
      const dados = await fetchJson(URL_IBGE, { timeout: 15000, tentativas: 2 });
      const lista = (dados || []).map(function (m) { return m && m.nome; }).filter(Boolean);
      if (!lista.length) throw new Error('lista vazia');
      CACHE.gravar('laursinhas:municipios', { lista: lista });
      preencherMunicipios(sel, lista);
    } catch (erro) {
      sel.innerHTML = '<option value="">Não deu pra carregar a lista agora</option>';
      sel.disabled = true;
    }
  }

  function preencherMunicipios(sel, lista) {
    sel.textContent = '';
    const primeira = document.createElement('option');
    primeira.value = '';
    primeira.textContent = 'Escolha uma cidade…';
    sel.appendChild(primeira);
    lista.forEach(function (nome) {
      const opt = document.createElement('option');
      opt.value = nome;
      opt.textContent = nome;
      sel.appendChild(opt);
    });
    sel.disabled = false;
  }

  const PESO_FC = { ADM2: 0, ADM3: 1, PPLA: 2, PPLA2: 2, PPL: 3, PPLL: 4 };

  function escolherLocal(resultados, nome) {
    const alvo = norm(nome);
    const candidatos = (resultados || []).filter(function (r) {
      return norm(r.admin1) === 'pernambuco';
    });
    candidatos.sort(function (a, b) {
      const pa = PESO_FC[a.feature_code] === undefined ? 9 : PESO_FC[a.feature_code];
      const pb = PESO_FC[b.feature_code] === undefined ? 9 : PESO_FC[b.feature_code];
      if (pa !== pb) return pa - pb;
      const exato = (norm(a.name) === alvo) ? 0 : 1;
      const exatoB = (norm(b.name) === alvo) ? 0 : 1;
      if (exato !== exatoB) return exato - exatoB;
      return (b.population || 0) - (a.population || 0);
    });
    return candidatos[0] || null;
  }

  async function montarRoteiro(nome) {
    const alvo = $('roteiro');
    if (!alvo) return;

    if (!nome) {
      alvo.innerHTML = '';
      alvo.setAttribute('aria-busy', 'false');
      return;
    }

    alvo.setAttribute('aria-busy', 'true');
    alvo.innerHTML = '<p class="carregando">Montando o roteiro…</p>';

    try {
      const geo = await fetchJson(
        'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(nome) +
        '&count=20&language=pt&country_code=BR',
        { timeout: 12000, tentativas: 3 }
      );

      const loc = escolherLocal(geo.results, nome);
      if (!loc) throw new Error('sem-local');

      const coord = encodeURIComponent(loc.latitude + '|' + loc.longitude);
      const previsaoUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.latitude +
        '&longitude=' + loc.longitude +
        '&current=temperature_2m&daily=temperature_2m_max,precipitation_probability_max&forecast_days=3&timezone=auto';
      const wikiUrl = 'https://pt.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=' + coord +
        '&gsradius=10000&gslimit=15&format=json&origin=*';

      const respostas = await Promise.allSettled([
        fetchJson(previsaoUrl, { timeout: 12000, tentativas: 2 }),
        fetchJson(wikiUrl, { timeout: 12000, tentativas: 3 })
      ]);

      const previsao = respostas[0].status === 'fulfilled' ? respostas[0].value : null;
      const wiki = respostas[1].status === 'fulfilled' ? respostas[1].value : null;

      if (!previsao) throw new Error('sem-previsao');

      const lugares = (wiki && wiki.query && wiki.query.geosearch) || [];
      const diario = previsao.daily || {};
      const tempos = diario.time || [];
      const maximos = diario.temperature_2m_max || [];
      const chuvas = diario.precipitation_probability_max || [];
      const agora = previsao.current ? previsao.current.temperature_2m : null;

      let html = '';
      if (typeof agora === 'number') {
        html += '<p>Agora em <b>' + esc(nome) + '</b>: ' + Math.round(agora) + '°C</p>';
      }

      if (!lugares.length) {
        html += '<p class="nota">Não achei lugares citados na Wikipédia perto dessa cidade. ' +
          'Tente uma cidade maior ou confira o roteiro oficial da prefeitura.</p>';
      }

      const dias = Math.min(3, tempos.length);
      if (dias) {
        html += '<div class="grade-dias">';
        for (let d = 0; d < dias; d++) {
          const doDia = lugares.slice(d * 3, d * 3 + 3);
          if (!doDia.length && d > 0) continue;
          const partes = String(tempos[d]).split('-');
          const data = partes.length === 3 ? partes[2] + '/' + partes[1] : tempos[d];
          const chuva = typeof chuvas[d] === 'number' ? chuvas[d] : null;
          const maximo = typeof maximos[d] === 'number' ? maximos[d] : null;

          html += '<article class="dia">' +
            '<p class="dia__titulo">Dia ' + (d + 1) + ' · ' + esc(data) + '</p>' +
            '<p class="dia__previsao">' +
              (chuva === null ? '' : (chuva >= 60 ? '🌧️' : '🌤️') + ' ' + chuva + '% de chuva · ') +
              (maximo === null ? '' : 'máx. ' + Math.round(maximo) + '°C') +
              (chuva !== null && chuva >= 60 ? ' · deixa o ar livre pra outro dia' : '') +
            '</p>';
          if (doDia.length) {
            html += '<ul>' + doDia.map(function (l) {
              const km = (Number(l.dist || 0) / 1000).toFixed(1);
              const titulo = String(l.title || '').replace(/ /g, '_');
              return '<li><a href="https://pt.wikipedia.org/wiki/' + encodeURIComponent(titulo) +
                '" target="_blank" rel="noopener">' + esc(l.title) + '</a> ' +
                '<span class="distancia">(' + km + ' km)</span></li>';
            }).join('') + '</ul>';
          }
          html += '</article>';
        }
        html += '</div>';
      }

      html += '<p class="nota">Sugestão automática com lugares próximos citados na Wikipédia, do mais perto pro mais longe. ' +
        'Confira horários e se o local está aberto antes de ir.</p>';

      alvo.innerHTML = html;
      alvo.setAttribute('aria-busy', 'false');
    } catch (erro) {
      alvo.setAttribute('aria-busy', 'false');
      alvo.innerHTML = '<p class="erro">Não consegui montar o roteiro dessa cidade agora. ' +
        'Tenta outra ou volta daqui a pouco.<br>' +
        '<button type="button" class="botao" data-tentar="roteiro">Tentar de novo</button></p>';
      const botao = alvo.querySelector('[data-tentar="roteiro"]');
      if (botao) {
        botao.addEventListener('click', function () {
          const sel = $('cidade-pe');
          montarRoteiro(sel ? sel.value : '');
        });
      }
    }
  }

  function iniciarRoteiro() {
    const sel = $('cidade-pe');
    if (!sel) return;
    sel.addEventListener('change', function () { montarRoteiro(sel.value); });
    carregarMunicipios();
  }

  /* ------------------------------------------------------------------
     Ligações internas (âncoras com acento)
     ------------------------------------------------------------------ */
  function iniciarAncoras() {
    $$('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        const bruto = link.getAttribute('href');
        if (!bruto || bruto === '#') return;
        const alvo = document.querySelector(bruto);
        if (!alvo) return;
        e.preventDefault();
        alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (history.replaceState) history.replaceState(null, '', bruto);
      });
    });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function iniciar() {
    iniciarTema();
    iniciarAncoras();
    montarMapa();
    iniciarGirias();
    renderFatos();
    atualizarContagem();
    marcarHora();
    iniciarRoteiro();

    // O relógio da contagem muda só à meia-noite, mas refaz a conta a cada
    // minuto para não depender de o contador cruzar a virada exatamente.
    setInterval(atualizarContagem, 60000);

    // Clima: 10 minutos.
    setInterval(function () { atualizarClima(false); }, 10 * 60 * 1000);
    setTimeout(function () { atualizarClima(false); }, 0);

    // Ao voltar para a aba, recarrega se o dado estiver velho.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      const cache = CACHE.ler('laursinhas:clima');
      const idade = cache && cache.quando ? Date.now() - cache.quando : Infinity;
      if (idade > 10 * 60 * 1000) atualizarClima(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
