import { Suspense } from 'react';
import { ResultClient } from './result-client';

export default function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper"
          aria-busy="true"
        >
          <span
            aria-hidden="true"
            className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent"
          />
          <p className="font-mono text-[11.5px] tracking-tight text-muted">
            Menghitung rekomendasi…
          </p>
        </div>
      }
    >
      <ResultResolver params={params} />
    </Suspense>
  );
}

async function ResultResolver({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ResultClient params={Promise.resolve({ code })} />;
}
