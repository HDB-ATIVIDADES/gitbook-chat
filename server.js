require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const GITBOOK_URL = process.env.GITBOOK_URL;
if (!GITBOOK_URL) {
  console.error('GITBOOK_URL não definida no .env');
  process.exit(1);
}

const ASKS_DIR = path.join(__dirname, 'asks');
const WELCOME_FILE = path.join(__dirname, 'welcome.md');

function truncateAtFollowup(text) {
  const idx = text.indexOf('# Suggested Follow-up Questions:');
  return idx !== -1 ? text.slice(0, idx).trimEnd() : text;
}

fs.mkdir(ASKS_DIR, { recursive: true }).catch(() => {});

// MCP SDK paths


app.use(express.static('public'));
app.use(express.json());

app.get('/js/marked.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/marked/marked.min.js'));
});
app.get('/js/alpine.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/alpinejs/dist/cdn.min.js'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/download/readme.md', async (req, res) => {
  try {
    const content = await fs.readFile(WELCOME_FILE, 'utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="readme.md"');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(content);
  } catch (err) {
    res.status(404).send('Arquivo não encontrado');
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const order = req.query.order === 'desc' ? -1 : 1;
    const files = await fs.readdir(ASKS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md')).sort();
    if (order === -1) mdFiles.reverse();
    const total = mdFiles.length;
    const start = (page - 1) * limit;
    const pageFiles = mdFiles.slice(start, start + limit);

    const items = await Promise.all(pageFiles.map(async (f) => {
      const filePath = path.join(ASKS_DIR, f);
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const question = content.startsWith('# ')
        ? content.split('\n')[0].replace(/^# /, '').trim()
        : f.replace(/\.md$/, '');
      return { filename: f, question, date: stat.mtime.toISOString() };
    }));

    res.json({ items, total, page, limit, hasMore: start + limit < total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history/:file', async (req, res) => {
  try {
    const name = path.basename(req.params.file);
    const filePath = path.join(ASKS_DIR, name);
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content });
  } catch (err) {
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

const MCP_TOOLS = [
  {
    name: 'query_gitbook',
    description: 'Faz uma pergunta ao GITBOOK_URL (fonte RAG fixa no .env). Cada chamada é independente e sem contexto. Retorna a resposta do GitBook.',
    inputSchema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] }
  },
  {
    name: 'list_asks',
    description: 'Lista perguntas e respostas salvas com paginação',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        limit: { type: 'number' },
        order: { type: 'string', enum: ['asc', 'desc'] }
      }
    }
  },
  {
    name: 'get_ask',
    description: 'Retorna o conteúdo completo de uma resposta salva',
    inputSchema: { type: 'object', properties: { filename: { type: 'string' } }, required: ['filename'] }
  },
  {
    name: 'search_asks',
    description: 'Busca um termo nas respostas salvas',
    inputSchema: { type: 'object', properties: { term: { type: 'string' } }, required: ['term'] }
  },
  {
    name: 'get_welcome',
    description: 'Retorna o conteúdo do welcome.md — cópia local commitada do README.md do GITBOOK_URL (fonte RAG fixa). Nunca é refetchado.',
    inputSchema: { type: 'object', properties: {} }
  }
];

// SSE MCP transport
const sseClients = new Map();

app.get('/sse', (req, res) => {
  const sessionId = crypto.randomUUID();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`event: endpoint\ndata: /mcp?sessionId=${sessionId}\n\n`);

  sseClients.set(sessionId, res);
  req.on('close', () => sseClients.delete(sessionId));
});

