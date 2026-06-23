require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs/promises');
const path = require('path');

const GITBOOK_URL = process.env.GITBOOK_URL;
const ASKS_DIR = path.join(__dirname, '..', 'asks');

if (!GITBOOK_URL) {
  console.error('GITBOOK_URL não definida no .env');
  process.exit(1);
}

const questions = [
  // === Geral (4) ===
  "Qual é o objetivo principal do estudo de caso?",
  "Qual o papel do desenvolvedor no cenário descrito?",
  "Quais conceitos de segurança são aplicados no estudo de caso?",
  "Quais etapas compõem o estudo de caso?",

  // === Etapa 1: Planejamento (12) ===
  "Quais são os requisitos obrigatórios do sistema de tarefas?",
  "O que significa análise de requisitos no contexto do estudo?",
  "Qual a diferença entre requisitos funcionais e não funcionais?",
  "Quais são exemplos de requisitos funcionais para o sistema?",
  "Quais são exemplos de requisitos não funcionais para o sistema?",
  "Como criar casos de uso para o sistema de tarefas?",
  "O que são fluxos de sistema e como documentá-los?",
  "Quais ameaças de segurança devem ser consideradas no planejamento?",
  "Como mitigar ameaças de segurança no sistema?",
  "Como proteger os dados dos usuários no sistema?",
  "Como evitar ataques de negação de serviço?",
  "O que deve ser registrado nos logs como violação de segurança?",

  // === Etapa 2: Desenvolvimento (5) ===
  "Como configurar o ambiente Python e Flask para o sistema?",
  "Qual repositório base do Task Manager em Flask é utilizado?",
  "Quais dependências são necessárias para rodar o Task Manager?",
  "Como executar a aplicação Flask localmente?",
  "O que deve ser adaptado no código para rodar em container Docker?",

  // === Etapa 3: CI/CD (6) ===
  "O que o pipeline CI/CD deve contemplar?",
  "Quando usar GitHub Actions em vez do GitLab CI?",
  "Como usar Git para controle de versão no pipeline?",
  "O que é compilação ou interpretação automática no CI?",
  "Quais tipos de teste automatizado devem ser executados no CI?",
  "O que é Integração Contínua?",

  // === Etapa 4: SAST (6) ===
  "O que é SAST e para que serve?",
  "Como usar a ferramenta Bandit para análise estática?",
  "Como fazer análise de dependências com Safety ou pip-audit?",
  "O que é OWASP Dependency-Check e como usá-lo?",
  "Como incluir análise estática no pipeline CI/CD?",
  "Como incluir análise de dependências no pipeline CI/CD?",

  // === Etapa 5: DAST (6) ===
  "O que é DAST e para que serve?",
  "Como usar OWASP ZAP para análise dinâmica?",
  "Como configurar o ZAP para fazer varredura automatizada?",
  "Qual comando Docker para iniciar o ZAP?",
  "Como interpretar o relatório gerado pelo ZAP?",
  "O que fazer após corrigir problemas encontrados pelo ZAP?",

  // === Etapa 6: CD (4) ===
  "O que é ambiente de revisão temporário no pipeline?",
  "Como funciona o deploy no ambiente de stage?",
  "Quando repetir os testes DAST no ambiente de stage?",
  "Qual a diferença entre CI e CD no pipeline?",

  // === Etapa 7: Monitoramento (5) ===
  "Quais ferramentas de monitoramento são sugeridas para o sistema?",
  "Como usar Prometheus e Grafana para monitoramento?",
  "Como o Wazuh ajuda na detecção de anomalias?",
  "Como usar ELK Stack para análise de logs?",
  "Como detectar tentativas de quebra de senha por força bruta?",

  // === Etapa 8: Documentação (4) ===
  "Qual o formato do relatório final a ser entregue?",
  "O que deve ser incluído no relatório final?",
  "Como documentar o pipeline CI/CD no relatório?",
  "Qual o número máximo de páginas do relatório?",
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log(`Iniciando seed de ${questions.length} perguntas...\n`);
  await fs.mkdir(ASKS_DIR, { recursive: true });

  let ok = 0, fail = 0;
  const startFrom = parseInt(process.env.START_FROM) || 0;

  for (let i = startFrom; i < questions.length; i++) {
    const q = questions[i];
    try {
      const url = `${GITBOOK_URL}?ask=${encodeURIComponent(q)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let text = await response.text();

      // Remove Suggested Follow-up Questions (mesma lógica do server.js)
      const idx = text.indexOf('# Suggested Follow-up Questions:');
      if (idx !== -1) text = text.slice(0, idx).trimEnd();

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const filename = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.md`;

      const fileContent = text.startsWith('# ') ? text : `# ${q}\n\n${text}`;
      await fs.writeFile(path.join(ASKS_DIR, filename), fileContent);

      console.log(`[${i+1}/${questions.length}] OK: "${q.slice(0, 60)}${q.length > 60 ? '...' : ''}" -> ${filename}`);
      ok++;
    } catch (err) {
      console.error(`[${i+1}/${questions.length}] ERRO: "${q.slice(0, 60)}${q.length > 60 ? '...' : ''}" -> ${err.message}`);
      fail++;
    }

    await sleep(1000);
  }

  console.log(`\nConcluído! ${ok} OK, ${fail} falhas.`);
}

run().catch(console.error);
