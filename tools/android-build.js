const { spawnSync } = require('node:child_process');
const path = require('node:path');
const task = process.argv[2];
if (!['assembleDebug', 'bundleRelease'].includes(task)) throw new Error('Unknown Android build task');
if (task === 'bundleRelease') {
  for (const name of ['COLD_SMOKE_KEYSTORE', 'COLD_SMOKE_STORE_PASSWORD', 'COLD_SMOKE_KEY_ALIAS', 'COLD_SMOKE_KEY_PASSWORD']) {
    if (!process.env[name]) throw new Error('Missing release signing variable: ' + name);
  }
}
const windows = process.platform === 'win32';
const result = spawnSync(windows ? 'gradlew.bat' : './gradlew', [task], {
  cwd: path.resolve(__dirname, '../android'), stdio: 'inherit', shell: windows
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