app.post('/mcp', async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId || !sseClients.has(sessionId)) {
    return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'No active SSE session' } });
  }
  const sseRes = sseClients.get(sessionId);
  res.status(202).end();

  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== '2.0') {
    sseRes.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request' } })}\n\n`);
    return;
  }

  if (method === 'initialize') {
    const resp = {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'gitbook-chat', version: '1.0.0' }
      }
    };
    sseRes.write(`data: ${JSON.stringify(resp)}\n\n`);
    return;
  }

  if (method === 'notifications/initialized') {
    return;
  }

  try {
    if (method === 'tools/list') {
      sseRes.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } })}\n\n`);
      return;
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      let text;

      switch (toolName) {
        case 'query_gitbook': {
          const url = `${GITBOOK_URL}?ask=${encodeURIComponent(args.question)}`;
          const response = await fetch(url);
          if (!response.ok) throw new Error(`GitBook retornou ${response.status}`);
          text = truncateAtFollowup(await response.text());
          break;
        }
        case 'list_asks': {
          const page = Math.max(1, parseInt(args.page) || 1);
          const limit = Math.min(100, Math.max(1, parseInt(args.limit) || 30));
          const files = await fs.readdir(ASKS_DIR);
          let mdFiles = files.filter(f => f.endsWith('.md')).sort();
          if (args.order !== 'asc') mdFiles.reverse();
          const total = mdFiles.length;
          const start = (page - 1) * limit;
          const pageFiles = mdFiles.slice(start, start + limit);
          const items = await Promise.all(pageFiles.map(async (f) => {
            const filePath = path.join(ASKS_DIR, f);
            const stat = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            const question = content.startsWith('# ')
              ? content.split('\n')[0].replace(/^# /, '').trim()
              : f.replace(/\.md$/, '');
            return { filename: f, question, date: stat.mtime.toISOString() };
          }));
          text = JSON.stringify({ items, total, page, limit }, null, 2);
          break;
        }
        case 'get_ask': {
          const name = path.basename(args.filename);
          const filePath = path.join(ASKS_DIR, name);
          const content = truncateAtFollowup(await fs.readFile(filePath, 'utf-8'));
          const stat = await fs.stat(filePath);
          text = JSON.stringify({ filename: name, content, date: stat.mtime.toISOString() }, null, 2);
          break;
        }
        case 'search_asks': {
          const files = await fs.readdir(ASKS_DIR);
          const mdFiles = files.filter(f => f.endsWith('.md'));
          const lowerTerm = args.term.toLowerCase();
          const results = [];
          for (const f of mdFiles) {
            const filePath = path.join(ASKS_DIR, f);
            const content = await fs.readFile(filePath, 'utf-8');
            if (content.toLowerCase().includes(lowerTerm)) {
              const question = content.startsWith('# ')
                ? content.split('\n')[0].replace(/^# /, '').trim()
                : f.replace(/\.md$/, '');
              const snippet = content.slice(0, 200).replace(/\n/g, ' ').trim();
              results.push({ filename: f, question, snippet });
            }
          }
          text = JSON.stringify({ items: results, total: results.length }, null, 2);
          break;
        }
        case 'get_welcome': {
          text = truncateAtFollowup(await fs.readFile(WELCOME_FILE, 'utf-8'));
          break;
        }
        default:
          sseRes.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${toolName}` } })}\n\n`);
          return;
      }

      sseRes.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } })}\n\n`);
      return;
    }

    sseRes.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } })}\n\n`);

  } catch (err) {
    if (err.code === 'ENOENT') {
      sseRes.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: 'Arquivo não encontrado' } })}\n\n`);
      return;
    }
    sseRes.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } })}\n\n`);
  }
});

wss.on('connection', async (ws) => {
  try {
    const welcomeContent = await fs.readFile(WELCOME_FILE, 'utf-8');
    ws.send(JSON.stringify({
      type: 'welcome',
      id: 'msg-welcome',
      content: welcomeContent,
      filename: 'welcome.md'
    }));
  } catch (err) {
    console.error('Erro ao ler welcome.md:', err.message);
  }

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ask') {
        const question = msg.question.trim();
        if (!question) return;

        const url = `${GITBOOK_URL}?ask=${encodeURIComponent(question)}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`GitBook retornou ${response.status}`);
        }
        const text = await response.text();

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const filename = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.md`;

        const fileContent = text.startsWith('# ') ? text : `# ${question}\n\n${text}`;
        await fs.writeFile(path.join(ASKS_DIR, filename), fileContent);

        ws.send(JSON.stringify({
          type: 'response',
          id: `msg-${filename.replace(/\.md$/, '')}`,
          content: text,
          filename,
          question,
          timestamp: now.toISOString()
        }));
      }
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'error',
        message: err.message
      }));
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
