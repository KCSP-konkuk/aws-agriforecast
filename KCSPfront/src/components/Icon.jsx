const paths = {
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  chart: 'M4 4v16h16M7 15l4-5 4 3 5-7',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  leaf: 'M20 4C10 2 3 6 5 14s15 6 15-10ZM5 20l10-10',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'm6 6 12 12M6 18 18 6',
  plus: 'M12 5v14M5 12h14',
  chevron: 'm9 5 7 7-7 7',
  check: 'm5 12 4 4L19 6',
  copy: 'M9 9h11v11H9zM15 9V4H4v11h5',
};

export default function Icon({ name = 'arrow', className = 'size-5' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={paths[name] ?? paths.arrow} /></svg>;
}
