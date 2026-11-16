(function () {
  'use strict';

  // ---------- Configuração da escala ----------
  const AREAS = [
    { id: 'plaquinha', nome: 'Plaquinha', n: 4 },
    { id: 'visitante', nome: 'Visitante', n: 4 },
    { id: 'conexao',   nome: 'Conexão',   n: 4 },
    { id: 'oferta',    nome: 'Oferta',    n: 6 }
  ];
  const HORARIOS = { 4: ['20h'], 0: ['10h', '18h', '20h'] };   // 4 = quinta, 0 = domingo
  const NOME_DIA = { 4: 'Quinta-feira', 0: 'Domingo' };

  // ---------- Datas ----------
  const p2 = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const deIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const br = s => { const [y, m, d] = s.split('-'); return d + '/' + m + '/' + y; };
  const norm = x => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const hojeD = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
  const valida = d => (d.getDay() === 0 || d.getDay() === 4) && d >= hojeD;

  function proximaData() {
    const d = new Date(hojeD);
    while (!valida(d)) d.setDate(d.getDate() + 1);
    return iso(d);
  }

  // ---------- Armazenamento (Firebase ou local) ----------
  // Estrutura: escala / AAAA-MM-DD / horário / vaga = nome
  const cfg = window.FIREBASE_CONFIG || {};
  const usaFirebase = !!(cfg.apiKey && cfg.databaseURL && window.firebase);
  let dados = {};
  let backend;

  if (usaFirebase) {
    firebase.initializeApp(cfg);
    const raiz = firebase.database().ref('escala');
    backend = {
      escutar(cb) {
        raiz.on('value', s => cb(s.val() || {}), () => {
          const m = $('modo');
          m.textContent = 'Não foi possível ler a escala do Firebase. Verifique as regras do banco e o databaseURL (veja o README).';
          m.className = 'modo aviso';
          document.querySelector('main').prepend(m);
        });
      },
      reservar(data, hora, slot, nome) {
        return raiz.child(data).child(hora).child(slot)
          .transaction(atual => (atual ? undefined : nome))   // só grava se estiver livre
          .then(r => r.committed);
      },
      cancelar(data, hora, slot, nome) {
        return raiz.child(data).child(hora).child(slot)
          .transaction(atual => (atual && norm(atual) === norm(nome) ? null : undefined))  // só apaga se ainda for o mesmo nome
          .then(r => r.committed);
      }
    };
  } else {
    const CH = 'servolution_escala_v2';
    const ler = () => { try { return JSON.parse(localStorage.getItem(CH)) || {}; } catch (e) { return {}; } };
    backend = {
      escutar(cb) {
        cb(ler());
        window.addEventListener('storage', e => { if (e.key === CH) cb(ler()); });
      },
      reservar(data, hora, slot, nome) {
        const d = ler();
        d[data] = d[data] || {}; d[data][hora] = d[data][hora] || {};
        if (d[data][hora][slot]) return Promise.resolve(false);
        d[data][hora][slot] = nome;
        localStorage.setItem(CH, JSON.stringify(d));
        dados = d; render();
        return Promise.resolve(true);
      },
      cancelar(data, hora, slot, nome) {
        const d = ler();
        const atual = d[data] && d[data][hora] && d[data][hora][slot];
        if (!atual || norm(atual) !== norm(nome)) return Promise.resolve(false);
        delete d[data][hora][slot];
        localStorage.setItem(CH, JSON.stringify(d));
        dados = d; render();
        return Promise.resolve(true);
      }
    };
  }

  // ---------- Elementos / estado ----------
  const $ = id => document.getElementById(id);
  const elHora = $('horario'), elNome = $('nome'), elGrade = $('grade');
  let selData = proximaData();
  let mes = { y: deIso(selData).getFullYear(), m: deIso(selData).getMonth() };

  const horariosDe = s => HORARIOS[deIso(s).getDay()];

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2800);
  }

  // ---------- Calendário ----------
  const temDados = s => {
    const d = dados[s];
    return !!d && Object.keys(d).some(h => d[h] && Object.keys(d[h]).length);
  };

  function renderCal() {
    $('mesTitulo').textContent = new Date(mes.y, mes.m, 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    $('mesAnt').disabled = (mes.y === hojeD.getFullYear() && mes.m === hojeD.getMonth());

    const cal = $('cal'); cal.innerHTML = '';
    ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach(l => {
      const e = document.createElement('div'); e.className = 'sem'; e.textContent = l; cal.appendChild(e);
    });
    const primeiro = new Date(mes.y, mes.m, 1).getDay();
    for (let i = 0; i < primeiro; i++) cal.appendChild(document.createElement('div'));
    const total = new Date(mes.y, mes.m + 1, 0).getDate();
    for (let dia = 1; dia <= total; dia++) {
      const dt = new Date(mes.y, mes.m, dia), s = iso(dt), ok = valida(dt);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dia' + (ok ? ' ativo' : '') + (s === selData ? ' sel' : '') + (ok && temDados(s) ? ' tem' : '');
      b.textContent = dia;
      b.disabled = !ok;
      if (ok) b.addEventListener('click', () => { selData = s; atualizarHorarios(); render(); });
      cal.appendChild(b);
    }
    const d = deIso(selData);
    $('dataSel').textContent = d.toLocaleDateString('pt-BR',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function atualizarHorarios() {
    const hs = horariosDe(selData);
    const atual = elHora.value;
    elHora.innerHTML = hs.map(h => `<option value="${h}">${h}</option>`).join('');
    if (hs.includes(atual)) elHora.value = atual;
    elHora.disabled = hs.length === 1;   // quinta: apenas 20h
  }

  // ---------- Renderização ----------
  function render() {
    renderCal();
    const ocupados = ((dados[selData] || {})[elHora.value]) || {};
    elGrade.innerHTML = '';
    AREAS.forEach(area => {
      const sec = document.createElement('section');
      sec.className = 'area';
      const h = document.createElement('h2'); h.textContent = area.nome; sec.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'slots';
      for (let i = 1; i <= area.n; i++) {
        const slot = area.id + '_' + i;
        const nome = ocupados[slot];
        const n = document.createElement('span'); n.className = 'n'; n.textContent = i + '-';
        const t = document.createElement('span'); t.className = 't';
        let b;
        if (nome) {
          b = document.createElement('div');
          b.className = 'slot ocupado';
          t.textContent = nome;
          const c = document.createElement('button');
          c.type = 'button'; c.className = 'cancelar'; c.textContent = 'Cancelar';
          c.addEventListener('click', () => cancelar(slot, area.nome, i, nome));
          b.append(n, t, c);
        } else {
          b = document.createElement('button');
          b.type = 'button';
          b.className = 'slot livre';
          t.textContent = 'Livre – toque para entrar';
          b.append(n, t);
          b.addEventListener('click', () => reservar(slot, area.nome, i));
        }
        grid.appendChild(b);
      }
      sec.appendChild(grid);
      elGrade.appendChild(sec);
    });
    renderLista();
  }

  // Lista de quem já se cadastrou na data escolhida (todos os horários)
  function renderLista() {
    const box = $('lista'); box.innerHTML = '';
    const dia = dados[selData] || {};
    let algum = false;
    horariosDe(selData).forEach(hora => {
      const h = dia[hora] || {};
      const bloco = document.createElement('div'); bloco.className = 'bl';
      const tit = document.createElement('h3'); tit.textContent = hora; bloco.appendChild(tit);
      let tem = false;
      AREAS.forEach(a => {
        const nomes = [];
        for (let i = 1; i <= a.n; i++) if (h[a.id + '_' + i]) nomes.push(h[a.id + '_' + i]);
        if (!nomes.length) return;
        tem = true; algum = true;
        const p = document.createElement('p');
        const s = document.createElement('strong'); s.textContent = a.nome + ': ';
        p.append(s, document.createTextNode(nomes.join(', ')));
        bloco.appendChild(p);
      });
      if (!tem) { const p = document.createElement('p'); p.className = 'vazio'; p.textContent = 'Ninguém cadastrado ainda.'; bloco.appendChild(p); }
      box.appendChild(bloco);
    });
    if (!algum) $('lista').classList.add('sem-nomes'); else $('lista').classList.remove('sem-nomes');
  }

  async function reservar(slot, areaNome, i) {
    const nome = elNome.value.trim().replace(/\s+/g, ' ');
    if (!nome) { toast('Digite seu nome primeiro.'); elNome.focus(); return; }
    try {
      const ok = await backend.reservar(selData, elHora.value, slot, nome);
      toast(ok ? `${nome} adicionado(a) em ${areaNome} ${i}.` : 'Esse campo acabou de ser ocupado. Escolha outro.');
    } catch (e) {
      toast('Erro ao salvar. Verifique a conexão.');
    }
  }

  // Cancela o próprio cadastro: o nome digitado em "Seu nome" precisa ser o mesmo da vaga
  async function cancelar(slot, areaNome, i, nomeSlot) {
    const nome = elNome.value.trim();
    if (!nome || norm(nome) !== norm(nomeSlot)) {
      toast('Para cancelar, digite em "Seu nome" o mesmo nome do cadastro.');
      elNome.focus(); return;
    }
    if (!confirm(`Cancelar o cadastro de ${nomeSlot} em ${areaNome} ${i}\n(${br(selData)} – ${elHora.value})?`)) return;
    try {
      const ok = await backend.cancelar(selData, elHora.value, slot, nomeSlot);
      toast(ok ? 'Cadastro cancelado. A vaga está livre novamente.' : 'Não foi possível cancelar. Atualize a página e tente de novo.');
    } catch (e) {
      toast('Erro ao cancelar. Verifique a conexão e as regras do banco.');
    }
  }

  // ---------- PDF ----------
  function carregarLogo() {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d');
        x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0);
        res({ url: c.toDataURL('image/jpeg', 0.9), w: c.width, h: c.height });
      };
      img.onerror = () => res(null);
      img.src = 'logo.png';
    });
  }

  function paginaCulto(doc, data, hora, logo, primeira) {
    if (!primeira) doc.addPage();
    const L = 15, R = 195, COL2 = 112, W = 210;
    const ocup = (dados[data] || {})[hora] || {};
    const nomeDia = NOME_DIA[deIso(data).getDay()];

    // cabeçalho
    doc.setFont('helvetica', 'bold'); doc.setFontSize(24);
    doc.text('Servolution', W / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
    doc.text('E S C A L A', W / 2, 26, { align: 'center' });
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text(`Culto: ${nomeDia} – ${hora}`, W / 2, 32, { align: 'center' });
    doc.setTextColor(0);

    if (logo) {                       // logo discreto, canto superior direito
      const lh = 10, lw = lh * logo.w / logo.h;
      doc.addImage(logo.url, 'JPEG', R - lw, 8, lw, lh);
    }

    const campo = (rot, x, y, xFim, valor, fs) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(fs || 10.5);
      doc.text(rot, x, y);
      const xi = x + doc.getTextWidth(rot) + 1.5;
      doc.setDrawColor(120); doc.setLineWidth(0.25);
      doc.line(xi, y + 0.8, xFim, y + 0.8);
      if (valor) { doc.setFontSize(10.5); doc.text(valor, xi + 1, y - 0.4); }
    };

    campo('Data:', L, 44, 70, br(data));
    campo('Início:', 76, 44, 128, hora);
    campo('Término:', 134, 44, R);
    campo('Ministro:', L, 54, R);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Escala', L, 68); doc.text('Relatório', COL2, 68);
    doc.setDrawColor(0); doc.setLineWidth(0.4);
    doc.line(L, 70, 100, 70); doc.line(COL2, 70, R, 70);

    const PASSO = 6.5;
    const secao = (titulo, x, y) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(titulo, x, y);
      return y + PASSO;
    };

    // coluna esquerda
    let y = 79;
    const esq = [
      ['Plaquinhas', 'plaquinha', 4], ['Visitante', 'visitante', 4], ['Conexão', 'conexao', 4],
      ['Púlpito', null, 2], ['Contagem', null, 2], ['Oferta', 'oferta', 6]
    ];
    esq.forEach(([tit, id, n]) => {
      y = secao(tit, L, y);
      for (let i = 1; i <= n; i++) {
        campo(i + '-', L, y, 100, id ? ocup[id + '_' + i] : '');
        y += PASSO;
      }
      y += 3;
    });

    // coluna direita
    y = 79;
    const dir = [
      ['Público', ['Adultos:', 'Crianças:', 'Visitantes:', 'Total:', 'Salvação e reconciliação:']],
      ['Cursos', ['Jornada:', 'Ondas:', 'Intercessão:', 'Casais:', 'Clic 1:', 'Clic 2:', 'Clic 3:']],
      ['Voluntários do Culto', ['Servolution:', 'Louvor:', 'Jornada:', 'Ikids:', 'Ondas:',
        'Comunicação (criativa/som/mídia):', '5 Estrelas:', 'Intercessão:', 'Staff:']]
    ];
    dir.forEach(([tit, itens]) => {
      y = secao(tit, COL2, y);
      itens.forEach(r => { campo(r, COL2, y, R, '', 9); y += PASSO; });
      y += 3;
    });

    doc.setFontSize(8); doc.setTextColor(140);
    doc.text('ILAN Church · Servolution', W / 2, 289, { align: 'center' });
    doc.setTextColor(0);
  }

  async function imprimir() {
    if (!window.jspdf) { toast('Biblioteca de PDF não carregou. Verifique a internet.'); return; }
    const data = selData;                       // data escolhida no calendário
    const logo = await carregarLogo();
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    horariosDe(data).forEach((h, i) => paginaCulto(doc, data, h, logo, i === 0));
    doc.save(`escala-servolution-${data}.pdf`);
    toast('PDF de ' + br(data) + ' gerado.');
  }

  // ---------- Eventos ----------
  elHora.addEventListener('change', render);
  $('mesAnt').addEventListener('click', () => {
    mes.m--; if (mes.m < 0) { mes.m = 11; mes.y--; } renderCal();
  });
  $('mesProx').addEventListener('click', () => {
    mes.m++; if (mes.m > 11) { mes.m = 0; mes.y++; } renderCal();
  });
  $('btnImprimir').addEventListener('click', imprimir);
  $('btnZap').addEventListener('click', () => {
    const msg = 'Servolution – escolha seu lugar na escala de voluntários: ' + location.href.split('#')[0];
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  });

  if (!usaFirebase) {
    const m = $('modo');
    m.textContent = 'ATENÇÃO – modo teste: os nomes ficam salvos só neste aparelho e NÃO aparecem para outras pessoas. Configure o Firebase (veja o README) para compartilhar a escala entre os voluntários.';
    m.className = 'modo aviso';
    document.querySelector('main').prepend(m);
  }

  atualizarHorarios();
  backend.escutar(d => { dados = d; render(); });
  render();
})();
