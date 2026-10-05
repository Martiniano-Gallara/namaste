/**
 * Vercel Serverless Function Entry Point for Namasté API
 * Enruta todas las peticiones /api/* hacia el backend oficial integrado con Supabase
 */
import { handleRequest } from '../server.js';

export default async function handler(req, res) {
  return handleRequest(req, res);
}
