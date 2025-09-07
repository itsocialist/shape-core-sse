#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const PORT = process.env.PORT || 5173;
const ROOT = process.cwd();

const mime = (p) => ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml'
})[path.extname(p).toLowerCase()] || 'application/octet-stream';

const serveFile = (res, filePath) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    res.setHeader('Content-Type', mime(filePath));
    // Dev CORS for browser access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    return res.end();
  }

  let p = pathname || '/';
  if (p === '/' || p === '') {
    // default to admin utility
    p = '/admin-utility.html';
  }
  const filePath = path.join(ROOT, p.replace(/\.+/g, '.'));
  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Admin utility server running at http://localhost:${PORT}`);
  console.log('Open admin-utility.html to manage tenants and test endpoints.');
});

