// Teste do motor (motor/motor.js) e do motor embutido em index.html. Usa só dados inventados.
//   node ferramentas/testar-motor.mjs                 → roda as verificações
//   node ferramentas/testar-motor.mjs --dump SAIDA    → grava o resultado de construir() para as fontes de teste
//        [--motor CAMINHO.js]                          (outro motor, p.ex. o antigo extraído do index.html)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const CAB = ['Localização', 'Equipamento', 'Nota', 'Data de coleta', 'Reincidente', 'Situação', 'Recomendação',
  'Criticidade', 'Informações complementares', 'Arquivo', 'Caminho do relatório'];

// [loc, equip, nota, coleta, reinc, sit, rec, crit, info, arq]
const L = (loc, equip, nota, coleta, sit, crit, info, arq, reinc = '') =>
  [loc, equip, nota, coleta, reinc, sit, 'Acompanhar', crit, info, arq, 'Relatorios/' + arq];

function fontes() {
  const a = [CAB,
    L('7501-RKL-LAM-001', 'MOTOR_RKL_001', 'N01', '10/03/2026', 'Desbalanceamento', 'Alarme', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-002', 'MOTOR_RKL_002', 'N02', '10/03/2026', 'Folga no mancal', 'Pré-Alerta', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-003', 'MOTOR_RKL_003', 'N03', '10/03/2026', 'Rolamento com defeito', 'Alerta', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-004', 'MOTOR_RKL_004', 'N04', '10/03/2026', 'Normal', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-005', 'MOTOR_RKL_005', 'N05', '', 'Equipamento fora da tabela de rota: código 8 (mar/26)', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-006', 'MOTOR_RKL_006', 'N06', '', 'Equipamento fora da tabela de rota: Reprogramado', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-007', 'MOTOR_RKL_007', 'N07', '', 'Equipamento fora da tabela de rota: não previsto', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-008', 'MOTOR_RKL_008', 'N08', '', 'Não monitorado', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-009', 'MOTOR_RKL_009', 'N09', '', 'texto qualquer', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-010', 'MOTOR_RKL_010', 'N10', '', 'Equipamento fora da tabela de rota: código 99', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-011', 'MOTOR_RKL_011', 'N11', '', 'Equipamento fora da tabela de rota: Equipamento em manutenção', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-012', 'MOTOR_RKL_012', 'N12', '', 'Equipamento fora da tabela de rota: blá', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-013', 'MOTOR_RKL_013', 'N13', '', 'Equipamento em condições normais de operação', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-014', 'MOTOR_RKL_014', 'N14', '', 'Equipamento fora da tabela de rota: Normal', '', '', 'RKL-446V260301.pdf'),
    L('7501-RKL-LAM-015', 'MOTOR_RKL_015', 'N15', '', 'Condição normal', '', '', 'RKL-446V260301.pdf'),
    // histórico da rota nas informações complementares
    L('7501-RKL-LAM-020', 'BOMBA_RKL_020', 'N20', '12/03/2026', 'Rolamento com ruído', 'Alerta',
      'Histórico: jan/26 = 3 (Alerta); fev/26 = 1 (Normal); dez/25 = X (Não previsto); nov/25 = 5 (xyz); jul/27 = 4 (Alarme)', 'RKL-446V260301.pdf'),
    // duplicada (mesma assinatura) e revisão do mesmo relatório
    L('7501-RKL-LAM-001', 'MOTOR_RKL_001', 'N01', '10/03/2026', 'Desbalanceamento', 'Alarme', '', 'RKL-446V260301.pdf'),
    L('VS01-AFR-CCM-030', 'VENT_AFR_030', 'N30', '05/02/2026', 'Temperatura elevada 85 °C', 'Alerta', '', 'AFR-446T260201.pdf'),
    L('VS01-AFR-CCM-030', 'VENT_AFR_030', 'N31', '05/02/2026', 'Temperatura elevada 85 °C corrigido', 'Alerta', '', 'AFR-446T260201 rev1.pdf'),
    L('', 'BOMBA 3', 'N40', '2026-01-15', 'Desalinhamento', 'Pré-alerta', '', 'VMN-446M260101.pdf', '01/12/2025'),
    L('VM52-ITM1-BR-040', 'BOMBA 3', 'N41', '2026-01-15', 'Desalinhamento', 'Pré-alerta', '', 'VMN-446M260101.pdf'),
    L('7602-TL-01', 'CV_TREFILA_01', 'N50', '20/12/2025', 'Sem anomalia', '', '', 'Relatorio 20.12.2025.pdf'),
  ];
  const b = [CAB,
    L('7501-RKL-LAM-001', 'MOTOR_RKL_001', 'N60', '08/02/2026', 'Desbalanceamento leve', 'Alerta', '', 'RKL-446V260201.pdf'),
    L('7501-RKL-LAM-001', 'MOTOR_RKL_001', 'N61', '08/01/2026', 'Normal', '', '', 'RKL-446V260101.pdf'),
  ];
  const subst = [['Arquivo substituído', 'Substituído por'], ['RKL-446V260101.pdf', 'RKL-446V260101 rev.pdf']];
  return [
    { nome: 'Relatorios_extraidos_2026-03-20_1000.xlsx', rows: a, modificado: '2026-03-20T10:00:00Z' },
    { nome: 'Relatorios_extraidos_2026-02-20_1000.xlsx › Dados', rows: b, modificado: '2026-02-20T10:00:00Z' },
    { nome: 'Relatorios_extraidos_2026-02-20_1000.xlsx › Substituições', rows: subst, modificado: '2026-02-20T10:00:00Z' },
  ];
}

const motorPath = resolve(opt('--motor') || join(RAIZ, 'motor', 'motor.js'));

if (args.includes('--dump')) {
  const E = require(motorPath);
  const M = E.construir(fontes(), null);
  writeFileSync(opt('--dump'), JSON.stringify({ equipamentos: M.equipamentos, eventos: M.eventos, stats: M.stats }, null, 1));
  console.log('gravado', opt('--dump'), M.equipamentos.length, 'equipamentos', M.eventos.length, 'eventos');
  process.exit(0);
}

// ---------------- 1. código da planilha de controle (cod) ----------------
const E = require(motorPath);
const M = E.construir(fontes(), null);
const porNota = (n) => { const e = M.eventos.filter((x) => x.nota === n); assert.equal(e.length, 1, 'nota ' + n); return e[0]; };
const casos = [
  // N04: "Normal" sozinho (sem criticidade) já era "Sem classificação" no motor antigo; a regra não mudou
  ['N01', '4'], ['N02', '2'], ['N03', '3'], ['N04', ''], ['N14', '1'], ['N15', '1'], ['N05', '8'], ['N06', 'R'], ['N07', 'X'],
  ['N08', ''], ['N09', ''], ['N10', ''], ['N11', '5'], ['N12', ''], ['N13', '1'], ['N20', '3'],
];
for (const [n, c] of casos) assert.equal(porNota(n).cod, c, 'cod de ' + n);
assert.match(porNota('N08').stDet, /motivo não informado/);
assert.equal(porNota('N08').st, 'NI');
assert.equal(porNota('N09').st, 'NC');
for (const e of M.eventos) {
  assert.equal(typeof e.cod, 'string');
  assert.ok(e.cod in E.CODIGOS, 'cod desconhecido ' + e.cod);
}
// eventos do histórico da rota levam o código do texto (ou do número quando o texto não diz nada)
const bomba = M.equipamentos.find((q) => q.nome === 'BOMBA_RKL_020');
const hist = Object.fromEntries(bomba.ev.filter((e) => e.fonte === 'historico').map((e) => [e.data.slice(0, 7), e.cod]));
assert.deepEqual(hist, { '2026-01': '3', '2026-02': '1', '2025-12': 'X', '2025-11': '5' });

// ---------------- 2. contagens iguais às do motor antigo (index.html antes da extração) ----------------
assert.equal(M.equipamentos.length, 19);
assert.equal(M.eventos.length, 25);
assert.deepEqual({ ...M.stats, arquivos: undefined }, { linhas: 24, duplicadas: 1, semData: 0, substituidas: 2, arquivos: undefined });

// ---------------- 3. tabela de códigos igual a CONDICOES do VibDocs ----------------
assert.deepEqual(Object.keys(E.CODIGOS).sort(), ['', '1', '10', '11', '12', '13', '2', '3', '4', '5', '6', '7', '8', '9', 'R', 'X'].sort());
assert.deepEqual(E.CODIGOS['2'], { nome: 'Pré-alerta', cor: '#ffff00', texto: '#000' });
assert.deepEqual(E.CODIGOS[''], { nome: 'Sem classificação', cor: '#d9d9d9', texto: '#000' });

// ---------------- 4. index.html: scripts rodando como na página ----------------
const html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const motorTag = scripts.filter((m) => /id="motor"/.test(m[1]));
assert.equal(motorTag.length, 1, 'um <script id="motor">');
assert.equal(scripts.indexOf(motorTag[0]), 2, 'motor é o terceiro script');
const ctx = vm.createContext({ console });
ctx.window = ctx;
vm.runInContext(scripts[1][2], ctx, { filename: 'xlsx (index.html)' });
vm.runInContext(motorTag[0][2], ctx, { filename: 'motor (index.html)' });
assert.ok(ctx.Engine && ctx.XLSX, 'Engine e XLSX carregados');
assert.match(ctx.Engine.VERSAO, /^[0-9a-f]{10}$/, 'VERSAO preenchida pelo embutir-motor.py');
const corpo = readFileSync(join(RAIZ, 'motor', 'motor.js'), 'utf8');
assert.equal(motorTag[0][2].replace(/var VERSAO = '[0-9a-f]*';/, "var VERSAO = '';").trim(), corpo.trim(), 'index.html tem o motor/motor.js atual (rodar embutir-motor.py)');
const r = vm.runInContext(`(function () {
  var cab = ${JSON.stringify(CAB)};
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab,
    ['7501-RKL-LAM-001', 'MOTOR_RKL_001', 'N1', new Date(Date.UTC(2026, 2, 10, 12)), '', 'Desbalanceamento', '', 'Alarme', '', 'RKL-446V260301.pdf', '']]), 'Dados');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Outra coisa'], ['x']]), 'Notas');
  var buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  var linhas = Engine.lerPlanilha(XLSX, buf, 'teste.xlsx');
  var abas = Engine.lerAbas(XLSX, buf);
  var M = Engine.construir(linhas, null);
  return JSON.stringify({ nomes: linhas.map(function (l) { return l.nome; }), abas: Object.keys(abas), n: M.eventos.length, cod: M.eventos[0].cod, data: M.eventos[0].data });
})()`, ctx);
assert.deepEqual(JSON.parse(r), { nomes: ['teste.xlsx › Dados'], abas: ['Dados', 'Notas'], n: 1, cod: '4', data: '2026-03-10' });
// o quarto script usa as funções do motor, não cópias locais
const app = scripts[3][2];
assert.ok(!/function lerPlanilha|function lerAbas/.test(app), 'lerPlanilha/lerAbas saíram do quarto script');
assert.ok(!/(^|[^.\w])ler(Planilha|Abas)\(/m.test(app), 'chamadas usam E.lerPlanilha/E.lerAbas');
assert.ok(/E\.lerPlanilha\(XLSX, /.test(app) && /E\.lerAbas\(XLSX, /.test(app));

console.log('ok: motor', E.VERSAO === '' ? '(arquivo)' : E.VERSAO, '| index.html', ctx.Engine.VERSAO, '|', M.equipamentos.length, 'equipamentos,', M.eventos.length, 'eventos');
