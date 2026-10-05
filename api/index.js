/**
 * Vercel Serverless Function Entry Point for Namasté API
 * Enruta todas las peticiones /api/* hacia el backend oficial integrado con Supabase
 */
import { handleRequest } from '../server.js';

export default async function handler(req, res) {
  // En Vercel Serverless Functions, si el rewrite redirige a /api/index.js:
  // La ruta real viene en req.url o en headers x-now-route-matches o x-matched-path
  if (req.url && (req.url.startsWith('/api/index') || req.url === '/api' || req.url === '/api/')) {
    const raw = req.headers['x-matched-path'] || req.headers['x-forwarded-url'] || '';
    if (raw && raw.startsWith('/api/')) {
      req.url = raw;
    }
  }
  return handleRequest(req, res);
}
