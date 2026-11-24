'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { RevealGroup, RevealItem } from '@/components/motion/reveal';
import { DURATION, EASE } from '@/lib/motion/tokens';
import { WorkspaceShell } from '@/components/ui/workspace-shell';
import {
  Button,
  ButtonLink,
  Chip,
  FIELD,
  FIELD_LABEL,
  SectionMark,
  Star,
} from '@/components/ui/primitives';

interface MemberRow {
  id: string;
  name: string;
}

/*
 * Route `/p/[code]/members` — member roster (FR-02).
 *
 * Behaviour is unchanged: one GET on mount, one POST with `{ name }`, the same
 * client-side validation, the same 2-member readiness rule, no member cap.
 *
 * Visual language: Catalis. A Mist plate holds the roster register; an azure
 * tint marks the readiness state; the add form sits on the canvas with a
 * hairline, not in a floating card.
 */

export default function MembersClient({ code }: { code: string }) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();

  async function loadMembers() {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(code)}/members`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Gagal memuat daftar anggota.');
        return;
      }
      setError(null);
      setMembers(json);
    } catch {
      setError('Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadMembers();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Nama anggota wajib diisi.');
      return;
    }
    if (trimmed.length > 60) {
      setError('Nama anggota maksimal 60 karakter.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(code)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Gagal menambahkan anggota.');
        return;
      }

      setName('');
      await loadMembers();
    } catch {
      setError('Terjadi kesalahan jaringan. Periksa koneksi Anda.');
    } finally {
      setSubmitting(false);
    }
  }

  const ready = members.length >= 2;

  return (
    <WorkspaceShell
      code={code}
      actions={
        ready ? (
          <ButtonLink
            href={`/p/${encodeURIComponent(code)}/result`}
            variant="accent"
            size="sm"
          >
            Matriks rekomendasi →
          </ButtonLink>
        ) : null
      }
    >
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-20 sm:px-8 lg:px-16">
        {/* Page statement. Same editorial voice as the homepage: a star, an
            eyebrow, one display line with a single italic champagne word. */}
        <RevealGroup className="flex flex-col justify-between gap-6 border-b border-line py-10 sm:flex-row sm:items-end lg:py-14">
          <div className="space-y-3">
            <RevealItem>
              <SectionMark>FR-02 · Anggota</SectionMark>
            </RevealItem>
            <RevealItem
              as="h1"
              className="display text-[clamp(1.9rem,3.6vw,2.75rem)] text-ink"
            >
              Anggota <span className="accent-word">kelompok</span>
            </RevealItem>
            <RevealItem as="p" className="max-w-[58ch] text-[13.5px] leading-relaxed text-muted">
              Tambahkan setiap anggota, lalu isi skill, minat, dan kapasitas jamnya. Minimal dua
              anggota diperlukan sebelum rekomendasi bisa dihitung. Tidak ada batas jumlah anggota.
            </RevealItem>
          </div>

          {/* Count + readiness, as two figures split by a hairline. The count is
              the page's largest number on purpose: it is the one quantity a
              reader checks at a glance, so it carries more weight than any card
              heading below it. */}
          <RevealItem className="flex shrink-0 items-stretch gap-6">
            <div className="pr-6">
              <p className="eyebrow">Total</p>
              <p
                className="mt-1.5 font-mono text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink"
                data-numeric
              >
                {members.length}
              </p>
              <p className="mt-1 text-[10.5px] text-muted">anggota</p>
            </div>
            <div className="border-l border-line pl-6">
              <p className="eyebrow">Status</p>
              <p
                className={`mt-1.5 text-[13px] font-semibold leading-tight ${ready ? 'text-ok' : 'text-warn'}`}
              >
                {ready ? 'Cukup' : 'Butuh 1 lagi'}
              </p>
              <p className="mt-1 text-[10.5px] text-muted">untuk menghitung</p>
            </div>
          </RevealItem>
        </RevealGroup>

        {/*
          Group structure strip (T-5.04). The audit found this page completely
          static under scroll: it explained the roster with a table and nothing
          else. This bar is the one scroll-linked device, and it earns its place
          by answering the question the page is actually about: how many people
          are there, and how much of the group is ready. Each person is one
          segment; segments light up left to right as the section crosses the
          viewport. It is `aria-hidden` because every number in it is already
          present as real text beside it, and it is not rendered at all under
          reduced motion.
        */}
        <MemberStructureBar members={members.length} ready={ready} reduced={reduced} />


        <div className="grid grid-cols-1 items-start gap-8 pt-8 md:grid-cols-12 md:gap-10 lg:pt-10">
          {/* Add member. On the canvas, hairline outline, sticky while the
              roster scrolls past. */}
          <RevealGroup className="md:col-span-4 md:sticky md:top-24">
            <div className="glass-panel rounded-[var(--radius-card)] p-5">
              <div className="mb-4 flex items-center gap-2">
                <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-[8px] bg-ink">
                  <Star className="h-2.5 w-2.5 text-accent-ink" />
                </span>
                <h2 className="heading text-[15px] text-ink">Anggota baru</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="member-name" className={FIELD_LABEL}>
                    Nama panggilan <span className="text-danger">*</span>
                  </label>
                  <input
                    id="member-name"
                    type="text"
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Rani"
                    aria-invalid={Boolean(error)}
                    className={`${FIELD} h-10`}
                  />
                </div>

                {/* No `initial={false}`: it would suppress the entrance animation
                    of the *first* banner, which is exactly the common case. */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      key="err"
                      role="alert"
                      data-motion-reveal=""
                      initial={reduced ? false : { opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0 }}
                      transition={{ duration: reduced ? 0 : DURATION.feedback, ease: EASE.out }}
                      className="rounded-[var(--radius-input)] bg-danger-surface px-3 py-2 text-[12px] font-medium text-danger shadow-[inset_0_0_0_1px_var(--danger)]"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <Button type="submit" variant="accent" size="md" disabled={submitting} className="w-full">
                  {submitting && (
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                    />
                  )}
                  {submitting ? 'Menyimpan…' : 'Tambah anggota'}
                </Button>
              </form>

              <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-muted">
                Setelah ditambahkan, buka profil anggota untuk mengisi skill 1–5, minat, dan
                kapasitas jam.
              </p>
            </div>
          </RevealGroup>

          {/* Roster register. A table, because this is a work tool: aligned
              columns beat cards when you scan six names for a missing profile. */}
          <div className="space-y-4 md:col-span-8">
            <div className="flex items-baseline justify-between">
              <h2 className="heading text-[15px] text-ink">Daftar & status profil</h2>
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fog" data-numeric>
                {members.length} baris
              </span>
            </div>

            {loading ? (
              <div
                className="glass-solid overflow-hidden rounded-[var(--radius-card)]"
                aria-busy="true"
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0"
                  >
                    <div className="h-3 w-32 animate-pulse rounded bg-line" />
                    <div className="h-3 w-20 animate-pulse rounded bg-line" />
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="glass-solid rounded-[var(--radius-card)] px-6 py-10">
                <p className="heading text-[15px] text-ink">Belum ada anggota</p>
                <p className="mt-1.5 max-w-[52ch] text-[12.5px] leading-relaxed text-muted">
                  Mulai dengan menambahkan anggota pertama lewat formulir di samping. Minimal dua
                  anggota diperlukan untuk menghitung rekomendasi.
                </p>
              </div>
            ) : (
              <div className="glass-solid overflow-hidden rounded-[var(--radius-card)]">
                <table className="w-full text-left">
                  <caption className="sr-only">Daftar anggota kelompok</caption>
                  <thead>
                    <tr className="border-b border-line bg-mist text-[10.5px] uppercase tracking-[0.1em] text-muted">
                      <th scope="col" className="w-14 px-5 py-2.5 font-medium">
                        No
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Nama
                      </th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">
                        Profil
                      </th>
                    </tr>
                  </thead>
                  <RevealGroup as="tbody">
                    {members.map((member, index) => (
                      <RevealItem
                        as="tr"
                        key={member.id}
                        className="group border-b border-line transition-colors duration-200 last:border-b-0 hover:bg-accent-tint/40"
                      >
                        <td className="px-5 py-3 font-mono text-[11px] tabular-nums text-fog" data-numeric>
                          {String(index + 1).padStart(2, '0')}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[14px] font-medium tracking-[-0.01em] text-ink">
                            {member.name}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/p/${encodeURIComponent(code)}/members/${encodeURIComponent(member.id)}`}
                            className="inline-flex h-7 items-center gap-1 rounded-full bg-card px-3 text-[11.5px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[box-shadow,background-color] duration-200 hover:bg-accent-tint hover:text-accent hover:shadow-[inset_0_0_0_1px_var(--accent)]"
                          >
                            Atur profil
                            <span aria-hidden="true">→</span>
                          </Link>
                        </td>
                      </RevealItem>
                    ))}
                  </RevealGroup>
                </table>
              </div>
            )}

            {ready && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-accent-tint px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <Star className="h-3 w-3" />
                  <p className="text-[12.5px] leading-relaxed text-ink">
                    Anggota sudah cukup. Lanjutkan menyusun daftar tugas proyek.
                  </p>
                </div>
                <ButtonLink href={`/p/${encodeURIComponent(code)}/tasks`} variant="solid" size="sm">
                  Kelola tugas →
                </ButtonLink>
              </div>
            )}

            {!ready && members.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 text-[12px] leading-relaxed text-muted">
                <Chip tone="muted">Butuh {2 - members.length} anggota lagi</Chip>
                <span>Rekomendasi membandingkan antaranggota, jadi minimal dua orang diperlukan.</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </WorkspaceShell>
  );
}

