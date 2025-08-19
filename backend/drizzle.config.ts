import type { Config } from 'drizzle-kit';
import { env } from './src/config/environment';

export default {
  schema: './src/db/schema/*.ts',
  out: './src/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
} satisfies Config;