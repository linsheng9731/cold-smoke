// Native launcher/splash art generated from geometry; no image dependencies.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
function crc32(b) {
  let c = 0xffffffff;
  for (const v of b) { c ^= v; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, crc]);
}
function writePNG(file, w, h, splash = false) {
  const raw = Buffer.alloc((w * 3 + 1) * h), scale = Math.min(w, h) * (splash ? 0.32 : 1);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i - w / 2) / scale + 0.5, y = (j - h / 2) / scale + 0.5;
    let color = [5, 8, 13];
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      color = [8 + Math.round(y * 6), 17 + Math.round(y * 10), 28 + Math.round(y * 12)];
      if (Math.hypot(x - 0.69, y - 0.29) < 0.065) color = [255, 208, 138];
      if (y > 0.33 + Math.abs(x - 0.42) * 1.4 && y < 0.75 && x > 0.18 && x < 0.82) color = [148, 174, 191];
      if (y > 0.33 + Math.abs(x - 0.42) * 1.4 && x < 0.42 && y < 0.75) color = [240, 245, 246];
      if (y > 0.49 + Math.abs(x - 0.66) && y < 0.75 && x > 0.42 && x < 0.86) color = [208, 224, 232];
      const track = 0.48 + 0.07 * Math.sin((y - 0.54) * 17);
      if (y > 0.55 && y < 0.83 && Math.abs(x - track) < 0.009) color = [255, 208, 138];
    }
    const n = j * (w * 3 + 1) + 1 + i * 3;
    raw[n] = color[0]; raw[n + 1] = color[1]; raw[n + 2] = color[2];
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(w); header.writeUInt32BE(h, 4); header[8] = 8; header[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
function visit(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) visit(f);
    else if (f.endsWith('.png')) {
      const b = fs.readFileSync(f);
      writePNG(f, b.readUInt32BE(16), b.readUInt32BE(20), /splash/i.test(f));
    }
  }
}
visit(path.join(root, 'android/app/src/main/res'));
visit(path.join(root, 'ios/App/App/Assets.xcassets'));
const drawable = path.join(root, 'android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml');
fs.writeFileSync(drawable, `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#05080d" android:pathData="M0,0H108V108H0Z"/>
  <path android:fillColor="#94aebf" android:pathData="M23,76L47,34L76,76Z"/>
  <path android:fillColor="#f0f5f6" android:pathData="M23,76L47,34L42,76Z"/>
  <path android:fillColor="#d0e0e8" android:pathData="M47,76L70,49L89,76Z"/>
  <path android:strokeColor="#ffd08a" android:strokeWidth="2" android:fillColor="#00000000" android:pathData="M54,59C65,70 45,74 51,86"/>
</vector>`);
fs.writeFileSync(path.join(root, 'android/app/src/main/res/values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#05080d</color></resources>');
console.log('Generated native icons and splash screens');
