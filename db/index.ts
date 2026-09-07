import { db } from '@/lib/storage';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export function getDb() {
  return drizzle(db(), { schema });
}
