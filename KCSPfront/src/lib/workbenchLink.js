// 작업대 링크(주소 전체 · /analysis?… · 쿼리만)에서 작업대 상태 쿼리만 꺼낸다. 작업대 링크가 아니면 null.
// 백엔드 WorkbenchQuery 와 같은 규칙: 지표(s=)가 있고, 공백이 없고, 2000자까지
export function queryFromLink(text) {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  let q = raw;
  const at = raw.indexOf('?');
  if (at >= 0) {
    const path = raw.slice(0, at);
    if (path && !/\/analysis\/?$/.test(path)) return null; // 다른 화면 주소
    q = raw.slice(at + 1);
  }
  q = q.split('#')[0];
  if (!q || q.length > 2000 || /\s/.test(q) || !new URLSearchParams(q).get('s')) return null;
  return q;
}
