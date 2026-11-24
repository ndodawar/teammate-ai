import { Suspense } from 'react';
import MembersClient from './members-client';

export default function MembersPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper px-4 py-6 sm:px-6" aria-busy="true">
          <p className="font-mono text-[12px] text-muted">Memuat halaman anggota…</p>
        </div>
      }
    >
      <MembersResolver params={params} />
    </Suspense>
  );
}

async function MembersResolver({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <MembersClient code={code} />;
}
