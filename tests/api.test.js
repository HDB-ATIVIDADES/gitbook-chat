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

describe('Página principal', () => {
  it('GET / — retorna HTML com título GitBook Chat', async () => {
    const { status, body } = await get('/');
    assert.equal(status, 200);
    assert.ok(body.includes('GitBook Chat'));
    assert.ok(body.includes('x-data="chat()"'));
  });
});
