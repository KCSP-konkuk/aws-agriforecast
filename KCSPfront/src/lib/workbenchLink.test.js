import { describe, expect, it } from 'vitest';
import { queryFromLink } from './workbenchLink';

describe('작업대 링크', () => {
  it('주소 전체 · 경로 · 쿼리만 모두 쿼리로', () => {
    expect(queryFromLink('https://example.kr/analysis?s=retail%3Aa&f=s#x')).toBe('s=retail%3Aa&f=s');
    expect(queryFromLink(' /analysis/?s=a ')).toBe('s=a');
    expect(queryFromLink('?f=s&s=a')).toBe('f=s&s=a');
    expect(queryFromLink('s=a&f=d')).toBe('s=a&f=d');
  });

  it('작업대가 아닌 주소 · 지표 없는 쿼리 · 글은 아니다', () => {
    expect(queryFromLink('https://example.kr/community?s=a')).toBeNull();
    expect(queryFromLink('/analysis?f=s&s=')).toBeNull();
    expect(queryFromLink('양파 값이 많이 올랐네요')).toBeNull();
    expect(queryFromLink('')).toBeNull();
    expect(queryFromLink(`s=${'a'.repeat(2000)}`)).toBeNull();
  });
});
