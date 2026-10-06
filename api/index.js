/**
 * Vercel Serverless Function Entry Point for Namasté API
 */
import { handleRequest } from '../server.js';

export default async function handler(req, res) {
  // En Vercel Serverless con rewrite a /api/index, req.url puede llegar como /api/index.
  // Restaurar la URL original desde las cabeceras de enrutamiento de Vercel:
  if (req.url && (req.url.startsWith('/api/index') || req.url === '/api' || req.url === '/api/')) {
    const raw = req.headers['x-matched-path'] || req.headers['x-forwarded-url'] || '';
    if (raw) {
      if (raw.startsWith('/api/')) {
        req.url = raw;
      } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
        try {
          const u = new URL(raw);
          if (u.pathname.startsWith('/api/')) {
            req.url = u.pathname + u.search;
          }
        } catch (e) {}
      }
    }
  }
  return handleRequest(req, res);
}
