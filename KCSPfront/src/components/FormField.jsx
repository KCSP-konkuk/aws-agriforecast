import { useState } from 'react';

const inputClass = (invalid) =>
  `h-12 w-full rounded-lg border bg-white px-4 text-base text-text-main transition-colors placeholder:text-subtext-light focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${
    invalid ? 'border-red-500' : 'border-border-light'
  }`;

const MESSAGE_COLOR = { error: 'text-red-700', success: 'text-primary', info: 'text-subtext-light' };

// 입력 칸 아래 한 줄 안내. tone: error | success | info
function FieldMessage({ id, message, tone = 'error' }) {
  if (!message) return null;
  return <p id={`${id}-message`} className={`text-xs ${MESSAGE_COLOR[tone]}`}>{message}</p>;
}

export function TextField({ label, id, invalid, message, tone, ...props }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-text-main">{label}</label>
      <input id={id} name={id} className={inputClass(invalid)} aria-invalid={!!invalid} aria-describedby={message ? `${id}-message` : undefined} {...props} />
      <FieldMessage id={id} message={message} tone={tone} />
    </div>
  );
}

export function PasswordField({ label, id, invalid, message, tone, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-text-main">{label}</label>
      <div className="relative">
        <input id={id} name={id} type={visible ? 'text' : 'password'} className={`${inputClass(invalid)} pr-12`} aria-invalid={!!invalid} aria-describedby={message ? `${id}-message` : undefined} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-subtext-light hover:text-text-main"
          aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        >
          <span className="material-symbols-outlined">{visible ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
      <FieldMessage id={id} message={message} tone={tone} />
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{children}</p>
  );
}

export function SubmitButton({ loading, loadingText, disabled, children }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? loadingText : children}
    </button>
  );
}
