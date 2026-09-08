import type { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="relative min-h-dvh flex flex-col">
      <Navbar />
      <main
        className="relative z-10 flex-1 pt-16"
        style={{ minHeight: 'calc(100dvh - 140px)' }}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
