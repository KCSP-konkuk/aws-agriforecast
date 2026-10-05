// 지금 차트를 PNG 로 — 위에 제목·설명, 아래에 출처를 붙인다(공공데이터는 출처 표시가 조건).
// SVG·HTML 차트는 html-to-image 로 그 영역을, 3D(WebGL)는 Plotly 가 그린 그림을 쓴다. 둘 다 누를 때만 받는다
import { loadPlotly } from './plotlyLoader';

const SCALE = 2;
const PAD = 24 * SCALE;
const FAMILY = '"Noto Sans KR", "Work Sans", sans-serif';
const FONTS = { title: `700 ${18 * SCALE}px ${FAMILY}`, sub: `400 ${13 * SCALE}px ${FAMILY}`, foot: `400 ${12 * SCALE}px ${FAMILY}` };
const LINE = { title: 26 * SCALE, sub: 19 * SCALE, foot: 17 * SCALE };

// 이미지에 넣지 않을 것(축·기준 고르기, 조작 안내): data-export="skip"
const keep = (node) => !(node instanceof HTMLElement && node.dataset.export === 'skip');

async function chartPng(node) {
  const gl = node.querySelector('.js-plotly-plot');
  if (gl) {
    const Plotly = await loadPlotly();
    return Plotly.toImage(gl, { format: 'png', scale: SCALE, width: gl.clientWidth, height: gl.clientHeight });
  }
  const { toPng } = await import('html-to-image');
  return toPng(node, { pixelRatio: SCALE, backgroundColor: '#FFFFFF', filter: keep, skipFonts: true });
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// 글줄을 폭에 맞게 나눈다 — ' · ' 마다 끊을 수 있다
function wrap(ctx, font, text, width) {
  if (!text) return [];
  ctx.font = font;
  const lines = [];
  let line = '';
  for (const part of text.split(' · ')) {
    const next = line ? `${line} · ${part}` : part;
    if (!line || ctx.measureText(next).width <= width) line = next;
    else {
      lines.push(line);
      line = part;
    }
  }
  return [...lines, line];
}

const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80);

export async function saveChartImage(node, { title, subtitle, footer, fileName }) {
  await document.fonts?.ready;
  const chart = await loadImage(await chartPng(node));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const width = chart.width + PAD * 2;
  const inner = width - PAD * 2;
  const head = { title: wrap(ctx, FONTS.title, title, inner), sub: wrap(ctx, FONTS.sub, subtitle, inner) };
  const foot = wrap(ctx, FONTS.foot, footer, inner);
  const top = PAD + head.title.length * LINE.title + head.sub.length * LINE.sub + 12 * SCALE;
  canvas.width = width;
  canvas.height = top + chart.height + 10 * SCALE + foot.length * LINE.foot + PAD;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  let y = PAD;
  const draw = (lines, font, color, height) => {
    ctx.font = font;
    ctx.fillStyle = color;
    for (const l of lines) {
      ctx.fillText(l, PAD, y);
      y += height;
    }
  };
  draw(head.title, FONTS.title, '#333333', LINE.title);
  draw(head.sub, FONTS.sub, '#64748B', LINE.sub);
  ctx.drawImage(chart, PAD, top);
  y = top + chart.height + 10 * SCALE;
  draw(foot, FONTS.foot, '#64748B', LINE.foot);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(fileName)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
