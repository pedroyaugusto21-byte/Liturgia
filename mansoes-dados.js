/* ======================================================================
   MANSÕES LUNARES — DADOS (somente dados, sem código). Script clássico; define window.MansoesDados.
   Carregar ANTES de mansoes-lunares.js, que calcula e desenha. Se este arquivo faltar, window.MansoesLunares
   não é definido (com um aviso no console) e as telas Lunar e Mapa Astral seguem sem a seção de mansões.

   API: window.MansoesDados = { MANSOES: [ 28 linhas ] }
        Único global novo. Antes, estas linhas eram a variável local "M" dentro de mansoes-lunares.js;
        a API que o resto do app consome (window.MansoesLunares) não mudou.

   FORMATO de cada linha (índice i = 0…27 corresponde à mansão nº i+1; a ORDEM dos campos é contrato,
   mansoes-lunares.js lê por posição):
     [0] árabe         string    nome em escrita árabe
     [1] nomeArabe     string    transliteração (ex.: "Al Sharatain")
     [2] nomePicatrix  string    grafia latinizada usada no Picatrix (ex.: "Alnath")
     [3] epiteto       string    epíteto em pt-BR (ex.: "Os Dois Sinais")
     [4] favorece      string[]  o que a mansão favorece, pt-BR (pode ser lista vazia)
     [5] desfavorece   string[]  o que a mansão desfavorece, pt-BR (pode ser lista vazia)
     [6] texto         string    descrição interpretativa em pt-BR
     [7] anjo          string    anjo regente

   UNIDADES / GEOMETRIA: este arquivo não guarda números. As 28 mansões dividem o zodíaco em partes iguais de
   360°/28 ≈ 12,857° (12°51′26″) de LONGITUDE ECLÍPTICA, em GRAUS, contadas a partir de 0° de Áries (zodíaco
   tropical): a mansão i cobre [i·360/28, (i+1)·360/28). A conversão longitude da Lua → índice é feita em
   mansoes-lunares.js (Lua: série truncada de Meeus, cap. 47).

   FONTE E LICENÇA
     · Tradição: mansões lunares árabes (manāzil al-qamar), com os nomes do Picatrix.
     · Origem imediata do conteúdo: app "Mansões Lunares" (mansoes.js), incorporado a este projeto.
     · Fonte primária dos textos em pt-BR e licença: NÃO estão registradas no repositório.
       PENDENTE (mantenedor): informar a fonte e a licença aqui. Até lá, trate o conteúdo como sem licença declarada.
   ====================================================================== */
window.MansoesDados = {
  MANSOES: [
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
  ]
};
