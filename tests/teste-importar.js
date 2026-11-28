/* Teste da ETAPA D (Importar backup — lógica). Node puro:  node tests/teste-importar.js
   Cobre: validação do formato, prévia (sem gravar), mesclar (regra do salvoEm), substituir,
   idempotência, ida e volta com exportAll, higiene dos registros, aviso às telas e
   PARIDADE de validação com nuvem.js. A tela é testada em tests/teste-importar-e2e.js. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { carregar } = require('./_ambiente');
const RAIZ = path.join(__dirname, '..');
process.env.TZ = 'America/Bahia';
const R = [];
const ok = (n, c, d) => R.push((c ? 'OK      ' : 'FALHOU  ') + n + (!c && d !== undefined ? '  [' + JSON.stringify(d) + ']' : ''));
const memoria = () => { const m = {}; return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
const lerFonte = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

const T1 = '2026-11-01T10:00:00.000Z', T2 = '2026-11-02T10:00:00.000Z', T3 = '2026-11-03T10:00:00.000Z';
const dia = (data, texto, salvoEm, extra) => Object.assign({ data, id: 'd' + data, texto, clima: { amanhecer: ['sol'], entardecer: [], noite: [] }, photagogia: false, criadoEm: T1, salvoEm }, extra || {});
const festa = (id, data, nome) => ({ id, data, nome, descricao: '', criadoEm: 1700000000000 });
const log = (data, salvoEm, extra) => Object.assign({ data, salvoEm, hora: '07:30:00', horas: 7.5, acao: 'criou' }, extra || {});
const arquivo = (stores, extra) => JSON.stringify(Object.assign({ app: 'calendarium', versao: 1, exportadoEm: '2026-11-20T12:00:00.000Z', stores: Object.assign({ festas: [], diario: [], diario_log: [] }, stores) }, extra || {}));

async function ambiente() {
  const amb = carregar(['store.js', 'importar.js'], { localStorage: memoria() });
  const eventos = [], mudancas = [];
  amb.ctx.dispatchEvent = (ev) => { eventos.push(ev); return true; };
  const S = amb.ctx.CalendariumStore, I = amb.ctx.CalendariumImportar;
  S.onChange((ev) => mudancas.push(ev));
  await S.ready();
  return { amb, S, I, eventos, mudancas };
}
const tudo = async (S) => ({ diario: await S.getAll('diario'), festas: await S.getAll('festas'), logs: await S.getAll('diario_log') });

(async () => {
  /* ---------- 0. HTML e fonte ---------- */
  {
    const html = lerFonte('index.html'), conta = lerFonte('conta.js'), imp = lerFonte('importar.js');
    const ordem = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    ok('importar.js é carregado depois de store.js e antes de conta.js', ordem.indexOf('importar.js') > ordem.indexOf('store.js') && ordem.indexOf('importar.js') < ordem.indexOf('conta.js'), ordem);
    ok('conta.js: botão "Importar backup" ao lado de "Baixar backup", arquivo só .json', /id="teuContaBackup">Baixar backup<\/button>' \+\s*'<button type="button" class="teu-btn teu-btn-disc" id="teuContaImportar">Importar backup</.test(conta) && /id="teuContaArquivo" accept="application\/json,\.json" hidden/.test(conta));
    ok('conta.js: escolha mesclar/substituir é um fieldset com legend e dois radios (Mesclar marcado)', /<fieldset[^>]*id="teuContaImpModo">'\s*\+\s*'<legend>Como importar<\/legend>/.test(conta) && /value="mesclar" checked/.test(conta) && /value="substituir"/.test(conta));
    ok('conta.js: bloco de importação é role=group, rotulado, com título focável (tabindex -1)', /id="teuContaImpBloco" role="group" aria-labelledby="teuContaImpH" hidden/.test(conta) && /id="teuContaImpH" tabindex="-1"/.test(conta));
    const innerHTMLs = (conta.match(/innerHTML\s*=/g) || []).length;
    ok('conta.js: o único innerHTML continua sendo o HTML estático do cartão (dados do arquivo só via textContent)', innerHTMLs === 1 && /sec\.innerHTML = HTML/.test(conta), innerHTMLs);
    ok('importar.js não usa innerHTML/eval/Function/document', !/innerHTML|eval\(|new Function|document\./.test(imp));
    ok('o CSS novo dá foco visível a rádios e botões e não cria animação', /teu-conta-radio input:focus-visible \{ outline/.test(lerFonte('teurgica.css')) && !/teu-conta-(lista|modo|radio)[^}]*(transition|animation)/.test(lerFonte('teurgica.css')));
  }

  /* ---------- 1. paridade de validação com nuvem.js ---------- */
  {
    const fonteNuvem = lerFonte('nuvem.js'), marca = 'window.CalendariumNuvem = api;';
    ok('nuvem.js ainda tem a linha usada para extrair os validadores', fonteNuvem.split(marca).length === 2);
    const amb = carregar([], {});
    amb.ctx.window.localStorage = memoria(); amb.ctx.FIREBASE_CONFIG = undefined;
    vm.runInContext(fonteNuvem.replace(marca, marca + ' window.__v = { limparDiario, limparLog, limparFesta };'), amb.ctx, { filename: 'nuvem.js' });
    const V = amb.ctx.__v;
    const mesmo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const longo = (n) => 'x'.repeat(n);
    const diarios = [dia('2026-11-05', 'ok', T1), dia('2026-02-30', 'data impossível', T1), dia('0050-01-01', 'ano < 100', T1), dia('2026-11-05', longo(10000), T1), dia('2026-11-05', longo(10001), T1),
      dia('2026-11-05', 'clima sujo', T1, { clima: { amanhecer: ['a', '', 7, longo(21), 'b'.repeat(20)], entardecer: 'x', noite: Array(15).fill('z') } }), dia('2026-11-05', 'sem clima', T1, { clima: undefined }),
      dia('2026-11-05', 't', T1, { photagogia: 'true' }), dia('2026-11-05', 't', T1, { salvoEm: longo(41) }), dia('2026-11-05', 't', T1, { id: longo(65) }), dia('2026-11-05', 't', T1, { evil: '<img onerror=x>' }),
      { data: '2026-11-05' }, { texto: 'sem data' }, null, 'texto', [], dia('2026-11-05', 5, T1)];
    const casosDiario = diarios.map((d) => ({ d, a: d && typeof d === 'object' && !Array.isArray(d) ? V.limparDiario(d, d.data) : null }));
    let todosIguais = true, detalhe = null;
    for (const { d, a } of casosDiario) {
      const outro = carregar(['store.js', 'importar.js'], { localStorage: memoria() }); await outro.ctx.CalendariumStore.ready();
      const an = await outro.ctx.CalendariumImportar.analisar(arquivo({ diario: [d], festas: [festa('f1', '2026-11-01', 'Âncora')] }));
      if (!an.ok) { detalhe = detalhe || { erro: an.erro }; todosIguais = false; continue; }
      await outro.ctx.CalendariumImportar.aplicar(an.plano, 'mesclar');
      const gravado = (await outro.ctx.CalendariumStore.getAll('diario'))[0] || null;
      if (!mesmo(gravado, a)) { todosIguais = false; detalhe = detalhe || { entrada: d, nuvem: a, importar: gravado }; }
    }
    ok('diário: mesmo veredito e mesma forma limpa que a sincronização (' + casosDiario.length + ' casos)', todosIguais, detalhe);
    const festas = [festa('f1', '2026-11-05', 'Natal'), festa('com espaço', '2026-11-05', 'x'), festa('f2', '2026-13-01', 'mês 13'), festa('f3', '2026-11-05', '   '), festa('f4', '2026-11-05', longo(61)), festa('f5', '2026-11-05', '  Dois   espaços  '),
      Object.assign(festa('f6', '2026-11-05', 'desc longa'), { descricao: longo(281) }), Object.assign(festa('f7', '2026-11-05', 'desc ok'), { descricao: longo(280) }), Object.assign(festa('f8', '2026-11-05', 'sem criadoEm'), { criadoEm: 'x' }), festa(longo(65), '2026-11-05', 'id grande'), festa('f9', '2026-11-05', 'extra') ];
    festas[festas.length - 1].evil = 1;
    let festasIguais = true, detF = null;
    for (const f of festas) {
      const a = V.limparFesta(f, f.id);
      const outro = carregar(['store.js', 'importar.js'], { localStorage: memoria() }); await outro.ctx.CalendariumStore.ready();
      const an = await outro.ctx.CalendariumImportar.analisar(arquivo({ festas: [f], diario: [dia('2026-11-05', 'âncora', T1)] }));
      await outro.ctx.CalendariumImportar.aplicar(an.plano, 'mesclar');
      const g = (await outro.ctx.CalendariumStore.getAll('festas'))[0] || null;
      if (!mesmo(g, a)) { festasIguais = false; detF = detF || { entrada: f, nuvem: a, importar: g }; }
    }
    ok('festas: mesmo veredito e mesma forma limpa que a sincronização (' + festas.length + ' casos)', festasIguais, detF);
    const logs = [log('2026-11-05', T1), log('2026-11-05', T1, { acao: 'atualizou' }), log('2026-11-05', T1, { acao: 'apagou' }), log('2026-02-30', T1), log('2026-11-05', ''), log('2026-11-05', T1, { hora: '7:30' }), log('2026-11-05', T1, { horas: -1 }), log('2026-11-05', T1, { horas: 24 }), log('2026-11-05', T1, { horas: 24.1 }), log('2026-11-05', T1, { horas: '7' }), log('2026-11-05', T1, { salvoEm: longo(41) }), log('2026-11-05', T1, { nuvemId: 'abc_1', seq: 9, evil: 1 })];
    let logsIguais = true, detL = null;
    for (const l of logs) {
      const a = V.limparLog(l, l.nuvemId || 'x'); if (a && !l.nuvemId) delete a.nuvemId;
      const outro = carregar(['store.js', 'importar.js'], { localStorage: memoria() }); await outro.ctx.CalendariumStore.ready();
      const an = await outro.ctx.CalendariumImportar.analisar(arquivo({ diario_log: [l], diario: [dia('2026-11-05', 'âncora', T1)] }));
      await outro.ctx.CalendariumImportar.aplicar(an.plano, 'mesclar');
      const g = ((await outro.ctx.CalendariumStore.getAll('diario_log'))[0]) || null; if (g) delete g.seq;
      if (!mesmo(g, a)) { logsIguais = false; detL = detL || { entrada: l, nuvem: a, importar: g }; }
    }
    ok('registros de horário: mesmo veredito e mesma forma limpa que a sincronização (' + logs.length + ' casos)', logsIguais, detL);
  }

  /* ---------- 2. formato do arquivo ---------- */
  {
    const { I, S, eventos, mudancas } = await ambiente();
    const erro = async (t) => { const r = await I.analisar(t); return r.ok ? null : r.erro; };
    ok('vazio', /vazio/.test(await erro('')) && /vazio/.test(await erro('   \n')) && /vazio/.test(await erro(undefined)));
    ok('não é JSON', /JSON válido/.test(await erro('{oi')) && /JSON válido/.test(await erro('<html></html>')));
    ok('JSON de outro app / sem stores / lista', /não parece ser um backup/.test(await erro('{"app":"outro","stores":{}}')) && /não parece/.test(await erro('{"app":"calendarium"}')) && /não parece/.test(await erro('[]')) && /não parece/.test(await erro('null')) && /não parece/.test(await erro('42')));
    ok('versão mais nova que a suportada é recusada com texto claro', /versão mais nova/.test(await erro(arquivo({}, { versao: 2 }))));
    ok('versão inválida (0, negativa, texto) é recusada', /versão deste backup/.test(await erro(arquivo({}, { versao: 0 }))) && /versão deste backup/.test(await erro(arquivo({}, { versao: 'x' }))) && /versão deste backup/.test(await erro(arquivo({}, { versao: -1 }))));
    ok('versão ausente conta como 1 (backups antigos)', (await I.analisar(JSON.stringify({ app: 'calendarium', stores: { diario: [dia('2026-11-05', 't', T1)] } }))).ok === true);
    ok('seção que não é lista → erro que nomeia a seção', /seção "diario"/.test(await erro(arquivo({ diario: { a: 1 } }))) && /seção "festas"/.test(await erro(arquivo({ festas: 'x' }))));
    ok('seção ausente é aceita (backup só com festas)', (await I.analisar(JSON.stringify({ app: 'calendarium', versao: 1, stores: { festas: [festa('f1', '2026-11-05', 'A')] } }))).ok === true);
    ok('lista gigante é recusada antes de validar', /registros demais/.test(await erro(arquivo({ diario_log: new Array(20001).fill(1) }))));
    ok('arquivo acima de 5 MB é recusado', /5 MB/.test(await erro('x'.repeat(5 * 1024 * 1024 + 1))));
    ok('BOM no começo do arquivo é tolerado', (await I.analisar('\uFEFF' + arquivo({ diario: [dia('2026-11-05', 't', T1)] }))).ok === true);
    ok('só registros inválidos → erro dizendo quantos foram ignorados', /Nenhum registro válido.*2 ignorados/.test(await erro(arquivo({ diario: [{ data: 'x' }, null] }))));
    ok('backup sem nada → erro claro', /não tem diário, festas nem registros/.test(await erro(arquivo({}))));
    ok('analisar() nunca grava nem avisa (store e eventos intocados)', (await S.getAll('diario')).length === 0 && mudancas.length === 0 && eventos.length === 0);
    ok('"__proto__" como chave não contamina nada', (await I.analisar('{"app":"calendarium","versao":1,"stores":{"__proto__":{"x":1},"diario":[{"data":"2026-11-05","texto":"a","__proto__":{"p":1}}]}}')).ok === true && ({}).p === undefined && ({}).x === undefined);
  }

  /* ---------- 3. prévia: contagens corretas e sem gravar ---------- */
  {
    const { I, S, mudancas, eventos } = await ambiente();
    await S.put('diario', dia('2026-11-01', 'local novo', T2));
    await S.put('diario', dia('2026-11-02', 'local velho', T1));
    await S.put('diario', dia('2026-11-04', 'só aqui', T1));
    await S.put('diario', dia('2026-11-07', 'empate', T2));
    await S.put('festas', festa('fa', '2026-12-25', 'Natal'));
    await S.put('festas', festa('fz', '2026-12-26', 'Só aqui'));
    await S.add('diario_log', log('2026-11-01', T1, { nuvemId: 'n1' }));
    await S.add('diario_log', log('2026-11-02', T1));
    await S.add('diario_log', log('2026-11-09', T3));
    mudancas.length = 0;
    const lixo = { data: 'x' };
    const a = await I.analisar(arquivo({
      diario: [dia('2026-11-01', 'arquivo velho', T1), dia('2026-11-02', 'arquivo novo', T3), dia('2026-11-03', 'inédito', T1), dia('2026-11-07', 'empate', T2), dia('2026-11-03', 'repetido mais novo', T2), lixo],
      festas: [festa('fa', '2026-12-25', 'Natal (arquivo)'), festa('fb', '2026-12-31', 'Réveillon'), festa('fb', '2026-12-31', 'repetida')],
      diario_log: [log('2026-11-01', T1, { nuvemId: 'n1', seq: 1 }), log('2026-11-02', T1, { seq: 99 }), log('2026-11-08', T1), log('2026-11-08', T1)],
    }));
    const r = a.resumo;
    ok('diário: 5 no arquivo após descartar repetição e lixo → 4 dias', a.ok && r.diario.total === 4, r && r.diario);
    ok('diário: 1 inédito (03), 1 mais recente que o local (02), 2 já aqui (01 mais novo aqui; 07 empate)', r.diario.novos === 1 && r.diario.atualizam === 1 && r.diario.mantidos === 2, r.diario);
    ok('a repetição dentro do arquivo mantém a de salvoEm mais novo (03 = "repetido mais novo")', a.plano.registros.diario.find((d) => d.data === '2026-11-03').texto === 'repetido mais novo');
    ok('festas: 1 já existe (id igual → a daqui fica), 1 nova; repetida descartada', r.festas.total === 2 && r.festas.novos === 1 && r.festas.mantidos === 1, r.festas);
    ok('registros de horário: o do mesmo nuvemId e o de mesma assinatura (seq diferente) contam como já existentes; o novo conta 1 só', r.logs.total === 3 && r.logs.novos === 1 && r.logs.mantidos === 2, r.logs);
    ok('ignorados e repetidos são contados para a prévia', r.invalidos.diario === 1 && r.repetidos.diario === 1 && r.repetidos.festas === 1 && r.repetidos.diario_log === 1, [r.invalidos, r.repetidos]);
    ok('o que SAIRIA no modo substituir: o dia 04, a festa "fz" e o registro de horário de 11-09 (não estão no arquivo)', r.diario.apagariam === 1 && r.festas.apagariam === 1 && r.logs.apagariam === 1, [r.diario, r.festas, r.logs]);
    ok('a prévia não gravou nem avisou nada', mudancas.length === 0 && eventos.length === 0 && (await S.getAll('diario')).length === 4);
  }

  /* ---------- 4. mesclar ---------- */
  {
    const { I, S, mudancas, eventos } = await ambiente();
    await S.put('diario', dia('2026-11-01', 'local novo', T2));
    await S.put('diario', dia('2026-11-02', 'local velho', T1));
    await S.put('diario', dia('2026-11-04', 'só aqui', T1));
    await S.put('diario', dia('2026-11-07', 'empate local', T2));
    await S.put('festas', festa('fa', '2026-12-25', 'Natal daqui'));
    await S.add('diario_log', log('2026-11-01', T1, { nuvemId: 'n1' }));
    await S.add('diario_log', log('2026-11-02', T1));
    const a = await I.analisar(arquivo({
      diario: [dia('2026-11-01', 'arquivo velho', T1), dia('2026-11-02', 'arquivo novo', T3), dia('2026-11-03', 'inédito', T1), dia('2026-11-07', 'empate arquivo', T2)],
      festas: [festa('fa', '2026-12-25', 'Natal arquivo'), festa('fb', '2026-12-31', 'Réveillon')],
      diario_log: [log('2026-11-01', T1, { nuvemId: 'n1', seq: 1 }), log('2026-11-02', T1, { seq: 2 }), log('2026-11-08', T1, { seq: 1 })],
    }));
    mudancas.length = 0; eventos.length = 0;
    const r = await I.aplicar(a.plano, 'mesclar');
    const d = await tudo(S), txt = (data) => (d.diario.find((x) => x.data === data) || {}).texto;
    ok('mesclar ok, sem falhas', r.ok === true && r.falhas === 0, r);
    ok('regra do salvoEm: arquivo mais velho NÃO sobrescreve (01 fica "local novo")', txt('2026-11-01') === 'local novo');
    ok('regra do salvoEm: arquivo mais novo sobrescreve (02 vira "arquivo novo")', txt('2026-11-02') === 'arquivo novo');
    ok('dia só do arquivo entra (03)', txt('2026-11-03') === 'inédito');
    ok('empate de salvoEm: fica o do aparelho (igual à sincronização)', txt('2026-11-07') === 'empate local');
    ok('dia só do aparelho nunca é apagado ao mesclar (04)', txt('2026-11-04') === 'só aqui');
    ok('festa de id existente fica como estava; festa nova entra', d.festas.length === 2 && d.festas.find((f) => f.id === 'fa').nome === 'Natal daqui' && d.festas.find((f) => f.id === 'fb').nome === 'Réveillon');
    ok('registros de horário: união sem duplicar; o seq do arquivo (1) não sobrescreveu o local (colisão evitada)', d.logs.length === 3 && d.logs.filter((l) => l.data === '2026-11-08').length === 1 && d.logs.find((l) => l.data === '2026-11-01').nuvemId === 'n1', d.logs);
    ok('contagens devolvidas batem com o que mudou', r.diario.gravados === 2 && r.diario.mantidos === 2 && r.festas.gravados === 1 && r.festas.mantidos === 1 && r.logs.gravados === 1 && r.logs.mantidos === 2, r);
    ok('cada gravação avisou o store (a fila de sincronização enxerga a importação)', mudancas.length === 4 && mudancas.every((m) => m.op === 'put' || m.op === 'add') && mudancas.filter((m) => m.nome === 'diario').length === 2, mudancas.map((m) => m.nome + ':' + m.op));
    ok('as telas foram avisadas, com origem "importacao", os dias alterados e festas/logs', eventos.length === 1 && eventos[0].type === 'calendarium:nuvem-dados' && eventos[0].detail.origem === 'importacao' && eventos[0].detail.festas === true && eventos[0].detail.logs === true && eventos[0].detail.tudo === false && eventos[0].detail.diario.slice().sort().join() === '2026-11-02,2026-11-03', eventos[0] && eventos[0].detail);
    const r2 = await I.aplicar(a.plano, 'mesclar');
    ok('idempotente: importar o mesmo plano de novo não grava nada', r2.ok && r2.diario.gravados === 0 && r2.festas.gravados === 0 && r2.logs.gravados === 0, r2);
    ok('modo inválido e plano vazio são recusados', (await I.aplicar(a.plano, 'apagar')).ok === false && (await I.aplicar(null, 'mesclar')).ok === false && (await I.aplicar({}, 'mesclar')).ok === false);
    ok('...e os dados do aparelho continuam intactos (5 dias, 3 registros de horário)', (await tudo(S)).diario.length === 5 && (await tudo(S)).logs.length === 3);
  }

  /* ---------- 5. substituir ---------- */
  {
    const { I, S, mudancas, eventos } = await ambiente();
    await S.put('diario', dia('2026-11-01', 'local novo', T3));
    await S.put('diario', dia('2026-11-04', 'só aqui', T1));
    await S.put('festas', festa('fz', '2026-12-26', 'Só aqui'));
    await S.put('festas', festa('fa', '2026-12-25', 'Natal daqui'));
    await S.add('diario_log', log('2026-11-09', T3));
    await S.add('diario_log', log('2026-11-01', T1));
    const a = await I.analisar(arquivo({ diario: [dia('2026-11-01', 'arquivo velho', T1), dia('2026-11-03', 'inédito', T1)], festas: [festa('fa', '2026-12-25', 'Natal arquivo')], diario_log: [log('2026-11-01', T1)] }));
    mudancas.length = 0; eventos.length = 0;
    const r = await I.aplicar(a.plano, 'substituir');
    const d = await tudo(S);
    ok('substituir ok', r.ok === true && r.falhas === 0, r);
    ok('aparelho fica com exatamente os dias do arquivo (01 e 03); 04 apagado', d.diario.map((x) => x.data).join() === '2026-11-01,2026-11-03', d.diario.map((x) => x.data));
    ok('no substituir o arquivo vence mesmo sendo MAIS VELHO (01 = "arquivo velho")', d.diario.find((x) => x.data === '2026-11-01').texto === 'arquivo velho');
    ok('festa fora do arquivo some; a de id igual fica como estava (festas não se editam: só o conjunto de ids é igualado)', d.festas.map((f) => f.id).join() === 'fa', d.festas);
    ok('registros de horário: só o do arquivo sobra (o de 11-09 foi apagado, o de 11-01 não duplicou)', d.logs.length === 1 && d.logs[0].data === '2026-11-01', d.logs);
    ok('contagens: 1 dia gravado (03) + 1 gravado (01 mudou), 1 dia apagado, 1 festa apagada, 1 registro apagado', r.diario.gravados === 2 && r.diario.apagados === 1 && r.festas.apagados === 1 && r.logs.apagados === 1, r);
    ok('apagar também avisa o store (para a nuvem receber as exclusões)', mudancas.some((m) => m.nome === 'diario' && m.op === 'delete' && m.chave === '2026-11-04') && mudancas.some((m) => m.nome === 'festas' && m.op === 'delete' && m.chave === 'fz') && mudancas.some((m) => m.nome === 'diario_log' && m.op === 'delete'), mudancas.map((m) => m.nome + ':' + m.op + ':' + m.chave));
    ok('todas as gravações vêm ANTES da primeira exclusão (falha no meio nunca deixa o aparelho sem dados)', mudancas.findIndex((m) => m.op === 'delete') > Math.max(mudancas.map((m) => m.op).lastIndexOf('put'), mudancas.map((m) => m.op).lastIndexOf('add')), mudancas.map((m) => m.op));
    ok('tela avisada com tudo:true e origem "importacao"', eventos.length === 1 && eventos[0].detail.tudo === true && eventos[0].detail.origem === 'importacao', eventos[0] && eventos[0].detail);
  }
  /* substituir: falha de gravação → nada é apagado */
  {
    const { I, S } = await ambiente();
    await S.put('diario', dia('2026-11-04', 'só aqui', T1));
    const a = await I.analisar(arquivo({ diario: [dia('2026-11-03', 'inédito', T1)] }));
    const putOriginal = S.put; S.put = async () => null;        /* simula armazenamento recusando a gravação */
    const r = await I.aplicar(a.plano, 'substituir');
    S.put = putOriginal;
    ok('se uma gravação falha, o substituir NÃO apaga nada e diz o que houve', r.ok === false && r.falhas >= 1 && /gravada ou apagada/.test(r.erro) && (await S.getAll('diario')).map((x) => x.data).join() === '2026-11-04', r);
  }

  /* ---------- 6. higiene: nada do arquivo entra como veio ---------- */
  {
    const { I, S } = await ambiente();
    const sujo = dia('2026-11-05', '<img src=x onerror=alert(1)> e <script>x</script>', T1, { evil: 'campo extra', clima: { amanhecer: ['a'], entardecer: [], noite: [], extra: ['b'] }, constructor: 'x' });
    const a = await I.analisar(arquivo({ diario: [sujo] }));
    await I.aplicar(a.plano, 'mesclar');
    const g = (await S.getAll('diario'))[0];
    ok('texto com HTML é guardado como texto puro, intacto', g.texto === '<img src=x onerror=alert(1)> e <script>x</script>');
    ok('campos extras do arquivo não são gravados', !Object.prototype.hasOwnProperty.call(g, 'evil') && !Object.prototype.hasOwnProperty.call(g, 'constructor') && Object.keys(g.clima).sort().join() === 'amanhecer,entardecer,noite', g);
    ok('o plano e o gravado são cópias novas (mudar o arquivo lido depois não muda o plano)', a.plano.registros.diario[0] !== sujo);
  }

  /* ---------- 7. ida e volta com o "Baixar backup" ---------- */
  {
    const A = await ambiente();
    await A.S.put('diario', dia('2026-11-01', 'um', T1)); await A.S.put('diario', dia('2026-11-02', 'dois', T2, { photagogia: true }));
    await A.S.put('festas', festa('fa', '2026-12-25', 'Natal')); await A.S.add('diario_log', log('2026-11-01', T1)); await A.S.add('diario_log', log('2026-11-02', T2, { acao: 'atualizou', nuvemId: 'zz' }));
    const exportado = JSON.stringify(await A.S.exportAll());
    const mesmoAparelho = await A.I.analisar(exportado);
    ok('o backup exportado é reconhecido, sem nenhum registro ignorado', mesmoAparelho.ok && mesmoAparelho.resumo.invalidos.diario + mesmoAparelho.resumo.invalidos.festas + mesmoAparelho.resumo.invalidos.diario_log === 0, mesmoAparelho);
    ok('importar o próprio backup no mesmo aparelho: tudo "já aqui", nada novo', mesmoAparelho.resumo.diario.novos === 0 && mesmoAparelho.resumo.diario.atualizam === 0 && mesmoAparelho.resumo.festas.novos === 0 && mesmoAparelho.resumo.logs.novos === 0, mesmoAparelho.resumo);
    const B = await ambiente();                         /* aparelho novo, vazio */
    const an = await B.I.analisar(exportado); const r = await B.I.aplicar(an.plano, 'mesclar');
    const origem = await tudo(A.S), destino = await tudo(B.S);
    const semSeq = (l) => l.map((x) => { const c = Object.assign({}, x); delete c.seq; return c; });
    ok('restaurar em aparelho vazio reproduz diário e festas idênticos', JSON.stringify(destino.diario) === JSON.stringify(origem.diario) && JSON.stringify(destino.festas) === JSON.stringify(origem.festas), [destino.diario, origem.diario]);
    ok('...e os registros de horário (mesmo conteúdo, inclusive nuvemId)', JSON.stringify(semSeq(destino.logs)) === JSON.stringify(semSeq(origem.logs)) && r.ok, destino.logs);
  }

  console.log(R.join('\n'));
  const f = R.filter((l) => l.startsWith('FALHOU')).length;
  console.log('\n' + (f ? f + ' FALHA(S) de ' + R.length : 'TUDO OK — ' + R.length + ' verificações'));
  process.exit(f ? 1 : 0);
})().catch((e) => { console.log(R.join('\n')); console.error('ERRO NO TESTE:', e); process.exit(2); });