/**
 * Group structure strip: one segment per member.
 *
 * It sits directly under the page statement because it is orientation, not
 * data: at a glance the reader sees the size of the group and whether it is
 * ready. Segments fill left to right on a single in-view pass.
 *
 * The fill is a `whileInView` entrance rather than a scroll-linked scale. This
 * was measured, not assumed: the members page has zero scrollable distance at
 * 1440x900 (and only 48px at 700px tall), so any scroll-linked bar was pinned at
 * one value and read as static. A one-shot draw communicates the same thing and
 * always completes. Under reduced motion the segments render at full width with
 * no animation.
 */
function MemberStructureBar({
  members,
  ready,
  reduced,
}: {
  members: number;
  ready: boolean;
  reduced: boolean;
}) {
  // Enough segments to read as a group without turning into a data chart.
  const segments = Math.max(members, 2);
  const summary = `${members} anggota${ready ? ' · siap dihitung' : ' · belum cukup'}`;

  if (reduced) {
    return (
      <div className="mt-8 flex items-center gap-3">
        <span className="eyebrow">Struktur</span>
        <span className="font-mono text-[11.5px] tabular-nums text-muted" data-numeric>
          {summary}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="eyebrow shrink-0">Struktur</span>
      <span aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <motion.span
            key={i}
            className="h-1 flex-1 origin-left rounded-full"
            data-motion-scroll=""
            style={{
              backgroundColor: 'var(--accent-strong)',
              opacity: 0.45 + 0.55 * (i / segments),
            }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: DURATION.reveal, ease: EASE.out, delay: i * 0.06 }}
          />
        ))}
      </span>
      <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-muted" data-numeric>
        {summary}
      </span>
    </div>
  );
}
