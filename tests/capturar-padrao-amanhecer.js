/* Gera tests/golden/amanhecer-padrao.json: hash do SVG do relógio (Liturgia e Mistérios) SEM localização,
   para uma lista de instantes em dois fusos. Rode contra a versão ANTERIOR do liturgy.js para travar o comportamento:
   node tests/capturar-padrao-amanhecer.js <pasta-do-site> [saida.json] */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { carregar } = require('./_ambiente');
const raiz = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const saida = process.argv[3] || path.join(__dirname, 'golden', 'amanhecer-padrao.json');
const FUSOS = ['America/Bahia', 'Europe/London', 'America/Santiago'];
const INSTANTES = [
  '2026-03-20T05:59:59', '2026-03-20T06:00:00', '2026-03-20T06:00:01', '2026-03-20T12:00:00', '2026-03-20T23:59:59',
  '2026-06-21T05:59:00', '2026-06-21T06:00:00', '2026-09-22T00:00:00', '2026-09-22T18:30:00', '2026-12-21T03:00:00',
  '2026-12-21T06:00:00', '2027-01-01T00:00:00', '2027-01-01T05:59:59', '2026-11-26T04:30:00', '2026-11-26T05:30:00',
  '2026-10-25T00:30:00', '2026-10-25T01:30:00', '2026-03-29T01:30:00', '2026-03-29T06:00:00', '2026-04-04T23:30:00',
  '2026-09-06T00:30:00', '2026-09-06T06:00:00', '2025-02-28T07:00:00', '2028-02-29T05:00:00', '2030-07-15T15:45:10',
];
const h = (t) => crypto.createHash('sha1').update(t).digest('hex');
const out = {};
for (const fuso of FUSOS) {
  process.env.TZ = fuso;
  const amb = carregar(['ouranos-data.js', 'liturgy.js'], { raiz });
  for (const i of INSTANTES) {
    amb.irPara(i);
    out[fuso + '|' + i + '|relogio'] = h(amb.el('clockdiv').innerHTML);
    amb.run('window.mystRender()');
    out[fuso + '|' + i + '|misterios'] = h(amb.el('mystClockdiv').innerHTML);
    out[fuso + '|' + i + '|litDay'] = String(amb.ctx.LiturgyKit.litDay(new Date(i).getTime()));
  }
}
fs.writeFileSync(saida, JSON.stringify(out, null, 1));
console.log('capturas: ' + Object.keys(out).length + ' → ' + saida);
