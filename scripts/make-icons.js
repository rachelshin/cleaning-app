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

function draw(size) {
  const c = size / 2;
  const big = size * 0.3;
  const small = size * 0.1;
  return (x, y) => {
    if (
      inStar(x - c, y - c * 1.06, big) ||
      inStar(x - size * 0.78, y - size * 0.24, small)
    ) {
      return [255, 255, 255];
    }
    const t = y / size; // vertical pine gradient
    return [
      Math.round(78 - 27 * t),
      Math.round(133 - 37 * t),
      Math.round(119 - 41 * t),
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
