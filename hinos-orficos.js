/* ======================================================================
   HINOS ÓRFICOS — dados do Hinário (aba Teúrgica)
   Formato definitivo: [{ n, deus, incenso, texto }, …]
   ATENÇÃO: os itens abaixo são EXEMPLOS FICTÍCIOS, só para exercitar a
   interface. Não são trechos de nenhuma tradução. A etapa 2b troca o
   conteúdo (mesmo formato; `texto` pode ter várias linhas separadas por \n).
   ====================================================================== */
const HINOS_ORFICOS = [
  {
    n: 1,
    deus: '[exemplo] Deus A',
    incenso: '[exemplo] resina fictícia',
    texto: 'Texto de exemplo, inventado só para testar a interface.\nSegundo verso de exemplo, sem relação com nenhum hino real.'
  },
  {
    n: 2,
    deus: '[exemplo] Deusa B',
    incenso: '[exemplo] ervas fictícias',
    texto: 'Outro texto de exemplo.\nLinha com <tags> & "aspas" para conferir o escape.\n\nTerceira estrofe fictícia, após uma linha em branco.'
  },
  {
    n: 3,
    deus: '[exemplo] Daimon C',
    incenso: '',
    texto: 'Exemplo sem incenso definido: a interface deve omitir a linha "Incenso".'
  }
];
