// gen-wood.js — 生成木纹纹理贴图 (纯直线细纹，无圆圈)
const sharp = require('sharp');

const W = 800, H = 600;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function generateWood(baseColor, opts = {}) {
  const { grainStrength = 0.15, seed = 42, warmthShift = 0 } = opts;
  // 简单 PRNG
  let s = seed | 0;
  const rand = () => { s = (s * 0x6D2B79F5 + 1) | 0; return ((s ^ s >>> 15) >>> 0) / 4294967296; };
  const buf = Buffer.alloc(W * H * 3);
  const [br, bg, bb] = baseColor;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // ── 仅纵向直线细纹纹理，无任何圆圈/环形结构 ──

      // 1. 主纵向纹理 — 细微明暗条纹，沿Y轴延伸
      const primary =
        Math.sin(x * 0.035) * 0.35 +
        Math.sin(x * 0.072 + 1.3) * 0.25 +
        Math.sin(x * 0.018 + 0.7) * 0.20 +
        Math.sin(x * 0.11 + 2.1) * 0.15 +
        Math.sin(x * 0.053 + 3.5) * 0.18;

      // 2. 细微纵向扰动 — 模拟木纤维的轻微弯曲
      const micro =
        Math.sin(x * 0.15 + Math.sin(y * 0.02) * 0.8) * 0.06 +
        Math.sin(x * 0.22 + Math.cos(y * 0.015) * 0.6) * 0.05 +
        Math.sin(x * 0.08 + y * 0.005) * 0.04;

      // 3. 极浅的水平横纹 — 模拟木板轻微的水平变化
      const horizontal =
        Math.sin(y * 0.04) * 0.04 +
        Math.sin(y * 0.09) * 0.03;

      // 4. 随机微噪点 — 模拟真实木质表面
      const noise = (rand() - 0.5) * 0.03;

      const grain = (primary + micro + horizontal + noise)
        - 0.12; // 均值修正，使纹理在 0 附近波动

      const factor = clamp(1.0 + grain * grainStrength, 0.88, 1.12);

      const r = clamp(Math.round(br * factor + warmthShift), 0, 255);
      const g = clamp(Math.round(bg * factor), 0, 255);
      const b = clamp(Math.round(bb * factor * 0.97), 0, 255);

      const idx = (y * W + x) * 3;
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
    }
  }
  return buf;
}

async function main() {
  // 白天：浅橡木 (Light Oak)
  console.log('Generating wood-light.png (浅橡木细纹)...');
  const lightBuf = generateWood([212, 184, 150], {
    grainStrength: 0.16,
    seed: 137,
    warmthShift: 6
  });
  await sharp(lightBuf, { raw: { width: W, height: H, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile('public/wood-light.png');
  console.log('  ✓ public/wood-light.png');

  // 黑夜：深胡桃木 (Dark Walnut)
  console.log('Generating wood-dark.png (深胡桃木细纹)...');
  const darkBuf = generateWood([62, 42, 28], {
    grainStrength: 0.18,
    seed: 251,
    warmthShift: 2
  });
  await sharp(darkBuf, { raw: { width: W, height: H, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile('public/wood-dark.png');
  console.log('  ✓ public/wood-dark.png');

  console.log('\nDone! 纯直线细纹木纹贴图已生成。');
}

main().catch(e => { console.error(e); process.exit(1); });
