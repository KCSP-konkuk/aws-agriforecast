// 목록형 데이터의 로딩·빈 결과·오류 표시. status: 'loading' | 'ready' | 'error'
export default function StatusMessage({ status, loadingText, emptyText, errorText }) {
  const config = {
    loading: { icon: 'progress_activity', text: loadingText, spin: true },
    error: { icon: 'error', text: errorText, color: 'text-red-600' },
    ready: { icon: 'inbox', text: emptyText },
  }[status];

  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 text-sm ${config.color ?? 'text-subtext-light'}`}>
      <span className={`material-symbols-outlined text-3xl ${config.spin ? 'animate-spin' : ''}`}>{config.icon}</span>
      <p>{config.text}</p>
    </div>
  );
}
