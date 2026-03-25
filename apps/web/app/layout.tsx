import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Graph App',
  description: 'Fullstack graph visualization and chat application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen bg-white">{children}</body>
    </html>
  );
}
