/**
 * PM2 process file for the VPS. One app per environment; each runs the release
 * that /opt/encalm/<env>/current points to, with its secrets in /etc/encalm/<env>.env.
 *
 *   pm2 startOrReload /opt/encalm/ecosystem.config.cjs --only encalm-production --update-env
 *
 * Always one instance (fork mode): SQLite, the email worker and the login rate
 * limiter all assume a single process.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.ENCALM_ROOT || '/opt/encalm';
const LOG_DIR = process.env.ENCALM_LOG_DIR || '/var/log/encalm';
const ETC_DIR = process.env.ENCALM_ETC || '/etc/encalm';

/** Release id written by deploy.sh; reported to Sentry and /api/client-config. */
function releaseOf(env) {
  try {
    return fs.readFileSync(path.join(ROOT, env, 'current', 'RELEASE'), 'utf8').trim();
  } catch {
    return undefined;
  }
}

function app(env, port) {
  const current = path.join(ROOT, env, 'current');
  return {
    name: `encalm-${env}`,
    cwd: current,
    script: path.join(current, 'server/dist/index.js'),
    node_args: '--enable-source-maps',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    max_memory_restart: '512M',
    // Give in-flight requests and the SQLite checkpoint time to finish (the app forces exit at 10 s).
    kill_timeout: 12000,
    restart_delay: 2000,
    exp_backoff_restart_delay: 200,
    out_file: path.join(LOG_DIR, `${env}.out.log`),
    error_file: path.join(LOG_DIR, `${env}.err.log`),
    merge_logs: true,
    // pino already timestamps every line.
    time: false,
    env: {
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      API_PORT: String(port),
      DOTENV_CONFIG_PATH: path.join(ETC_DIR, `${env}.env`),
      SENTRY_ENVIRONMENT: env,
      APP_RELEASE: releaseOf(env),
    },
  };
}

module.exports = {
  apps: [app('production', 5000), app('staging', 5001)],
};
