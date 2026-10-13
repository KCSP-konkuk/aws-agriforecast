import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// index.html 은 Material Symbols 를 icon_names 로 쓰는 아이콘만 받는다.
// 화면에서 새 아이콘을 쓰고 목록에 안 더하면 아이콘 대신 글자(예: "search")가 보이므로 여기서 막는다
const root = fileURLToPath(new URL('../..', import.meta.url));

const sourceFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return sourceFiles(path);
  return /\.jsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
});

// <span className="material-symbols-outlined ...">이름</span> 또는 {조건 ? '이름' : '이름'}
const usedIcons = () => {
  const names = new Set();
  for (const file of sourceFiles(join(root, 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const [, body] of text.matchAll(/material-symbols-outlined[^>]*>([^<]*)</g)) {
      const literals = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
      for (const name of literals.length ? literals : [body.trim()]) names.add(name);
    }
  }
  return names;
};

const requestedIcons = () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const match = html.match(/Material\+Symbols\+Outlined&icon_names=([a-z0-9_,]+)/);
  return match ? match[1].split(',') : [];
};

describe('아이콘 글꼴 목록', () => {
  it('화면에서 쓰는 아이콘이 전부 index.html icon_names 에 있다', () => {
    const requested = new Set(requestedIcons());
    const missing = [...usedIcons()].filter((name) => !requested.has(name));
    expect(missing).toEqual([]);
  });

  it('icon_names 는 알파벳 순이다(Google Fonts 안내 규칙)', () => {
    const names = requestedIcons();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort());
  });
});
