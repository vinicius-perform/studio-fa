// src/app/create/page.tsx
'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CreateRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client');

  useEffect(() => {
    // Redireciona o fluxo legado de /create para o novo núcleo: /creative-chat
    const targetUrl = clientId ? `/creative-chat?client=${clientId}` : '/creative-chat';
    router.replace(targetUrl);
  }, [router, clientId]);

  return (
    <div className="min-h-screen bg-[#0E1116] flex items-center justify-center text-zinc-400 text-sm">
      Redirecionando para o Chat Criativo...
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0E1116] flex items-center justify-center text-zinc-400 text-sm">
          Redirecionando para o Chat Criativo...
        </div>
      }
    >
      <CreateRedirectContent />
    </Suspense>
  );
}
