require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs/promises');
const path = require('path');

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

fs.mkdir(ASKS_DIR, { recursive: true }).catch(() => {});

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
