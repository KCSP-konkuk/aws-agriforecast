// 목록형 데이터의 로딩·빈 결과·오류 표시. status: 'loading' | 'ready' | 'error'
export default function StatusMessage({ status, loadingText, emptyText, errorText }) {
  const config = {
    loading: { text: loadingText, spin: true },
    error: { text: errorText, color: 'text-red-700' },
    ready: { text: emptyText },
  }[status];

  return (
    <div
      role={status === 'error' ? 'alert' : 'status'}
      className={`flex items-center justify-center gap-2.5 py-12 text-sm ${config.color ?? 'text-subtext-light'}`}
    >
      {config.spin && <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-light border-t-primary" aria-hidden="true" />}
      <p>{config.text}</p>
    </div>
  );
}
