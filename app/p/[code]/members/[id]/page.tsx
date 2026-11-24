import { Suspense } from 'react';
import MemberProfileClient from './member-profile-client';

export default function MemberProfilePage({ params }: { params: Promise<{ code: string; id: string }> }) {
  return (
    <Suspense
      fallback={
        <p className="p-4 text-sm text-zinc-600 dark:text-zinc-400">Memuat profil anggota...</p>
      }
    >
      <MemberProfileResolver params={params} />
    </Suspense>
  );
}

async function MemberProfileResolver({ params }: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await params;
  return <MemberProfileClient code={code} id={id} />;
}
