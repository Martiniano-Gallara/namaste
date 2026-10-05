/**
 * Vercel Serverless Function Entry Point for Namasté API
 * Enruta todas las peticiones /api/* hacia el backend oficial integrado con Supabase
 */
import { handleRequest } from '../server.js';

export default async function handler(req, res) {
  // En Vercel, reescribir req.url si viene como /api/index.js o similar
  const originalUrl = req.headers['x-matched-path'] || req.headers['x-forwarded-url'] || req.url;
  if (originalUrl && !req.url.startsWith('/api/') && originalUrl.startsWith('/api/')) {
    req.url = originalUrl;
  }
  return handleRequest(req, res);
}
