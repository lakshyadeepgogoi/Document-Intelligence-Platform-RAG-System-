import type { VercelRequest, VercelResponse } from '@vercel/node';
import app, { ensureDB } from '../src/server';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDB();
  app(req as any, res as any);
}
