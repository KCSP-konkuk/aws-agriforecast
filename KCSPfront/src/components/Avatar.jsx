// 프로필 사진 기능이 없어 이름 첫 글자로 표시한다
export default function Avatar({ name, size = 'size-10' }) {
  const initial = (name || '').trim().charAt(0) || '?';
  return (
    <span className={`${size} inline-flex items-center justify-center rounded-full bg-primary text-white font-bold`}>
      {initial}
    </span>
  );
}
