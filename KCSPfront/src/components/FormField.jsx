import { useState } from 'react';

const inputClass = (invalid) =>
  `w-full h-12 px-4 rounded-lg border bg-white text-base text-text-main placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors ${
    invalid ? 'border-red-500' : 'border-gray-300'
  }`;

export function TextField({ label, id, invalid, ...props }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-text-main">{label}</label>
      <input id={id} name={id} className={inputClass(invalid)} {...props} />
    </div>
  );
}

export function PasswordField({ label, id, invalid, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-text-main">{label}</label>
      <div className="relative">
        <input id={id} name={id} type={visible ? 'text' : 'password'} className={`${inputClass(invalid)} pr-12`} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-text-main"
          aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        >
          <span className="material-symbols-outlined">{visible ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{children}</p>
  );
}

export function SubmitButton({ loading, loadingText, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center h-12 rounded-lg bg-primary hover:bg-primary-hover text-white text-base font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? loadingText : children}
    </button>
  );
}
