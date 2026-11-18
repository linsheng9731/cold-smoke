const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist-mobile');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
let template = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
// Only the browser build fetches fonts. Native builds must boot in airplane mode.
template = template.replace(/\/\/ type: fetched[\s\S]*?(?=\/\*__JS__\*\/)/, '');
const source = fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && f !== '20_director.js').sort()
  .map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
template = template.replace('/*__JS__*/', () => source);
const scripts = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) throw new Error('Expected one game script');
fs.writeFileSync(path.join(out, 'game.js'), scripts[0][1]);
template = template.replace(scripts[0][0], '<script src="native.js"></script><script src="game.js"></script>');
const headEnd = template.indexOf('<style>');
const head = template.slice(0, headEnd);
const body = template.slice(headEnd);
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html>
<html><head>${head}
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#05080d">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'">
<link rel="stylesheet" href="fonts/fonts.css">
</head><body>${body}</body></html>`);
fs.cpSync(path.join(root, 'xhs', 'fonts'), path.join(out, 'fonts'), { recursive: true });
fs.cpSync(path.join(root, 'art'), path.join(out, 'art'), { recursive: true });
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(out, 'LICENSE'));
fs.cpSync(path.join(root, 'mobile', 'licenses'), path.join(out, 'licenses'), { recursive: true });
buildSync({ entryPoints: [path.join(root, 'mobile', 'native.js')], outfile: path.join(out, 'native.js'), bundle: true, format: 'iife', target: ['safari15', 'chrome100'], legalComments: 'eof' });
console.log('Built offline mobile game in dist-mobile/');
