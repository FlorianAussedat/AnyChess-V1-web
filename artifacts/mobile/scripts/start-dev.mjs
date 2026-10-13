/**
 * Start Metro for the Android/iOS development build.
 *
 * On Replit, Metro stays on localhost and the proxy publishes it.
 * On a local machine, binding only to localhost makes a phone show
 * "Unable to load script" unless USB + `adb reverse` is set up.
 */
import { spawn } from 'node:child_process';

const onReplit = Boolean(process.env.REPLIT_DEV_DOMAIN);
const args = ['exec', 'expo', 'start', '--dev-client'];

if (process.env.PORT) {
  args.push('--port', String(process.env.PORT));
}

const env = { ...process.env };
if (onReplit) {
  env.EXPO_PACKAGER_PROXY_URL = `https://${process.env.REPLIT_EXPO_DEV_DOMAIN ?? ''}`;
  env.EXPO_PUBLIC_DOMAIN = process.env.REPLIT_DEV_DOMAIN ?? '';
  env.EXPO_PUBLIC_REPL_ID = process.env.REPL_ID ?? '';
  env.REACT_NATIVE_PACKAGER_HOSTNAME = process.env.REPLIT_DEV_DOMAIN ?? '';
  args.push('--localhost');
}

const child = spawn('pnpm', args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
