import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { createApp } from './app.ts';
import { openDatabase } from './db.ts';

const env = process.env;
const tls = env.TLS_CERT_FILE && env.TLS_KEY_FILE
  ? { cert: readFileSync(env.TLS_CERT_FILE), key: readFileSync(env.TLS_KEY_FILE) }
  : null;

const db = openDatabase(env.DATABASE_FILE ?? 'server/data/onde-estacionei.db');
const app = createApp({
  db,
  allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
  rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE ?? 120),
  hsts: !!tls,
});

const server = tls ? https.createServer(tls, app.handler) : http.createServer(app.handler);
server.headersTimeout = 10_000;
server.requestTimeout = 15_000;
server.maxHeadersCount = 50;

const port = Number(env.PORT ?? 3333);
server.listen(port, env.HOST ?? '127.0.0.1', () => {
  console.log(`API em ${tls ? 'https' : 'http'}://${env.HOST ?? '127.0.0.1'}:${port}`);
  if (!tls) console.warn('Sem TLS: use só em desenvolvimento ou atrás de um proxy HTTPS.');
});

/** Desliga com segurança: fecha os fluxos SSE, para de aceitar conexões e fecha o banco. */
function shutdown() {
  app.closeStreams();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
