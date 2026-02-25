import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VPN Admin',
  description: 'Admin panel for VPN service',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
