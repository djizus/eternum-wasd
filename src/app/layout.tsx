import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Eternum WASD Dashboard',
  description: 'Dashboard for the WASD guild in Eternum, a fully on-chain game',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Header />
        <main className="main-content">
          {children}
        </main>
      </body>
    </html>
  );
} 