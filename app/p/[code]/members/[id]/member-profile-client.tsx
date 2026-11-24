'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { memberProfileSchema } from '@/lib/validation';
import { DURATION, EASE } from '@/lib/motion/tokens';
import { WorkspaceShell } from '@/components/ui/workspace-shell';
import { RevealGroup, RevealItem } from '@/components/motion/reveal';
import {
  Button,
  ButtonLink,
  FIELD,
  FIELD_LABEL,
  Panel,
  SectionMark,
} from '@/components/ui/primitives';

interface SkillItem {
  skill_name: string;
  skill_level: number;
  interest_level: number;
}

/*
 * Route `/p/[code]/members/[id]` — member profile (FR-03). Same validation,
 * same endpoints, same field limits. Restyled only: the skill rows become
 * numbered registers, the level pickers keep their native <select> so keyboard
 * and mobile behaviour is untouched.
 */

const LEVEL_LABEL = ['Pemula', 'Dasar', 'Menengah', 'Mahir', 'Ahli'];
const INTEREST_LABEL = ['Sangat Rendah', 'Rendah', 'Sedang', 'Tinggi', 'Sangat Tinggi'];

export default function MemberProfileClient({ code, id }: { code: string; id: string }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [capacity, setCapacity] = useState<number | string>(40);
  const [skills, setSkills] = useState<SkillItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setFetchError(null);
        const res = await fetch(
          `/api/projects/${encodeURIComponent(code)}/members/${encodeURIComponent(id)}`
        );
        const json = await res.json();

        if (!res.ok) {
          setFetchError(json.error || 'Gagal memuat profil anggota.');
          return;
        }

        setName(json.name || '');
        setNote(json.note || '');
        setCapacity(json.capacity ?? 40);
        setSkills(
          Array.isArray(json.skills)
            ? json.skills.map((s: SkillItem) => ({
                skill_name: s.skill_name || '',
                skill_level: Number(s.skill_level) || 3,
                interest_level: Number(s.interest_level) || 3,
              }))
            : []
        );
      } catch {
        setFetchError('Terjadi kesalahan jaringan saat memuat data.');
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [code, id]);

  function handleAddSkill() {
    setSkills((prev) => [...prev, { skill_name: '', skill_level: 3, interest_level: 3 }]);
  }

  function handleRemoveSkill(index: number) {
    setSkills((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSkillChange<K extends keyof SkillItem>(
    index: number,
    field: K,
    value: SkillItem[K]
  ) {
    setSkills((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const capacityNum = Number(capacity);
    const trimmedNote = note.trim();
    const normalizedNote = trimmedNote === '' ? null : trimmedNote;

    const payload = {
      name: name.trim(),
      note: normalizedNote,
      capacity: capacityNum,
      skills: skills.map((s) => ({
        skill_name: s.skill_name.trim(),
        skill_level: Number(s.skill_level),
        interest_level: Number(s.interest_level),
      })),
    };

    const parsed = memberProfileSchema.safeParse(payload);
    if (!parsed.success) {
      const formatted = parsed.error.format();
      if (formatted.name?._errors.length) {
        setSubmitError(`Nama: ${formatted.name._errors.join(', ')}`);
        return;
      }
      if (formatted.capacity?._errors.length) {
        setSubmitError('Kapasitas waktu harus berupa angka bulat positif.');
        return;
      }
      if (formatted.note?._errors.length) {
        setSubmitError('Catatan maksimal 300 karakter.');
        return;
      }
      if (formatted.skills?._errors.length) {
        setSubmitError('Pastikan seluruh nama keterampilan terisi dengan benar.');
        return;
      }
      setSubmitError('Data profil anggota tidak valid. Periksa kembali isian Anda.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(code)}/members/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Gagal memperbarui profil anggota.');
        return;
      }

      setSuccessMessage('Profil anggota berhasil diperbarui.');
      setName(json.name || '');
      setNote(json.note || '');
      setCapacity(json.capacity ?? 40);
      setSkills(
        Array.isArray(json.skills)
          ? json.skills.map((s: SkillItem) => ({
              skill_name: s.skill_name || '',
              skill_level: Number(s.skill_level) || 3,
              interest_level: Number(s.interest_level) || 3,
            }))
          : []
      );
    } catch {
      setSubmitError('Terjadi kesalahan jaringan. Periksa koneksi Anda.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <WorkspaceShell code={code}>
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-8" aria-busy="true">
          <div className="space-y-3">
            <div className="h-3 w-24 animate-pulse rounded bg-line" />
            <div className="h-8 w-56 animate-pulse rounded bg-line" />
          </div>
          <p className="mt-4 font-mono text-[11.5px] text-fog">Memuat profil anggota…</p>
        </main>
      </WorkspaceShell>
    );
  }

  if (fetchError) {
    return (
      <WorkspaceShell code={code}>
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-8">
          <div
            role="alert"
            className="space-y-3 rounded-[var(--radius-card)] bg-danger-surface p-5 shadow-[inset_0_0_0_1px_var(--danger)]"
          >
            <p className="text-[13px] text-danger">{fetchError}</p>
            <ButtonLink href={`/p/${encodeURIComponent(code)}/members`} variant="danger" size="sm">
              Kembali ke daftar anggota
            </ButtonLink>
          </div>
        </main>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      code={code}
      actions={
        <ButtonLink
          href={`/p/${encodeURIComponent(code)}/members`}
          variant="outline"
          size="sm"
        >
          ← Daftar anggota
        </ButtonLink>
      }
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:px-8 sm:py-14">
        <RevealGroup className="space-y-3 border-b border-line pb-7">
          <RevealItem>
            <SectionMark>FR-03 · Profil</SectionMark>
          </RevealItem>
          <RevealItem as="h1" className="display text-[clamp(1.75rem,3.4vw,2.4rem)] text-ink">
            Profil <span className="accent-word">anggota</span>
          </RevealItem>
          <RevealItem as="p" className="max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
            Atur nama panggilan, ketersediaan waktu, catatan, dan daftar keterampilan anggota untuk
            keperluan perhitungan rekomendasi tugas.
          </RevealItem>
        </RevealGroup>

        <div className="space-y-3 pt-6">
          {/* No `initial={false}`: it would suppress the entrance animation of the
              first banner, which is exactly the common case. */}
          <AnimatePresence mode="popLayout">
            {successMessage && (
              <motion.div
                key="ok"
                role="status"
                data-motion-reveal=""
                initial={reduced ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: reduced ? 0 : DURATION.feedback, ease: EASE.out }}
                className="rounded-[var(--radius-input)] bg-ok-surface px-3.5 py-2.5 text-[12.5px] font-medium text-ok shadow-[inset_0_0_0_1px_var(--ok)]"
              >
                {successMessage}
              </motion.div>
            )}
            {submitError && (
              <motion.div
                key="err"
                role="alert"
                data-motion-reveal=""
                initial={reduced ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: reduced ? 0 : DURATION.feedback, ease: EASE.out }}
                className="rounded-[var(--radius-input)] bg-danger-surface px-3.5 py-2.5 text-[12.5px] font-medium text-danger shadow-[inset_0_0_0_1px_var(--danger)]"
              >
                {submitError}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4" noValidate>
          {/* Identity + capacity */}
          <Panel eyebrow="Identitas" title="Data dasar" bodyClassName="space-y-4 p-5">
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
                required
                className={`${FIELD} h-10`}
              />
              <span className="block font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
                {name.length}/60 karakter
              </span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="member-capacity" className={FIELD_LABEL}>
                Kapasitas waktu (jam per minggu) <span className="text-danger">*</span>
              </label>
              <input
                id="member-capacity"
                type="number"
                min={1}
                step={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
                className={`${FIELD} h-10 font-mono tabular-nums sm:w-48`}
              />
              <p className="text-[11px] leading-relaxed text-muted">
                Estimasi total jam kerja yang dapat dialokasikan anggota per minggu (minimal 1 jam).
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="member-note" className={FIELD_LABEL}>
                Catatan tambahan (opsional)
              </label>
              <textarea
                id="member-note"
                maxLength={300}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Preferensi pengerjaan tugas frontend atau penulisan dokumen."
                className={`${FIELD} resize-y py-2.5 leading-relaxed`}
              />
              <span className="block font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
                {note.length}/300 karakter
              </span>
            </div>
          </Panel>

          {/* Skills register */}
          <Panel
            eyebrow="FR-03"
            title="Daftar keterampilan"
            bodyClassName="space-y-3 p-5"
            action={
              <Button type="button" variant="outline" size="sm" onClick={handleAddSkill}>
                + Tambah keterampilan
              </Button>
            }
          >
            <p className="text-[11.5px] leading-relaxed text-muted">
              Tentukan keterampilan, tingkat kemampuan (1–5), dan minat (1–5).
            </p>

            {skills.length === 0 ? (
              <div className="rounded-[var(--radius-input)] bg-mist px-4 py-7 text-center shadow-[inset_0_0_0_1px_var(--line)]">
                <p className="heading text-[13.5px] text-ink">Belum ada keterampilan</p>
                <p className="mt-1 text-[11.5px] text-muted">
                  Klik tombol di atas untuk menambahkan.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-input)] bg-mist shadow-[inset_0_0_0_1px_var(--line)]">
                {skills.map((skill, index) => (
                  <li key={index} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <span
                        aria-hidden="true"
                        className="mt-2.5 hidden font-mono text-[11px] tabular-nums text-fog sm:block"
                        data-numeric
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      <div className="flex-1 space-y-2.5">
                        <div className="space-y-1">
                          <label
                            htmlFor={`skill-name-${index}`}
                            className="block text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted"
                          >
                            Keterampilan #{index + 1}
                          </label>
                          <input
                            id={`skill-name-${index}`}
                            type="text"
                            value={skill.skill_name}
                            onChange={(e) => handleSkillChange(index, 'skill_name', e.target.value)}
                            placeholder="Contoh: Frontend, Python, Desain UI"
                            className={`${FIELD} h-9`}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label
                              htmlFor={`skill-level-${index}`}
                              className="block text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted"
                            >
                              Kemampuan (1–5)
                            </label>
                            <select
                              id={`skill-level-${index}`}
                              value={skill.skill_level}
                              onChange={(e) =>
                                handleSkillChange(index, 'skill_level', Number(e.target.value))
                              }
                              className={`${FIELD} h-9 cursor-pointer pr-8 font-mono tabular-nums`}
                            >
                              {LEVEL_LABEL.map((label, i) => (
                                <option key={label} value={i + 1}>
                                  {i + 1} - {label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label
                              htmlFor={`interest-level-${index}`}
                              className="block text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted"
                            >
                              Minat (1–5)
                            </label>
                            <select
                              id={`interest-level-${index}`}
                              value={skill.interest_level}
                              onChange={(e) =>
                                handleSkillChange(index, 'interest_level', Number(e.target.value))
                              }
                              className={`${FIELD} h-9 cursor-pointer pr-8 font-mono tabular-nums`}
                            >
                              {INTEREST_LABEL.map((label, i) => (
                                <option key={label} value={i + 1}>
                                  {i + 1} - {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveSkill(index)}
                        className="self-end sm:self-start"
                        aria-label={`Hapus keterampilan ${skill.skill_name || index + 1}`}
                      >
                        Hapus
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Actions */}
          <div className="flex flex-col-reverse items-stretch justify-end gap-2.5 border-t border-line pt-5 sm:flex-row sm:items-center">
            <Link
              href={`/p/${encodeURIComponent(code)}/members`}
              className="inline-flex h-9 items-center justify-center rounded-full bg-card px-4 text-[12.5px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[box-shadow,background-color] duration-200 hover:bg-mist hover:shadow-[inset_0_0_0_1px_var(--ink)]"
            >
              Batal
            </Link>
            <Button type="submit" variant="accent" disabled={submitting} className="px-5">
              {submitting ? 'Menyimpan…' : 'Simpan profil'}
            </Button>
          </div>
        </form>
      </main>
    </WorkspaceShell>
  );
}
