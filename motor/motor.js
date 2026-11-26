/* =====================================================================
   Motor de padronização — Histórico Preditivo
   Converte as linhas brutas das planilhas consolidadas em um modelo
   padronizado de equipamentos e eventos. Roda no navegador e no Node.
   ===================================================================== */
(function (root) {
  'use strict';

  // ---------------- Padrões (podem ser estendidos por Padronizacao.xlsx) -------------
  var DEFAULTS = {
    // prefixo do local de instalação (centro SAP) -> unidade
    centros: {
      '7501': 'Barreiro', '7601': 'Barreiro', '7602': 'VTI Guarulhos', '7604': 'VTI Taubaté',
      '7571': 'VTS', '7575': 'VTS', '7576': 'VTS', 'VS01': 'Jeceaba', 'VM52': 'Mineração'
    },
    // sigla -> [nome da área, unidade]
    siglas: {
      RKL: ['Laminador RK', 'Barreiro'], RKA: ['Ajustagem RK', 'Barreiro'], RKT: ['Têmpera RK', 'Barreiro'],
      RKC: ['Bip', 'Barreiro'], RKR: ['Revestimento RK', 'Barreiro'], LAU: ['Laminador LA', 'Barreiro'],
      LAA: ['Ajustagem LA', 'Barreiro'], LAT: ['Têmpera LA', 'Barreiro'], TPC: ['OCTG – Rosqueamento', 'Barreiro'],
      TPT: ['OCTG – Rosqueamento', 'Barreiro'], TPP: ['OCTG – Rosqueamento', 'Barreiro'], TPL: ['OCTG – Fábrica de Luvas', 'Barreiro'],
      TPX: ['OCTG – X2', 'Barreiro'], OCTG: ['OCTG', 'Barreiro'], VTI: ['Trefilaria', 'Barreiro'], FOR: ['Forja', 'Barreiro'],
      ENE: ['Energia e Utilidades', 'Barreiro'], OFC: ['Oficina Central', 'Barreiro'], NDT: ['Teste NDT', 'Barreiro'],
      QPT: ['Laboratório', 'Barreiro'], DPA: ['Despacho', 'Barreiro'], PLL: ['Quadratura', 'Barreiro'],
      AFR: ['Aciaria', 'Jeceaba'], CCM: ['Aciaria', 'Jeceaba'], LIB: ['Aciaria', 'Jeceaba'], ACI: ['Aciaria', 'Jeceaba'],
      AF2: ['Alto Forno', 'Jeceaba'], AFC: ['Alto Forno', 'Jeceaba'], PCI: ['Alto Forno', 'Jeceaba'], SSP: ['Alto Forno', 'Jeceaba'],
      FCE: ['Ferramentaria Central', 'Jeceaba'], FMA: ['Ferramentaria Mandril', 'Jeceaba'], AJU: ['Ajustagem', 'Jeceaba'],
      COM: ['Laminação', 'Jeceaba'], LAQ: ['Laminação', 'Jeceaba'], LCH: ['Chanfragem', 'Jeceaba'], LQE: ['Quick Exit', 'Jeceaba'],
      LTT: ['Têmpera', 'Jeceaba'], DES: ['Despacho', 'Jeceaba'], FLU: ['Fábrica de Luvas', 'Jeceaba'], LRO: ['Rosqueamento OCTG', 'Jeceaba'],
      LOD: ['Rosqueamento LOD', 'Jeceaba'], LAB: ['Laboratório', 'Jeceaba'], PEL: ['Pelotização', 'Jeceaba'], PMP: ['Pelotização', 'Jeceaba'],
      UTI: ['Utilidades', 'Jeceaba'], SGA: ['Utilidades', 'Jeceaba'], ESI: ['Estoque Intermediário', 'Jeceaba'],
      ETE: ['Utilidades – ETE', 'Jeceaba'], FEA: ['Aciaria', 'Jeceaba'],
      ITM1: ['ITM1', 'Mineração'], ITM2: ['ITM2', 'Mineração'], VMN: ['Mineração', 'Mineração']
    },
    // prefixo do nome do arquivo -> unidade (quando não há local SAP)
    prefixoArquivoUnidade: { DWS: 'Jeceaba', UPS: 'Jeceaba', UTI: 'Jeceaba', VMN: 'Mineração', UPSRDI: 'Jeceaba' },
    // sigla de área ambígua (existe nas duas unidades): só usar se nada melhor
    ambiguas: { PBL: 1, ENE: 1, OFC: 1, NDT: 1, DES: 1, LAB: 1 },
    // aliases: chave normalizada -> nome oficial
    apelidos: {}
  };

  var MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

  // Condição padronizada. sev: gravidade usada no mapa (maior = pior)
  var STATUS = {
    ALARME: { label: 'Alarme', sev: 4 },
    ALERTA: { label: 'Alerta', sev: 3 },
    PRE: { label: 'Pré-Alerta', sev: 2 },
    NORMAL: { label: 'Normal', sev: 1 },
    NI: { label: 'Não inspecionado', sev: 0 },
    NC: { label: 'Sem classificação', sev: -1 }
  };
  // Códigos da tabela de rota
  // Códigos da planilha de controle: nome e cores iguais a CONDICOES do VibDocs (src/lib/condicao.ts).
  // '' = não dá para saber o código (status NC ou "Não monitorado" sem motivo).
  var CODIGOS = {
    '1': { nome: 'Normal', cor: '#00b050', texto: '#000' },
    '2': { nome: 'Pré-alerta', cor: '#ffff00', texto: '#000' },
    '3': { nome: 'Alerta', cor: '#ffc000', texto: '#000' },
    '4': { nome: 'Alarme', cor: '#ff0000', texto: '#000' },
    '5': { nome: 'Equipamento em manutenção', cor: '#7030a0', texto: '#fff' },
    '6': { nome: 'Equipamento inacessível', cor: '#0070c0', texto: '#fff' },
    '7': { nome: 'Condições técnicas', cor: '#77933c', texto: '#fff' },
    '8': { nome: 'Equipamento reserva', cor: '#00b0f0', texto: '#000' },
    '9': { nome: 'Equipamento sem produção', cor: '#bfbfbf', texto: '#000' },
    '10': { nome: 'Não visitado', cor: '#953735', texto: '#fff' },
    '11': { nome: 'Condição insegura', cor: '#595959', texto: '#fff' },
    '12': { nome: 'Indisponibilidade de acompanhamento', cor: '#fde9d9', texto: '#000' },
    '13': { nome: 'Equipamento desativado', cor: '#604a7b', texto: '#fff' },
    X: { nome: 'Não previsto no mês', cor: '#ffffff', texto: '#000' },
    R: { nome: 'Reprogramado', cor: '#ffffff', texto: '#000' },
    '': { nome: 'Sem classificação', cor: '#d9d9d9', texto: '#000' }
  };
  // Códigos da tabela de rota: [status, detalhe, código da planilha de controle]
  var ROTA = {
    '1': ['NORMAL', '', '1'], '2': ['PRE', '', '2'], '3': ['ALERTA', '', '3'], '4': ['ALARME', '', '4'],
    '5': ['NI', 'Equipamento em manutenção', '5'], '6': ['NI', 'Equipamento inacessível', '6'], '7': ['NI', 'Condições técnicas', '7'],
    '8': ['NI', 'Equipamento reserva', '8'], '9': ['NI', 'Equipamento sem produção', '9'], '10': ['NI', 'Não visitado', '10'],
    '11': ['NI', 'Condição insegura', '11'], '12': ['NI', 'Indisponibilidade de acompanhamento', '12'], '13': ['NI', 'Equipamento desativado', '13'],
    'X': ['NI', 'Não previsto no mês', 'X'], 'R': ['NI', 'Reprogramação', 'R']
  };
  var ROTA_TEXTO = [
    [/^NORMAL|^CONDI[CÇ][AÃ]O NORMAL/, ['NORMAL', '', '1']], [/^PR[EÉ].?ALERTA/, ['PRE', '', '2']], [/^ALERTA/, ['ALERTA', '', '3']], [/^ALARME/, ['ALARME', '', '4']],
    [/MANUTEN/, ['NI', 'Equipamento em manutenção', '5']], [/INACESS/, ['NI', 'Equipamento inacessível', '6']],
    [/CONDI[CÇ][OÕ]ES T[EÉ]CNICAS/, ['NI', 'Condições técnicas', '7']], [/RESERVA/, ['NI', 'Equipamento reserva', '8']],
    [/SEM PRODU/, ['NI', 'Equipamento sem produção', '9']], [/N[AÃ]O VISITADO/, ['NI', 'Não visitado', '10']],
    [/INSEGURA/, ['NI', 'Condição insegura', '11']], [/INDISPONIBILIDADE|SEM ACOMPANHAMENTO/, ['NI', 'Indisponibilidade de acompanhamento', '12']],
    [/DESATIVADO/, ['NI', 'Equipamento desativado', '13']], [/N[AÃ]O PREVISTO/, ['NI', 'Não previsto no mês', 'X']], [/REPROGRAMA/, ['NI', 'Reprogramação', 'R']]
  ];

  var TECNICAS = ['Termografia', 'Vibração', 'Acústica', 'Análise de motores (MCA)', 'Alinhamento', 'Balanceamento', 'Outras/Não identificado'];
  var OUTRAS = 'Outras/Não identificado';

  // ---------------- utilidades -----------------------------------------------------
  function str(v) { return v == null ? '' : String(v).trim(); }
  function semAcento(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  // chave de comparação: maiúsculas, sem acento, separadores e zeros à esquerda padronizados
  function chave(s) {
    s = semAcento(str(s)).toUpperCase()
      .replace(/[‐-―−]/g, '-')
      .replace(/\s*([-_/+.:])\s*/g, '$1')
      .replace(/\s+/g, ' ')
      .replace(/[.;,\s]+$/, '');
    return s.replace(/(^|[^0-9])0+(?=\d)/g, '$1');
  }
  function chaveBusca(s) { return chave(s).replace(/[^A-Z0-9]/g, ''); }
  function vazio(s) { s = str(s); return !s || /^(n[aã]o inform|sem nota$|n\/?a$|-$|nan$|none$)/i.test(s); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ym(y, m) { return y + '-' + pad(m); }

  function parseData(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate());
    if (typeof v === 'number' && v > 20000 && v < 80000) { // serial Excel
      var d = new Date(Math.round((v - 25569) * 864e5));
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    var s = str(v), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) {
      var y = +m[3]; if (y < 100) y += 2000;
      return y + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    }
    return null;
  }
  // data no nome do arquivo: AAMM + sequência (ex.: 446T250702, DWS260306, T250604) ou dd.mm.aaaa
  function dataArquivo(nome) {
    var b = str(nome).split('/').pop(), m;
    if ((m = b.match(/(\d{1,2})[.\-_](\d{1,2})[.\-_](20\d{2}|\d{2})(?!\d)/))) {
      var y = +m[3]; if (y < 100) y += 2000;
      if (+m[2] >= 1 && +m[2] <= 12 && y >= 2020 && y <= 2035) return { ym: ym(y, +m[2]), dia: y + '-' + pad(+m[2]) + '-' + pad(+m[1]) };
    }
    if ((m = b.match(/(?:^|[^0-9])(2[0-9])(0[1-9]|1[0-2])\d{2,3}(?!\d)/))) return { ym: ym(2000 + +m[1], +m[2]) };
    return null;
  }
  function mesRota(txt) {
    var m = str(txt).match(/\(([a-zç]{3})\/(\d{2})\)/i);
    if (!m) return null;
    var mm = MESES[m[1].toLowerCase()];
    return mm ? ym(2000 + +m[2], mm) : null;
  }

  // ---------------- classificação --------------------------------------------------
  // devolve [status, detalhe, código da planilha de controle ('' quando não dá para saber)]
  function statusDe(crit, sit) {
    var c = chave(crit);
    if (/ALARME/.test(c)) return ['ALARME', '', '4'];
    if (/PRE-?ALERTA/.test(c)) return ['PRE', '', '2'];
    if (/ALERTA/.test(c)) return ['ALERTA', '', '3'];
    var s = str(sit), m = s.match(/tabela de rota[^:]*:\s*(.+)$/i);
    if (m) {
      var t = semAcento(m[1]).toUpperCase().trim();
      var cod = t.match(/^CODIGO\s+(\w+)/);
      if (cod) return ROTA[cod[1].toUpperCase()] || ['NC', '', ''];
      for (var i = 0; i < ROTA_TEXTO.length; i++) if (ROTA_TEXTO[i][0].test(t)) return ROTA_TEXTO[i][1];
      return ['NC', '', ''];
    }
    var u = semAcento(s).toUpperCase();
    if (/CONDICO?ES NORMAIS|BOAS CONDICOES|ALINHAMENTO (OK|CONCLUIDO)|CONDICAO NORMAL|SEM ANOMALIA|DENTRO D[AO]S? (LIMITES|PADR)/.test(u)) return ['NORMAL', '', '1'];
    if (/NAO MONITORADO|EM MANUTENCAO|SEM PRODUCAO|INACESSIVEL/.test(u)) return ['NI', 'Não monitorado, motivo não informado', ''];
    return ['NC', '', ''];
  }

  function tecnicaDe(arquivo, equip, loc, sit) {
    var a = semAcento(str(arquivo).split('/').pop()).toUpperCase();
    var e = semAcento(str(equip) + ' ' + str(loc)).toUpperCase();
    if (/^TER(?!M)/.test(e) || /(^|[^A-Z])TER_/.test(e)) return 'Termografia';
    if (/^VIB/.test(e) || /(^|[^A-Z])VIB_/.test(e)) return 'Vibração';
    if (/^ACU(?!M)/.test(e) || /(^|[^A-Z])ACU_/.test(e)) return 'Acústica';
    if (/446ACU|^ACU|ACUSTIC/.test(a)) return 'Acústica';
    if (/446T\d|^T ?\d{6}|TERMOGR/.test(a)) return 'Termografia';
    if (/446V\d|446M\d|^VIB|VIBRA/.test(a)) return 'Vibração';
    if (/^MCA|(^|[^A-Z])MCA[^A-Z]/.test(a)) return 'Análise de motores (MCA)';
    if (/^ALN|ALINHAMENTO/.test(a)) return 'Alinhamento';
    if (/BALANCEAMENTO|^BAL[^A-Z]/.test(a)) return 'Balanceamento';
    var s = semAcento(str(sit)).toUpperCase();
    if (/°C|\bTEMPERATURA|TERMIC|SOBREAQUEC|AQUECIMENTO|MAL CONTATO|TERMOGRAMA/.test(s)) return 'Termografia';
    if (/ROLAMENTO|RPM|BPF[OI]|DESBALANC|DESALINH|FOLGA|VIBRA|MANCA(L|IS)|ENGRENAMENTO|MM\/S/.test(s)) return 'Vibração';
    if (/ALINHAMENTO/.test(s)) return 'Alinhamento';
    if (/ACUSTIC|ULTRASS|VAZAMENTO DE AR|DESCARGA PARCIAL/.test(s)) return 'Acústica';
    return OUTRAS;
  }

  function historicoRota(info) {
    var out = [], re = /([a-zç]{3})\/(\d{2})\s*=\s*(\w+)\s*\(([^)]*)\)/gi, m;
    while ((m = re.exec(str(info)))) {
      var mm = MESES[m[1].toLowerCase()]; if (!mm) continue;
      var cod = m[3].toUpperCase(), txt = semAcento(m[4]).toUpperCase(), st = null;
      for (var i = 0; i < ROTA_TEXTO.length; i++) if (ROTA_TEXTO[i][0].test(txt)) { st = ROTA_TEXTO[i][1]; break; }
      if (!st) st = ROTA[cod];
      if (st) out.push({ ym: ym(2000 + +m[2], mm), st: st, cod: cod });
    }
    return out;
  }

  // ---------------- unidade / área -------------------------------------------------
  function localizar(cfg, loc, equip, arquivo) {
    var L = chave(loc), E = chave(equip), A = chave(str(arquivo).split('/').pop());
    var unidade = null, sigla = null, m;
    if ((m = L.match(/^([A-Z0-9]{4})-([A-Z0-9]+)(?:-([A-Z0-9]+))?/))) {
      var c = m[1].replace(/^VS1$/, 'VS01').replace(/^VM52$/, 'VM52');
      unidade = cfg.centros[c] || cfg.centros[m[1]] || cfg.centros[c.replace(/(\D)(\d)$/, '$10$2')] || null;
      var s2 = m[2], s3 = m[3];
      if (/^ITM\d/.test(s2)) sigla = s2;
      else if (s3 && cfg.siglas[s3] && /^(DWS|UPS|UTI)$/.test(s2)) sigla = s3;
      else if (cfg.siglas[s2]) sigla = s2;
      else if (s3 && cfg.siglas[s3]) sigla = s3;
      if (/^TL/.test(s2) && !sigla) sigla = 'VTI';
    }
    if (!unidade) { var c0 = L.slice(0, 4); if (cfg.centros[c0]) unidade = cfg.centros[c0]; }
    function tokens(s) { return s.split(/[^A-Z0-9]+/).filter(Boolean); }
    var tk = tokens(L).concat(tokens(E)), ta = tokens(A);
    var achou = function (lista, aceitarAmbigua) {
      for (var i = 0; i < lista.length; i++) {
        var t = lista[i];
        if (/^ITM[12]$/.test(t)) return t;
        if (cfg.siglas[t] && (aceitarAmbigua || !cfg.ambiguas[t]) && t !== 'COM' && t !== 'CCM' && t !== 'DES') return t;
      }
      return null;
    };
    if (!sigla) sigla = achou(tk, false) || achou(ta, false) || achou(tk, true) || achou(ta, true);
    if (!sigla && /(^|[^A-Z])CV[_-]/.test(L + ' ' + E)) sigla = 'VTI';
    var pa = (A.match(/^([A-Z]+)/) || [])[1];
    // convenção Barreiro: SIGLA-446T/V/ACU (ex.: LAT-446T250702, OFC-446V251101); VMN-446M = Mineração
    var p446 = A.match(/^([A-Z]+)-446/);
    if (p446 && !sigla && cfg.siglas[p446[1]]) sigla = p446[1];
    if (!unidade && p446 && p446[1] !== 'VMN') unidade = 'Barreiro';
    if (!unidade && pa && cfg.prefixoArquivoUnidade[pa]) unidade = cfg.prefixoArquivoUnidade[pa];
    if (!unidade && sigla && cfg.siglas[sigla] && !cfg.ambiguas[sigla]) unidade = cfg.siglas[sigla][1];
    if (!unidade && /JECEABA/.test(A + ' ' + L)) unidade = 'Jeceaba';
    if (!unidade && /BARREIRO/.test(A + ' ' + L)) unidade = 'Barreiro';
    if (!unidade && /ITM[12]|MINA|MINERA/.test(A + ' ' + L + ' ' + E)) unidade = 'Mineração';
    if (!unidade && /ACIARIA|PELOTIZ|ALTO FORNO|FEA|ETE/.test(A + ' ' + L)) unidade = 'Jeceaba';
    var area = sigla && cfg.siglas[sigla] ? (sigla === cfg.siglas[sigla][0] ? sigla : sigla + ' – ' + cfg.siglas[sigla][0]) : null;
    return { unidade: unidade || 'Não identificada', area: area || 'Não identificada' };
  }

  // ---------------- equipamento ----------------------------------------------------
  function limparEquip(equip, loc) {
    var e = str(equip), l = str(loc), m;
    if ((m = l.match(/^(.*?)\s+Equipamento:\s*(.+)$/i))) { l = m[1].trim(); if (!e || vazio(e)) e = m[2].trim(); }
    if (vazio(e)) e = '';
    e = e.replace(/\s+/g, ' ').replace(/[.;,]+$/, '');
    return { e: e, l: l.replace(/\s+/g, ' ') };
  }
  function generico(k) { return /^\d+$/.test(k) || k.replace(/[^A-Z0-9]/g, '').length <= 3 || (!/\d/.test(k) && !/[_+]/.test(k)); }

  // ---------------- construção do modelo -------------------------------------------
  var COLS = {
    loc: /^localiza/i, equip: /^equipamento/i, nota: /^nota/i, coleta: /^data d[ae] coleta|^data$/i,
    reinc: /^reincidente/i, sit: /^situa/i, rec: /^recomenda/i, crit: /^criticidade/i, info: /^informa/i,
    arq: /^arquivo/i, unidade: /^unidade/i, tecnica: /^t[eé]cnica/i, area: /^[aá]rea/i, email: /^data do e-?mail|^recebido/i, caminho: /^caminho|^link do relat/i
  };
  function mapearColunas(header) {
    var idx = {};
    header.forEach(function (h, i) { for (var k in COLS) if (idx[k] == null && COLS[k].test(str(h))) idx[k] = i; });
    return idx;
  }

  // ---------------- revisões de relatórios ----------------
  // "X rev.pdf", "X rev_1.pdf", "X Rev01.pdf", "X revisão 1.pdf", "X corrigido.pdf" → mesmo relatório-base,
  // com número de revisão. Para o mesmo relatório-base e o mesmo mês de coleta, só a revisão mais alta conta.
  // "(1)", "(2)" não contam: costumam ser relatórios de meses diferentes com o mesmo nome.
  function revisaoDe(nome) {
    var s = semAcento(str(nome).split(/[\\/]/).pop()).replace(/\.pdf$/i, '').trim(), rank = 0, m, mudou = true;
    while (mudou) {
      mudou = false;
      if ((m = s.match(/[\s_\-.(]+rev(?:isao)?[\s_\-.]*(\d{1,2})\)?$/i))) { rank = Math.max(rank, +m[1] + 1); s = s.slice(0, m.index); mudou = true; continue; }
      if ((m = s.match(/[\s_\-.(]+(?:rev(?:isao|isado)?|corrigid[oa]|correcao|retificad[oa])\)?$/i))) { rank = Math.max(rank, 1); s = s.slice(0, m.index); mudou = true; continue; }
    }
    return { base: chaveBusca(s), rank: rank, arq: chave(str(nome).split(/[\\/]/).pop()) };
  }
  function mesColeta(v) { var d = parseData(v); return d ? d.slice(0, 7) : ''; }
  function cabecalho(rows, re) {
    for (var i = 0; i < Math.min(rows.length, 10); i++) if (rows[i] && rows[i].some(function (c) { return re.test(str(c)); })) return i;
    return -1;
  }
  // Devolve uma função (arquivoDeOrigem, planilha) → true quando a linha foi substituída por outra versão.
  function regrasRevisao(fontes) {
    var maxRank = {}, maisNova = {}, explicitas = {};
    function planilhaDe(f) { return str(f.nome).split(' › ')[0]; }
    function quando(f) {   // última data no nome da planilha (ex.: _2026-11-24_1725), senão a data de modificação
      var ms = planilhaDe(f).match(/\d{4}-\d{2}-\d{2}(?:_\d{4})?/g); if (!ms) return str(f.modificado);
      var m = ms[ms.length - 1]; return m.slice(0, 10) + 'T' + (m.length > 10 ? m.slice(11, 13) + ':' + m.slice(13, 15) : '00:00');
    }
    fontes.forEach(function (f) {
      var rows = f.rows || [];
      // aba "Substituições": Arquivo substituído | Substituído por (gerada pela rotina quinzenal)
      var hs = cabecalho(rows, /^arquivo substitu/i);
      if (hs >= 0) {
        var ia = rows[hs].findIndex(function (c) { return /^arquivo substitu/i.test(str(c)); });
        for (var r = hs + 1; r < rows.length; r++) { var a = rows[r] && str(rows[r][ia]); if (a) explicitas[chave(a.split(/[\\/]/).pop())] = 1; }
        return;
      }
      var hi = cabecalho(rows, /^equipamento/i); if (hi < 0) return;
      var ia2 = rows[hi].findIndex(function (c) { return /^arquivo/i.test(str(c)); }); if (ia2 < 0) return;
      var ic = rows[hi].findIndex(function (c) { return COLS.coleta.test(str(c)); });
      var t = quando(f);
      for (var r2 = hi + 1; r2 < rows.length; r2++) {
        var nome = rows[r2] && str(rows[r2][ia2]); if (!nome) continue;
        var v = revisaoDe(nome); if (!v.base) continue;
        var ym = mesColeta(ic < 0 ? '' : rows[r2][ic]), kb = v.base + '|' + ym, ka = v.arq + '|' + ym;
        if (!(kb in maxRank) || v.rank > maxRank[kb]) maxRank[kb] = v.rank;
        if (!maisNova[ka] || t > maisNova[ka]) maisNova[ka] = t;
      }
    });
    return function (nome, f, coleta) {
      nome = str(nome); if (!nome) return false;
      var v = revisaoDe(nome), ym = mesColeta(coleta);
      if (explicitas[v.arq]) return true;
      if (v.base && v.rank < maxRank[v.base + '|' + ym]) return true;          // revisão mais nova (outro nome), mesmo mês
      var ka = v.arq + '|' + ym;
      return !!maisNova[ka] && quando(f) < maisNova[ka];                       // mesmo nome reenviado no mesmo mês: vale a planilha mais nova
    };
  }

  function construir(linhasPorArquivo, cfgExtra) {
    var cfg = mesclarCfg(cfgExtra);
    var equipamentos = {}, lista = [], eventos = [], vistos = {}, stats = { linhas: 0, duplicadas: 0, semData: 0, substituidas: 0, arquivos: {} };
    var subst = regrasRevisao(linhasPorArquivo);
    function getEq(raw) {
      var ce = limparEquip(raw.equip, raw.loc), e = ce.e, l = ce.l;
      var ap = cfg.apelidos[chave(e)]; if (ap) e = ap;
      var apl = cfg.apelidos[chave(l)]; if (apl) l = apl;
      if (!e && !l) return null;
      var ke = chave(e), kl = chave(l), key;
      if (!e) { key = 'L:' + kl; e = l; }
      else if (generico(ke)) key = kl + ' › ' + ke;
      else key = ke;
      var q = equipamentos[key];
      if (!q) {
        q = equipamentos[key] = { id: lista.length, key: key, nomes: {}, locs: {}, unidades: {}, areas: {}, tecs: {}, ev: [], generico: generico(ke) };
        lista.push(q);
      }
      q.nomes[e] = (q.nomes[e] || 0) + 1;
      if (l && l !== e) q.locs[l] = (q.locs[l] || 0) + 1;
      return q;
    }
    linhasPorArquivo.forEach(function (arq) {
      var rows = arq.rows; if (!rows || !rows.length) return;
      var hi = 0;
      for (var i = 0; i < Math.min(rows.length, 10); i++) if (rows[i] && rows[i].some(function (c) { return /equipamento/i.test(str(c)); })) { hi = i; break; }
      var idx = mapearColunas(rows[hi]);
      if (idx.equip == null && idx.loc == null) return;
      stats.arquivos[arq.nome] = 0;
      for (var r = hi + 1; r < rows.length; r++) {
        var row = rows[r]; if (!row) continue;
        var g = function (k) { return idx[k] == null ? '' : row[idx[k]]; };
        var raw = { loc: g('loc'), equip: g('equip'), nota: str(g('nota')), coleta: g('coleta'), reinc: g('reinc'), sit: str(g('sit')),
          rec: str(g('rec')), crit: str(g('crit')), info: str(g('info')), arq: str(g('arq')), email: g('email'), caminho: g('caminho'), unidade: str(g('unidade')), tecnica: str(g('tecnica')), area: str(g('area')) };
        if (!str(raw.loc) && !str(raw.equip) && !raw.sit) continue;
        stats.linhas++; stats.arquivos[arq.nome]++;
        if (subst(raw.arq, arq, raw.coleta)) { stats.substituidas++; continue; }
        var sig = [chave(raw.loc), chave(raw.equip), raw.sit, raw.rec, raw.crit, str(raw.coleta), raw.nota, chave(raw.arq.split('/').pop())].join('\u0001');
        if (vistos[sig]) { stats.duplicadas++; continue; }
        vistos[sig] = 1;
        var q = getEq(raw); if (!q) continue;

        // data do evento
        var coleta = parseData(raw.coleta), dEmail = parseData(raw.email), rota = mesRota(raw.sit), fa = dataArquivo(raw.arq);
        var data = null, prec = 'm', origemData = '';
        if (rota) { data = rota; origemData = 'Mês da rota'; if (coleta && coleta.slice(0, 7) === rota) { data = coleta; prec = 'd'; } }
        else if (fa) {
          if (coleta && coleta.slice(0, 7) === fa.ym) { data = coleta; prec = 'd'; origemData = 'Data da coleta'; }
          else if (fa.dia) { data = fa.dia; prec = 'd'; origemData = 'Data no nome do arquivo'; }
          else { data = fa.ym; origemData = 'Mês do relatório'; }
        } else if (dEmail) { data = dEmail; prec = 'd'; origemData = 'Data do e-mail'; }
        else if (coleta) { data = coleta; prec = 'd'; origemData = 'Data da coleta'; }
        if (!data) stats.semData++;
        if (data && data.length === 7) data += '-01';

        var st = statusDe(raw.crit, raw.sit);
        var loc = localizar(cfg, raw.loc, raw.equip, raw.arq);
        var tec = tecnicaDe(raw.arq, raw.equip, raw.loc, raw.sit);
        // classificação informada pelo ChatGPT só complementa o que não foi identificado
        if (loc.unidade === 'Não identificada' && raw.unidade && !/n[aã]o identificad/i.test(raw.unidade)) loc.unidade = raw.unidade;
        if (loc.area === 'Não identificada' && raw.area && !/n[aã]o identificad/i.test(raw.area)) loc.area = raw.area.replace(/^(\w+) - /, '$1 – ');
        if (tec === OUTRAS && raw.tecnica && !/^outras/i.test(raw.tecnica)) tec = raw.tecnica;
        var ev = {
          eq: q.id, data: data, prec: prec, origemData: origemData, st: st[0], stDet: st[1] || '', cod: st[2] || '',
          crit: raw.crit, sit: raw.sit, rec: raw.rec, info: raw.info,
          nota: vazio(raw.nota) ? '' : raw.nota, reinc: parseData(raw.reinc) || '', coleta: coleta || '',
          arq: raw.arq, tec: tec, unidade: loc.unidade, area: loc.area, caminho: str(raw.caminho).replace(/\\/g, '/').replace(/^\/+/, ''), fonte: 'relatorio'
        };
        eventos.push(ev); q.ev.push(ev);
        q.unidades[loc.unidade] = (q.unidades[loc.unidade] || 0) + 1;
        q.areas[loc.area] = (q.areas[loc.area] || 0) + 1;
        q.tecs[tec] = (q.tecs[tec] || 0) + 1;

        // histórico da rota citado nas informações complementares
        historicoRota(raw.info).forEach(function (h) {
          var lim = fa ? fa.ym : (data ? data.slice(0, 7) : null);
          if (lim && h.ym > lim) return; // descarta meses futuros digitados errado (ex.: jul/27)
          q._hist = q._hist || {};
          var k = h.ym;
          if (!q._hist[k]) q._hist[k] = { ym: h.ym, st: h.st, cod: h.cod, arq: raw.arq, caminho: str(raw.caminho), tec: tec };
        });
      }
    });

    // finalizar equipamentos
    lista.forEach(function (q) {
      var meses = {};
      q.ev.forEach(function (e) { if (e.data) meses[e.data.slice(0, 7)] = 1; });
      if (q._hist) for (var k in q._hist) {
        if (meses[k]) continue;
        var h = q._hist[k];
        var ev = { eq: q.id, data: k + '-01', prec: 'm', origemData: 'Histórico da rota', st: h.st[0], stDet: h.st[1] || '', cod: h.st[2] || '', crit: '',
          sit: 'Registro do histórico da rota: código ' + h.cod + (h.st[1] ? ' (' + h.st[1] + ')' : ''), rec: '', info: '', nota: '', reinc: '', coleta: '',
          arq: h.arq, caminho: h.caminho, tec: h.tec, fonte: 'historico' };
        q.ev.push(ev); eventos.push(ev);
      }
      delete q._hist;
      q.ev.sort(function (a, b) { return (b.data || '0') < (a.data || '0') ? -1 : (b.data || '0') > (a.data || '0') ? 1 : STATUS[b.st].sev - STATUS[a.st].sev; });
      q.nome = top(q.nomes); q.loc = top(q.locs) || ''; q.unidade = topSem(q.unidades); q.area = topSem(q.areas);
      q.tecnicas = Object.keys(q.tecs).filter(function (t) { return t !== OUTRAS || Object.keys(q.tecs).length === 1; });
      q.busca = chaveBusca(Object.keys(q.nomes).join(' ') + ' ' + Object.keys(q.locs).join(' ')) + ' ' +
        semAcento(Object.keys(q.nomes).join(' ') + ' ' + Object.keys(q.locs).join(' ') + ' ' + q.area + ' ' + q.unidade).toUpperCase() + ' ' +
        q.ev.map(function (e) { return e.nota; }).join(' ');
      if (q.generico && q.loc) q.titulo = q.nome + ' — ' + q.loc; else q.titulo = q.nome;
      // condição atual = pior condição avaliada (exclui não inspecionado) no mês mais recente com inspeção
      var ult = null;
      for (var i = 0; i < q.ev.length; i++) { var e = q.ev[i]; if (e.data && STATUS[e.st].sev >= 1) { ult = e.data.slice(0, 7); break; } }
      var pior = null;
      if (ult) q.ev.forEach(function (e) { if (e.data && e.data.slice(0, 7) === ult && STATUS[e.st].sev >= 1 && (!pior || STATUS[e.st].sev > STATUS[pior].sev)) pior = e.st; });
      q.atual = pior || (q.ev.some(function (e) { return e.st === 'NI'; }) ? 'NI' : 'NC');
      q.ultimaInspecao = ult;
      var datas = q.ev.filter(function (e) { return e.data; }).map(function (e) { return e.data; }).sort();
      q.primeira = datas[0] || ''; q.ultima = datas[datas.length - 1] || '';
      q.anomalias = q.ev.filter(function (e) { return STATUS[e.st].sev >= 2; }).length;
      q.n = q.ev.length;
    });
    return { equipamentos: lista, eventos: eventos, stats: stats, cfg: cfg };
  }
  function top(o) { var b = null, n = -1; for (var k in o) if (o[k] > n) { n = o[k]; b = k; } return b; }
  function topSem(o) { var c = {}; for (var k in o) if (k !== 'Não identificada') c[k] = o[k]; return top(c) || 'Não identificada'; }

  function mesclarCfg(extra) {
    var c = JSON.parse(JSON.stringify(DEFAULTS));
    if (!extra) return c;
    ['centros', 'siglas', 'prefixoArquivoUnidade', 'apelidos'].forEach(function (k) { if (extra[k]) for (var x in extra[k]) c[k][x] = extra[k][x]; });
    return c;
  }
  // lê Padronizacao.xlsx (abas Siglas, Centros, Apelidos) já convertida em linhas
  function cfgDePlanilha(abas) {
    var out = { siglas: {}, centros: {}, apelidos: {} };
    function linhas(nome) { for (var k in abas) if (semAcento(k).toLowerCase().indexOf(nome) === 0) return abas[k].slice(1); return []; }
    linhas('sigla').forEach(function (r) { if (str(r[0])) out.siglas[chave(r[0])] = [str(r[1]) || str(r[0]), str(r[2]) || 'Não identificada']; });
    linhas('centro').forEach(function (r) { if (str(r[0])) out.centros[str(r[0]).toUpperCase()] = str(r[1]); });
    linhas('apelido').forEach(function (r) { if (str(r[0]) && str(r[1])) out.apelidos[chave(r[0])] = str(r[1]); });
    return out;
  }

  // ---------------- leitura de planilhas (XLSX = SheetJS, passado por quem chama) ----------------
  function lerPlanilha(XLSX, buf, nome) {
    var wb = XLSX.read(buf, { type: 'array', cellDates: true, dense: true });
    var linhas = [];
    wb.SheetNames.forEach(function (sn) {
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
      var temCab = rows.slice(0, 10).some(function (r) { return r && r.some(function (c) { return /^equipamento/i.test(String(c).trim()); }); });
      if (!temCab) temCab = rows.slice(0, 10).some(function (r) { return r && r.some(function (c) { return /^arquivo substitu/i.test(String(c).trim()); }); });
      if (temCab) linhas.push({ nome: nome + (wb.SheetNames.length > 1 ? ' › ' + sn : ''), rows: rows });
    });
    return linhas;
  }
  function lerAbas(XLSX, buf) {
    var wb = XLSX.read(buf, { type: 'array' }), o = {};
    wb.SheetNames.forEach(function (sn) { o[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' }); });
    return o;
  }

  // preenchido por ferramentas/embutir-motor.py (sha256 de motor/motor.js, 10 primeiros caracteres)
  var VERSAO = '';

  var API = { construir: construir, cfgDePlanilha: cfgDePlanilha, lerPlanilha: lerPlanilha, lerAbas: lerAbas,
    STATUS: STATUS, CODIGOS: CODIGOS, VERSAO: VERSAO, TECNICAS: TECNICAS, chave: chave, chaveBusca: chaveBusca,
    semAcento: semAcento, DEFAULTS: DEFAULTS, _t: { statusDe: statusDe, tecnicaDe: tecnicaDe, localizar: localizar, dataArquivo: dataArquivo, historicoRota: historicoRota } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Engine = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
