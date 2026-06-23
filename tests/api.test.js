const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8000';

async function get(url) {
  const res = await fetch(`${BASE_URL}${url}`);
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch {}
  return { status: res.status, headers: res.headers, body, json };
}

describe('API de histórico', () => {
  it('GET /api/history — retorna 200 com estrutura válida', async () => {
    const { status, json } = await get('/api/history');
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.items));
    assert.ok(typeof json.total === 'number');
    assert.ok(typeof json.hasMore === 'boolean');
    assert.equal(json.page, 1);
  });

  it('GET /api/history?order=desc — ordenação descendente', async () => {
    const { status, json } = await get('/api/history?order=desc');
    assert.equal(status, 200);
    for (let i = 1; i < json.items.length; i++) {
      assert.ok(json.items[i - 1].filename >= json.items[i].filename);
    }
  });

  it('GET /api/history?limit=999 — respeita limite máximo de 100', async () => {
    const { status, json } = await get('/api/history?limit=999');
    assert.equal(status, 200);
    assert.ok(json.limit <= 100);
  });

  it('GET /api/history — item tem filename, question e date', async () => {
    const { json } = await get('/api/history?limit=1');
    if (json.items.length > 0) {
      const item = json.items[0];
      assert.ok(typeof item.filename === 'string' && item.filename.endsWith('.md'));
      assert.ok(typeof item.question === 'string');
      assert.ok(typeof item.date === 'string');
    }
  });

  it('GET /api/history/:filename — 404 para arquivo inexistente', async () => {
    const { status, json } = await get('/api/history/nonexistent.md');
    assert.equal(status, 404);
    assert.ok(json.error);
  });

  it('GET /api/history — pagination (limit=1, page=2) funciona sem erros', async () => {
    const p1 = await get('/api/history?limit=1&order=asc');
    const p2 = await get('/api/history?page=2&limit=1&order=asc');
    assert.equal(p2.status, 200);
    assert.equal(p2.json.page, 2);
    if (p1.json.items[0] && p2.json.items[0]) {
      assert.notEqual(p1.json.items[0].filename, p2.json.items[0].filename);
    }
  });
});

describe('Download welcome.md', () => {
  it('GET /download/readme.md — retorna 200 com headers corretos', async () => {
    const res = await fetch(`${BASE_URL}/download/readme.md`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
    const disp = res.headers.get('content-disposition');
    assert.ok(disp && disp.includes('filename="readme.md"'));
  });
});

describe('MCP tools', () => {
  async function withSession(fn) {
    const ac = new AbortController();
    const sseRes = await fetch(`${BASE_URL}/sse`, { signal: ac.signal });
    const reader = sseRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let sessionId = null;
    let readingDone = false;

    function readLine() {
      return new Promise((resolve) => {
        (function pump() {
          const idx = buf.indexOf('\n');
          if (idx !== -1) {
            const line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            resolve(line);
            return;
          }
          if (readingDone) { resolve(null); return; }
          reader.read().then(({ done, value }) => {
            if (done) { resolve(null); return; }
            buf += decoder.decode(value, { stream: true });
            pump();
          }).catch(() => resolve(null));
        })();
      });
    }

    while (!sessionId) {
      const line = await readLine();
      if (line === null) { readingDone = true; break; }
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        const m = data.match(/\/mcp\?sessionId=(.+)/);
        if (m) sessionId = m[1];
      }
    }

    async function mcp(body) {
      const res = await fetch(`${BASE_URL}/mcp?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(res.status, 202);
      let jsonBuf = '';
      while (true) {
        const line = await readLine();
        if (line === null) break;
        if (line.startsWith('data: ')) {
          jsonBuf = line.slice(6);
          break;
        }
      }
      return JSON.parse(jsonBuf);
    }

    try {
      await fn(mcp, sessionId);
    } finally {
      readingDone = true;
      try { reader.cancel(); } catch {}
      try { ac.abort(); } catch {}
    }
  }

  it('initialize handshake — retorna serverInfo e capabilities', async () => {
    await withSession(async (mcp) => {
      const json = await mcp({ jsonrpc: '2.0', method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } }, id: 1 });
      assert.equal(json.id, 1);
      assert.equal(json.result.protocolVersion, '2024-11-05');
      assert.ok(json.result.capabilities.tools);
      assert.equal(json.result.serverInfo.name, 'gitbook-chat');
    });
  });

  it('notifications/initialized — não retorna resposta', async () => {
    await withSession(async (mcp, sid) => {
      const res = await fetch(`${BASE_URL}/mcp?sessionId=${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      });
      assert.equal(res.status, 202);
    });
  });

  it('POST /mcp tools/list — retorna 5 tools', async () => {
    await withSession(async (mcp) => {
      const json = await mcp({ jsonrpc: '2.0', method: 'tools/list', id: 2 });
      assert.equal(json.jsonrpc, '2.0');
      assert.equal(json.id, 2);
      assert.equal(json.result.tools.length, 5);
      const names = json.result.tools.map(t => t.name);
      assert.ok(names.includes('query_gitbook'));
      assert.ok(names.includes('list_asks'));
      assert.ok(names.includes('get_ask'));
      assert.ok(names.includes('search_asks'));
      assert.ok(names.includes('get_welcome'));
    });
  });

  it('POST /mcp tools/call get_welcome — retorna o welcome.md', async () => {
    await withSession(async (mcp) => {
      const json = await mcp({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'get_welcome', arguments: {} }, id: 3 });
      assert.equal(json.id, 3);
      assert.ok(json.result.content[0].text.startsWith('# Estudo de Caso'));
    });
  });

  it('POST /mcp — método inválido retorna erro', async () => {
    await withSession(async (mcp) => {
      const json = await mcp({ jsonrpc: '2.0', method: 'invalid_method', id: 4 });
      assert.ok(json.error);
      assert.equal(json.error.code, -32601);
    });
  });

  it('POST /mcp — JSON-RPC inválido retorna erro', async () => {
    await withSession(async (mcp) => {
      const json = await mcp({ method: 'tools/list', id: 1 });
      assert.ok(json.error);
      assert.equal(json.error.code, -32600);
    });
  });

  it('POST /mcp sem session ativa — retorna 400', async () => {
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error);
  });
});

describe('Página principal', () => {
  it('GET / — retorna HTML com título GitBook Chat', async () => {
    const { status, body } = await get('/');
    assert.equal(status, 200);
    assert.ok(body.includes('GitBook Chat'));
    assert.ok(body.includes('x-data="chat()"'));
  });
});
