import Header from './Header';

export default function Layout({ children }) {
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="flex flex-1 justify-center">
          <div className="layout-content-container flex flex-col max-w-[1280px] flex-1">
            <Header />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

