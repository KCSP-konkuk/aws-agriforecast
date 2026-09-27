// 날짜를 'YYYY-MM-DD' 로. 브라우저(한국) 시간 기준.
// toISOString() 은 UTC 로 바꿔서, 한국 시간 00~09시에는 하루 전 날짜가 나온다 — 쓰지 말 것
export function toLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
