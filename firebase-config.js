/* Configuração do Firebase do Calendarium (projeto "calendarium-2026").
   ATENÇÃO: estas chaves NÃO são segredo. Elas só dizem ao site qual projeto Firebase usar e vão
   para o navegador de qualquer visitante, como em todo site com Firebase. Quem protege os dados
   são (1) as regras do Firestore (arquivo firestore.rules), (2) a lista de domínios autorizados e
   (3) o cadastro de novas contas fechado, no console do Firebase.
   Para desligar o login e voltar ao modo 100% local, deixe window.FIREBASE_CONFIG = null. */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDhCuRk0Ko1u3ssooiVh9j74FsnxNcUDyI",
  authDomain: "calendarium-2026.firebaseapp.com",
  projectId: "calendarium-2026",
  storageBucket: "calendarium-2026.firebasestorage.app",
  messagingSenderId: "802764434497",
  appId: "1:802764434497:web:a2dd7c154c487b55116ac0"
};
