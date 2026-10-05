import { useEffect, useRef, useState } from 'react';
import { loadPlotly, purgePlot } from './plotlyLoader';

const CONFIG = {
  responsive: true,
  displaylogo: false,
  scrollZoom: false, // 휠은 페이지 스크롤에 — 확대는 끌기·오른쪽 위 버튼으로
  modeBarButtonsToRemove: ['resetCameraLastSave3d', 'hoverClosest3d', 'tableRotation'],
  toImageButtonOptions: { format: 'png', filename: 'agriforecast', scale: 2 },
};

const BASE_LAYOUT = {
  autosize: true,
  margin: { l: 0, r: 0, t: 8, b: 0 },
  font: { family: 'Noto Sans KR, Work Sans, sans-serif', size: 11, color: '#333333' },
  paper_bgcolor: 'rgba(0,0,0,0)',
  hoverlabel: { bgcolor: '#FFFFFF', bordercolor: '#E0E0E0', font: { color: '#333333', size: 12 } },
};

// data·layout 은 부모가 useMemo 로 넘긴다(바뀔 때만 다시 그림). layout.uirevision 이 같으면 돌려 놓은 시점을 지킨다
export default function PlotlyChart({ data, layout, height = 460, label }) {
  const ref = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let alive = true;
    loadPlotly()
      .then((Plotly) => {
        if (!alive || !ref.current) return null;
        return Plotly.react(ref.current, data, { ...BASE_LAYOUT, height, ...layout }, CONFIG).then(() => alive && setStatus('ready'));
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [data, layout, height]);

  useEffect(() => {
    const el = ref.current;
    return () => purgePlot(el);
  }, []);

  return (
    <div className="relative" style={{ height }}>
      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-subtext-light">
          {status === 'error' ? '3D 차트를 불러오지 못했어요. 새로고침해 보세요.' : '3D 차트를 불러오는 중이에요'}
        </div>
      )}
      <div ref={ref} className="h-full w-full" role="img" aria-label={label} />
    </div>
  );
}
