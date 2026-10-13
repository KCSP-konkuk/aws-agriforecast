import { Link } from 'react-router-dom';
import Icon from './Icon';

// 동일 품목의 가격 기준이 달라지는 지점을 명시한다. 없는 예측·이야기방은 연결하지 않는다.
const RETAIL = ['붉은고추', '시금치', '애호박', '양배추', '양파', '오이', '파프리카'];
const WHOLESALE = ['배추', '양파', '홍고추'];
export default function ItemJourney({ item, current }) {
  if (!item) return null;
  const retail = item === '홍고추' ? '붉은고추' : item;
  const wholesale = item === '붉은고추' ? '홍고추' : item;
  const links = [
    RETAIL.includes(retail) && { key: 'retail', to: `/analysis/summary?item=${encodeURIComponent(retail)}`, label: '소매 전망' },
    WHOLESALE.includes(wholesale) && { key: 'wholesale', to: `/detail?item=${encodeURIComponent(wholesale)}`, label: '도매 시세' },
    { key: 'analysis', to: `/analysis?tpl=transmission&item=${encodeURIComponent(retail)}`, label: '데이터 비교' },
    WHOLESALE.includes(wholesale) && { key: 'community', to: `/community?room=${encodeURIComponent(wholesale)}`, label: '이야기방' },
  ].filter((l) => l && l.key !== current);
  return (
    <nav className="item-journey" aria-label={`${item} 관련 화면`}>
      <span className="text-sm font-medium text-subtext-light">{item} 더 살펴보기</span>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => <Link key={l.key} to={l.to} className="journey-link">{l.label}<Icon className="size-4" /></Link>)}
      </div>
    </nav>
  );
}
