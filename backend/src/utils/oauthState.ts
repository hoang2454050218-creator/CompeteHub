import crypto from 'crypto';
import { redis } from '../config/redis';

const STATE_TTL_SECONDS = 600;

export async function generateOAuthState(): Promise<string> {
  const state = crypto.randomBytes(32).toString('hex');
  await redis.set(`oauth:state:${state}`, '1', 'EX', STATE_TTL_SECONDS);
  return state;
}

export async function validateOAuthState(state: string | undefined): Promise<boolean> {
  if (!state) return false;
  const result = await redis.del(`oauth:state:${state}`);
  return result === 1;
}
