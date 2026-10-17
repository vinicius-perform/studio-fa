import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Studio FA — Sistema Operacional de Criação',
  description: 'Plataforma interna de produção criativa da FA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-canvas-bg text-canvas-text min-h-screen antialiased w-full">
        {children}
      </body>
    </html>
  );
}
