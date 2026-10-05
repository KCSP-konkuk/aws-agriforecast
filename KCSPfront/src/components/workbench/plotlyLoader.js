// Plotly 는 3D 전용 묶음(gzip 약 560KB)을 3D 차트를 처음 열 때만 받는다(차트 · 이미지 저장 공통)
let plotly;

export function loadPlotly() {
  plotly ??= import('plotly.js-gl3d-dist-min').then((m) => m.default ?? m);
  return plotly;
}

// 받아 둔 적이 있을 때만 정리한다
export function purgePlot(el) {
  if (plotly && el) plotly.then((Plotly) => Plotly.purge(el)).catch(() => {});
}
