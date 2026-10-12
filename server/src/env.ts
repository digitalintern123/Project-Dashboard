/**
 * Loads environment variables before anything else reads them. The file is
 * `.env` in the working directory, or DOTENV_CONFIG_PATH (the PM2 ecosystem
 * points each environment at /etc/encalm/<env>.env). Variables already set in
 * the process environment win.
 */
import dotenv from 'dotenv';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env', quiet: true });
