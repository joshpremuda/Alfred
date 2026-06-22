import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import ThemeProvider from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Alfred — Valet',
  description: 'Your personal Chief of Staff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
            <Sidebar />
            <main className="flex-1 overflow-hidden flex flex-col min-w-0">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
