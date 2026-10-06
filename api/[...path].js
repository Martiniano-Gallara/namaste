import { handleRequest } from '../server.js';

export default async function handler(req, res) {
  if (req.url && (req.url.startsWith('/api/index') || req.url === '/api' || req.url === '/api/')) {
    const raw = req.headers['x-matched-path'] || req.headers['x-forwarded-url'] || '';
    if (raw && raw.startsWith('/api/')) {
      req.url = raw;
    }
  }
  return handleRequest(req, res);
}
