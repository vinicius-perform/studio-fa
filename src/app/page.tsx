// src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/home');
  }, [router]);

  return (
    <div className="flex h-screen w-full bg-[#090B0E] text-zinc-400 items-center justify-center font-mono text-xs">
      Carregando Studio FA...
    </div>
  );
}
