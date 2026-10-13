import Header from './Header';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-surface-light">
      <Header />
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
