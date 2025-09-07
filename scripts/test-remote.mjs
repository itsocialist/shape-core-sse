#!/usr/bin/env node

// Remote MCP Server Smoke Test (HTTP + SSE)
// Usage:
//   BASE_URL=https://your-host API_KEY=xxxx node scripts/test-remote.mjs

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || process.env.TOKEN || '';
const SESSION_ID = process.env.SESSION_ID || `sess_${Date.now()}`;

async function get(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res;
}

async function postJson(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function testHealth() {
  const res = await get('/health');
  const json = await res.json();
  console.log('✓ /health', json);
}

async function testMcpPublicInitialize() {
  const { status, json } = await postJson('/mcp/public', {
    jsonrpc: '2.0', id: 1, method: 'initialize', params: {}
  });
  if (json.error) throw new Error(`mcp/public initialize error: ${JSON.stringify(json.error)}`);
  console.log('✓ /mcp/public initialize ->', json.result?.protocolVersion);
}

async function testMcpAuthInitialize() {
  if (!API_KEY) {
    console.log('… Skipping auth initialize (no API_KEY)');
    return;
  }
  const { status, json } = await postJson('/mcp', {
    jsonrpc: '2.0', id: 2, method: 'initialize', params: {}
  }, API_KEY);
  if (json.error) throw new Error(`mcp initialize error: ${JSON.stringify(json.error)}`);
  console.log('✓ /mcp initialize (auth) ->', json.result?.protocolVersion);
}

async function testToolsList() {
  const token = API_KEY || undefined;
  const { json } = await postJson(token ? '/mcp' : '/mcp/public', {
    jsonrpc: '2.0', id: 3, method: 'tools/list', params: {}
  }, token);
  if (json.error) throw new Error(`tools/list error: ${JSON.stringify(json.error)}`);
  const count = json.result?.tools?.length ?? 0;
  console.log(`✓ tools/list (${count} tools)`);
}

async function testSSE(timeoutMs = 6000) {
  if (!API_KEY) {
    console.log('… Skipping SSE auth test (no API_KEY)');
    return;
  }
  const url = `${BASE_URL}/mcp/sse?sessionId=${encodeURIComponent(SESSION_ID)}&access_token=${encodeURIComponent(API_KEY)}`;
  console.log('→ SSE connect', url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'text/event-stream' } });
    if (!res.ok) throw new Error(`SSE HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = chunk.split('\n').find(l => l.startsWith('data: '));
        if (line) {
          const payload = line.slice(6);
          console.log('✓ SSE event:', payload);
        }
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.log('✓ SSE received, closed after timeout');
    } else {
      throw e;
    }
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  try {
    console.log(`Running remote smoke tests against ${BASE_URL}`);
    await testHealth();
    await testMcpPublicInitialize();
    await testMcpAuthInitialize();
    await testToolsList();
    await testSSE();
    console.log('All checks completed.');
  } catch (err) {
    console.error('Smoke test failed:', err?.message || err);
    process.exit(1);
  }
})();

