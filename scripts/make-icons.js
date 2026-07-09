// Generates the PWA icons (teal background, white sparkle) into public/.
// Zero dependencies — writes PNGs directly with zlib. Run: node scripts/make-icons.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32.table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crc32.table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(file, size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  );
}

// Four-pointed sparkle (astroid): sqrt|dx| + sqrt|dy| <= sqrt(r)
const inStar = (dx, dy, r) =>
  Math.sqrt(Math.abs(dx)) + Math.sqrt(Math.abs(dy)) <= Math.sqrt(r);

// A kidney bean: 45°-rotated ellipse with a circular bite taken out of
// its inner curve, plus a little highlight for shine.
function draw(size) {
  const c = size / 2;
  const a = size * 0.32; // bean half-length
  const b = size * 0.21; // bean half-width
  const biteR = size * 0.13;
  const R = Math.SQRT1_2;
  return (x, y) => {
    const dx = x - c;
    const dy = y - c;
    // rotate 45° so the bean lies diagonally
    const u = dx * R + dy * R;
    const v = -dx * R + dy * R;
    const inEllipse = (u / a) ** 2 + (v / b) ** 2 <= 1;
    const inBite = u ** 2 + (v + b) ** 2 <= biteR ** 2;
    if (inEllipse && !inBite) {
      // shine spot near the top of the bean
      const inShine =
        ((u + a * 0.35) / (a * 0.16)) ** 2 + ((v - b * 0.15) / (b * 0.3)) ** 2 <= 1;
      if (inShine) return [255, 255, 255];
      const t = (v + b) / (2 * b); // shade across the bean's width
      return [
        Math.round(87 - 24 * t),
        Math.round(175 - 34 * t),
        Math.round(93 - 24 * t),
      ];
    }
    if (inStar(x - size * 0.78, y - size * 0.2, size * 0.09)) {
      return [255, 255, 255];
    }
    const t = y / size; // creamy background gradient
    return [
      Math.round(249 - 10 * t),
      Math.round(243 - 14 * t),
      Math.round(230 - 20 * t),
    ];
  };
}

const out = path.join(__dirname, '..', 'public');
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writePng(path.join(out, name), size, draw(size));
  console.log('wrote public/' + name);
}
