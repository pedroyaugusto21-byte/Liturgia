/* ======================================================================
   MANSÕES LUNARES
   As 28 mansões da Lua (tradição árabe / Picatrix). Cada mansão ocupa 360°/28 ≈ 12°51′26″
   do zodíaco, contadas a partir de 0° de Áries; a mansão da vez é a que contém a longitude da Lua.
   Dados e cálculo vêm do app "Mansões Lunares" (mansoes.js), aqui isolados em um módulo próprio:
   nada vaza para o escopo global além de window.MansoesLunares.
   Usado por duas abas:
     · Lunar        → #lunarMansoes   (lunar.js chama MansoesLunares.setLunar a cada redesenho)
     · Mapa Astral  → #astralMansoes  (ouranos.js chama MansoesLunares.setAstral a cada mapa novo)
   Lua: série truncada de Meeus (cap. 47), erro de alguns minutos de arco — suficiente para
   decidir a mansão; só muito perto da fronteira entre duas mansões o horário pode variar em minutos.
   ====================================================================== */
(function () {
  'use strict';
  var SEG = 360 / 28;
  var SYMF = '\uFE0E';
  var SIGNS = ["Áries","Touro","Gêmeos","Câncer","Leão","Virgem","Libra","Escorpião","Sagitário","Capricórnio","Aquário","Peixes"];
  var GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];

  // [árabe, nome árabe, nome no Picatrix, epíteto, favorece[], desfavorece[], texto, anjo]
  var M = [
    ["الشرطين","Al Sharatain","Alnath","Os Dois Sinais",["Negócios"],[],"Os árabes viam aqui forças em conflito, tanto naturais, como redemoinhos, quanto do dia a dia, como discussões.","Geniel"],
    ["البطين","Al Butani","Albotain","O Ventre",["Comércio","Descoberta de tesouros"],["Viagens por mar"],"Marca o temperamento imprudente de quem se arrisca no que é diferente, sem medir as consequências.","Enediel"],
    ["الثريا","Al Thuraya","Azoraya","O Enxame",["Ciências","Quem vive ao ar livre","Trabalho"],["Casamento","Viagens por água"],"Perfil trabalhador e prático, inclinado às ciências, à economia e à contabilidade.","Amixiel"],
    ["الدبران","Al Debaran","Aldebaran","O Olho de Deus",["Trabalho","Manufatura","Pequeno comércio"],["Imóveis","Construção","Minas"],"Paixões irresistíveis sob uma aparência de boa índole. Pode haver discórdia no lar.","Azariel"],
    ["الهقعة","Al Hakah","Almices","A Mancha Branca",["Vida privada","Estudos","Segunda metade das viagens"],["Empreendimentos coletivos","Obras humanitárias"],"Favorece o estudo e as artes na vida reservada, mais que a exposição pública. Boa para amizades e casamento.","Gabiel"],
    ["الهنعة","Al Hanach","Athaya","A Cicatriz",["Vida social"],["Trabalho agrícola","Trabalho pesado"],"Indica convalescenças lentas e possíveis perdas financeiras ao longo da vida, mas guarda a boa vontade dos outros.","Dirachiel"],
    ["الذراع","Al Dhira","Aldirah","A Semente ou o Galho",["Amor","Amizades","Ganhos","Cura"],["Leis e justiça"],"Amor pela casa e pela família e necessidade de amigos por perto. Pessoa amável, que se contenta com pouco.","Scheliel"],
    ["النثرة","Al Nathrah","Annathra","O Berçário",["Amor e amizade nascidos em viagens"],[],"Forte apego à família e amor pelas crianças, até as dos outros.","Amnediel"],
    ["الطرف","Al Tarf","Atarf","O Olhar",["Casamento (para homens)","Força de personalidade"],["Casamento e felicidade (para mulheres)"],"As fontes divergem. Uma descreve alguém afável e benevolente; outra, mulheres desanimadas e homens de personalidade forte.","Barbiel"],
    ["الجبهة","Al Jabbah","Algebha","A Testa",["Estudos","Ganhos","Amor","Profissão","Defesa contra inimigos"],[],"Sensibilidade aos sentimentos alheios e vida social farta. O risco é o excesso de orgulho e de medicamentos ou drogas.","Ardesiel"],
    ["الزبرة","Al Zubrah","Azobra","A Juba do Leão",["Comércio","Riqueza","Casamento","Viagens"],["Saúde das mulheres"],"A riqueza costuma vir mais pelo esforço de outra pessoa que pelo próprio.","Neciel"],
    ["الصرفة","Al Sarfah","Acarfa","O Mudador do Tempo",["Colheitas","Envio de mensagens","Empregados"],["Marinheiros"],"Só se avança servindo aos outros. Pode-se chegar ao topo, desde que com dedicação ao serviço.","Abdizuel"],
    ["العواء","Al Awwa","Alahue","O Latidor",["Viagens"],[],"Exterior rude que esconde um coração bondoso, com bom discernimento.","Jazeriel"],
    ["السماك","Al Simac","Azimech","O Desarmado",["Marinheiros"],["Viagens por água","Primeiros anos de casamento"],"Pessoa prudente e analítica, interessada em estudos divinatórios. Os atritos do casamento tendem a passar.","Ergediel"],
    ["الغفر","Al Ghair","Argafra","A Tampa",["Descobrir tramas hostis","Buscar tesouros"],["Família e outras relações","Viagens"],"Considerada desfavorável a quase tudo. Só serve a quem quer descobrir planos hostis ou procurar tesouros.","Ataliel"],
    ["الزبانا","Al Jubana","Azubene","As Garras",["Criação de gado","Compra e venda de gado","Especulação"],["Negócios","Casamento","Viagens"],"Quem a tem protege-se pela observação e pelo bom julgamento. A reputação pode sofrer com invejosos.","Azeruel"],
    ["الإكليل","Iktil Al Jabhah","Alichil","A Cúpula da Cabeça",["Casamento","Posição de responsabilidade","Marinheiros"],[],"Permite um bom casamento e um cargo de responsabilidade. Temperamento forte, mas honrado pelos outros.","Adriel"],
    ["القلب","Al Kalb","Alcalb","O Coração",["Expor inimigos","Tempos de guerra"],["Quase todo o resto","Família"],"Favorável ao conflito. A tradição a associa a riscos para a mãe e a laços familiares.","Egibiel"],
    ["الشولة","Al Shaulah","Exaula","O Ferrão",["Caça","Ideias pessoais"],["Comércio","Residência fixa"],"Não favorece uma carreira tranquila nem o apego a um só lugar.","Amutiel"],
    ["النعائم","Al Ras Al Thuban","Nahaym","A Cabeça do Dragão",["Amor","Sucesso pelo próprio mérito","Favor de mulheres","Ligação livre"],["Casamento","Mudança involuntária de residência"],"O parceiro costuma ser útil nos negócios, mas busca autoridade em casa. Mais adequada a uma ligação livre que ao casamento.","Kyriel"],
    ["البلدة","Al Baldah","Elbelda","A Cidade ou o Distrito",["Cura após doença","Viagens","Ganhos"],[],"Pessoa imprudente, suscetível e volúvel. Acelera a recuperação depois de doenças.","Bethnael"],
    ["سعد الذابح","Al Sad Al Dhabih","Caadaldeba","O Assassino Afortunado",["Poder pessoal"],["Casamento","Empréstimos de dinheiro"],"Dá desejo de poder pessoal e a capacidade de escapar das consequências dos próprios atos.","Geliel"],
    ["سعد بلع","Al Sad Al Bulah","Caaddebolach","O Aviador Afortunado",["Médicos","Soldados","Políticos"],["Casamento","Filhos","Contratos"],"Favorece quem lida com saúde, armas e poder. Traz dificuldades conjugais.","Requiel"],
    ["سعد السعود","Al Sa’d Al Su’d","Caadacohot","O Mais Infeliz dos Infelizes",[],["Administrar país ou cidade","Carreiras de alto cargo"],"A tradição vê uma carreira agitada e, no fim, infeliz. Quanto mais alta a posição, mais difícil.","Abrinael"],
    ["سعد الأخبية","Al Sad Al Ahbiyah","Caadalhacbia","A Estrela das Masmorras",["Efeito de remédios"],["Negócios com mulheres","Gravidez"],"No Picatrix, retrata alguém humilde, modesto e temente a Deus, com dificuldades na família e sucesso no exterior.","Aziel"],
    ["الفرغ المقدم","Al Fargh Al Mukdim","Almiquedam","O Orifício Superior do Cântaro",["Casamento","Agricultura","Compra e venda"],["Viagens oceânicas"],"Pode indicar cobiça e desavenças com irmãos.","Tagriel"],
    ["الفرغ المؤخر","Al Fargh Al Thani","Algarf almuehar","O Orifício Inferior do Cântaro",["Casamento","Cargos de responsabilidade"],["Viagens","Imóveis"],"Traz gosto por cavalos, ar livre e festas, mas azar com dinheiro.","Alheniel"],
    ["بطن الحوت","Al Batn Al Hut","Arrexhe","O Ventre do Peixe",["Casamento","Negócios"],["Pessoas doentes","Viagens por mar"],"Pode indicar pobreza e saúde frágil. Às vezes ajuda no momento de perigo.","Amnixiel"]
  ];

  /* ---------- astronomia ---------- */
  function rad(d) { return d * Math.PI / 180; }
  function norm(d) { d = d % 360; return d < 0 ? d + 360 : d; }
  function T(date) { return (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525; }
  function moonLon(date) {
    var t = T(date);
    var L = 218.3164477 + 481267.88123421 * t;
    var D = rad(297.8501921 + 445267.1114034 * t);
    var Ms = rad(357.5291092 + 35999.0502909 * t);
    var Mm = rad(134.9633964 + 477198.8675055 * t);
    var F = rad(93.2720950 + 483202.0175233 * t);
    var s = 6.288774 * Math.sin(Mm) + 1.274027 * Math.sin(2 * D - Mm) + 0.658314 * Math.sin(2 * D)
      + 0.213618 * Math.sin(2 * Mm) - 0.185116 * Math.sin(Ms) - 0.114332 * Math.sin(2 * F)
      + 0.058793 * Math.sin(2 * D - 2 * Mm) + 0.057066 * Math.sin(2 * D - Ms - Mm)
      + 0.053322 * Math.sin(2 * D + Mm) + 0.045758 * Math.sin(2 * D - Ms)
      - 0.040923 * Math.sin(Ms - Mm) - 0.034720 * Math.sin(D) - 0.030383 * Math.sin(Ms + Mm)
      + 0.015327 * Math.sin(2 * D - 2 * F) - 0.012528 * Math.sin(Mm + 2 * F)
      + 0.010980 * Math.sin(Mm - 2 * F) + 0.010675 * Math.sin(4 * D - Mm)
      + 0.010034 * Math.sin(3 * Mm) + 0.008548 * Math.sin(4 * D - 2 * Mm)
      - 0.007888 * Math.sin(2 * D + Ms - Mm) - 0.006766 * Math.sin(2 * D + Ms)
      - 0.005163 * Math.sin(D - Mm) + 0.004987 * Math.sin(D + Ms)
      + 0.004036 * Math.sin(2 * D - Ms + Mm) + 0.003994 * Math.sin(2 * D + 2 * Mm)
      + 0.003861 * Math.sin(4 * D) + 0.003665 * Math.sin(2 * D - 3 * Mm);
    return norm(L + s);
  }
  function mansionAt(ms) { return Math.floor(moonLon(new Date(ms)) / SEG) % 28; }

  /* instante (ms) em que a Lua sai da mansão `from`, para frente (dir = 1) ou para trás (dir = -1) */
  function boundary(ms, from, dir) {
    var step = 10 * 60000 * dir, t = ms, i;
    for (i = 0; i < 500; i++) {
      var n = t + step;
      if (mansionAt(n) !== from) {
        var a = t, b = n, k;
        for (k = 0; k < 24; k++) {
          var m = (a + b) / 2;
          if (mansionAt(m) === from) a = m; else b = m;
        }
        return (a + b) / 2;
      }
      t = n;
    }
    return null;
  }

  /* início e fim da mansão `idx` que contém `ms`; guarda o último resultado (o mapa redesenha a cada segundo) */
  var bcache = null;
  function bounds(ms, idx) {
    if (bcache && bcache.idx === idx && bcache.s !== null && bcache.e !== null && ms >= bcache.s && ms < bcache.e) return bcache;
    bcache = { idx: idx, s: boundary(ms, idx, -1), e: boundary(ms, idx, 1) };
    return bcache;
  }

  /* ---------- formatação ---------- */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function zPos(lon) {
    lon = norm(lon);
    var s = Math.floor(lon / 30) % 12, d = lon - s * 30, deg = Math.floor(d), min = Math.floor((d - deg) * 60);
    return deg + '°' + pad(min) + '′ ' + GLYPHS[s] + SYMF + ' ' + SIGNS[s];
  }
  function dayTxt(ms) {
    var d = new Date(ms), now = new Date();
    var o = { day: '2-digit', month: '2-digit' };
    if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric';
    return d.toLocaleDateString('pt-BR', o);
  }
  function timeTxt(ms) { return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function stampTxt(ms) { return dayTxt(ms) + ' ' + timeTxt(ms); }

  function tags(list, cls) {
    if (!list.length) return '<span class="mans-none">—</span>';
    return list.map(function (t) { return '<span class="mans-tag ' + cls + '">' + esc(t) + '</span>'; }).join('');
  }
  function rowsHtml(m) {
    return '<div class="mans-rows">' +
      '<div><b>Favorece</b><span>' + tags(m[4], 'ok') + '</span></div>' +
      '<div><b>Desfavorece</b><span>' + tags(m[5], 'no') + '</span></div>' +
      '<div><b>Anjo regente</b><span>' + esc(m[7]) + '</span></div></div>';
  }

  /* ---------- cálculo para um instante ---------- */
  function at(date, lonShown) {
    var ms = date.getTime(), own = moonLon(date), idx = Math.floor(own / SEG) % 28;
    var b = bounds(ms, idx);
    return {
      idx: idx, m: M[idx], ms: ms,
      lon: lonShown == null ? own : lonShown,
      progress: Math.max(0, Math.min(1, (own - idx * SEG) / SEG)),
      start: b.s, end: b.e
    };
  }

  /* ---------- HTML ---------- */
  function nowHtml(r, label) {
    var m = r.m, pc = Math.round(r.progress * 100);
    var range = (r.start !== null && r.end !== null)
      ? '<div class="mans-meta">Do início ' + esc(stampTxt(r.start)) + ' ao fim ' + esc(stampTxt(r.end)) + '</div>' : '';
    return '<article class="mans-now" aria-label="' + esc(label) + '">' +
      '<div class="mans-kicker">' + esc(label) + '</div>' +
      '<div class="mans-head"><span class="mans-num" aria-hidden="true">' + (r.idx + 1) + '</span>' +
        '<div><h3>Mansão ' + (r.idx + 1) + ' · ' + esc(m[1]) + '</h3>' +
        '<span class="mans-ar" lang="ar" dir="rtl">' + esc(m[0]) + '</span></div></div>' +
      '<p class="mans-epi">' + esc(m[3]) + ' <span class="mans-pic">· no Picatrix: ' + esc(m[2]) + '</span></p>' +
      '<div class="mans-bar" role="img" aria-label="A Lua percorreu ' + pc + '% desta mansão"><i style="width:' + pc + '%"></i></div>' +
      '<div class="mans-meta">☽' + SYMF + ' Lua em ' + esc(zPos(r.lon)) + ' · ' + pc + '% da mansão</div>' +
      range +
      '<p class="mans-text">' + esc(m[6]) + '</p>' +
      rowsHtml(m) + '</article>';
  }
  function listHtml(cur) {
    var out = '<ol class="mans-ol">', i;
    for (i = 0; i < 28; i++) {
      var m = M[i], on = i === cur;
      out += '<li><details class="mans-item' + (on ? ' cur' : '') + '"' + (on ? ' aria-current="true"' : '') + '>' +
        '<summary><span class="n">' + (i + 1) + '</span><span class="nm">' + esc(m[1]) + (on ? ' <em>· agora</em>' : '') + '</span>' +
        '<span class="ep">' + esc(m[3]) + '</span><span class="pos">a partir de ' + esc(zPos(i * SEG)) + '</span></summary>' +
        '<div class="mans-body"><span class="mans-ar" lang="ar" dir="rtl">' + esc(m[0]) + '</span>' +
        '<p class="mans-pic">No Picatrix: ' + esc(m[2]) + '</p><p class="mans-text">' + esc(m[6]) + '</p>' + rowsHtml(m) + '</div>' +
        '</details></li>';
    }
    return out + '</ol>';
  }

  /* ---------- montagem nos contêineres ---------- */
  function hostOf(id) {
    var sec = document.getElementById(id);
    if (!sec) return null;
    var h = sec.querySelector('.mans-host');
    if (!h) return null;
    if (!h._m) {
      h.innerHTML = '<div class="mans-now-h"></div>' +
        '<details class="mans-all"><summary>As 28 mansões</summary><div class="mans-list-h"></div></details>';
      h._m = { now: h.querySelector('.mans-now-h'), list: h.querySelector('.mans-list-h'), nowHtml: '', idx: -1 };
    }
    return h._m;
  }
  function paint(id, r, label) {
    var h = hostOf(id);
    if (!h) return;
    var html = nowHtml(r, label);
    if (html !== h.nowHtml) { h.nowHtml = html; h.now.innerHTML = html; }
    if (h.idx !== r.idx) { h.idx = r.idx; h.list.innerHTML = listHtml(r.idx); }
  }

  /* aba Lunar: `live` = dia de hoje sem passar o mouse em outro dia */
  var lunarKey = '';
  function setLunar(date, live) {
    var key = (live ? 'L' : 'D') + Math.floor(date.getTime() / (live ? 60000 : 3600000));
    if (key === lunarKey) return;
    lunarKey = key;
    var r = at(date);
    paint('lunarMansoes', r, live ? 'Mansão da Lua agora' : 'Mansão da Lua em ' + dayTxt(date.getTime()) + ' · ao meio-dia');
  }
  /* aba Urano · Mapa Astral: `lon` = longitude da Lua que o mapa está mostrando */
  function setAstral(date, lon) {
    var r = at(date, lon);
    paint('astralMansoes', r, 'Mansão da Lua neste mapa · ' + stampTxt(date.getTime()));
  }

  window.MansoesLunares = {
    data: M,
    at: at,
    setLunar: setLunar,
    setAstral: setAstral,
    refresh: function () { lunarKey = ''; }
  };
})();
