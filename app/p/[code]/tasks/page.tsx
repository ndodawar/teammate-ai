import { Suspense } from 'react';
import TasksClient from './tasks-client';

export default function TasksPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper px-4 py-6 sm:px-6" aria-busy="true">
          <p className="font-mono text-[12px] text-muted">Memuat manajemen tugas…</p>
        </div>
      }
    >
      <TasksResolver params={params} />
    </Suspense>
  );
}

async function TasksResolver({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TasksClient code={code} />;
}
