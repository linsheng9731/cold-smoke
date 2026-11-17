// concatenates src/*.js (sorted) + template into dist/index.html (single self-contained page)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = __dirname, srcDir = path.join(root, 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();
const artContext = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(srcDir, '03c_art.js'), 'utf8') + '\nglobalThis.__art = Art;', artContext);
const art = {};
for (const [name, relative] of Object.entries(artContext.__art.files)) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error('Missing art asset: ' + relative);
  const type = path.extname(file) === '.svg' ? 'image/svg+xml' : 'image/webp';
  art[name] = 'data:' + type + ';base64,' + fs.readFileSync(file).toString('base64');
}
let js = 'self.COLD_SMOKE = { ...self.COLD_SMOKE, betaPreview: true };\nself.COLD_SMOKE_ART = ' + JSON.stringify(art) + ';\n';
for (const f of files) js += '\n// ===== ' + f + ' =====\n' + fs.readFileSync(path.join(srcDir, f), 'utf8');
const tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
const out = tpl.replace('/*__JS__*/', () => js);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), out);
// dev variant with a full html skeleton (the artifact host adds its own)
fs.writeFileSync(path.join(root, 'dist', 'dev.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + out + '</body></html>');
console.log('built', (out.length / 1024).toFixed(1) + ' KB', files.length, 'files');
