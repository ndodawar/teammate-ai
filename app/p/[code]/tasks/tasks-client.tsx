'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion/use-reduced-motion';
import { taskSchema } from '@/lib/validation';
import { SKILL_TAXONOMY } from '@/lib/scoring/types';
import { DURATION, EASE } from '@/lib/motion/tokens';
import { WorkspaceShell } from '@/components/ui/workspace-shell';
import { RevealGroup, RevealItem } from '@/components/motion/reveal';
import {
  Button,
  ButtonLink,
  Chip,
  DateField,
  FIELD,
  FIELD_LABEL,
  Panel,
  SectionMark,
} from '@/components/ui/primitives';
import {
  draftFromTask,
  EMPTY_DRAFT,
  errorMessage,
  isValidHours,
  type TaskDraft,
  type TaskItem,
  type TemplateDraftItem,
} from './task-draft';

/*
 * Route `/p/[code]/tasks` — task management (FR-04/FR-05) plus AI analysis
 * (FR-06) and template loading. Every handler, endpoint, validation call and
 * state transition below is unchanged; only the presentation is from the
 * Fuelplate-derived system: paper surfaces, hairline chips, a dense register.
 */
export default function TasksClient({ code }: { code: string }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  /* T-FIX-API-01: field-level error, shown under the description box itself. */
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [templateDrafts, setTemplateDrafts] = useState<TemplateDraftItem[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [proposedAnalyses, setProposedAnalyses] = useState<
    { taskId: string; requiredSkills: string[]; effort: number; note?: string }[]
  >([]);
  const reduced = usePrefersReducedMotion();

  const loadTasks = useCallback(async () => {
    const res = await fetch(`/api/projects/${encodeURIComponent(code)}/tasks`);
    const json = await res.json();
    if (!res.ok) {
      setLoadError(json.error || 'Gagal memuat daftar tugas.');
      return;
    }
    setLoadError(null);
    setTasks(Array.isArray(json) ? json : []);
  }, [code]);

  useEffect(() => {
    void (async () => {
      await loadTasks();
      setLoading(false);
    })();
  }, [loadTasks]);

  function toggleSkill(skill: string) {
    setDraft((prev) => ({
      ...prev,
      required_skills: prev.required_skills.includes(skill)
        ? prev.required_skills.filter((s) => s !== skill)
        : [...prev.required_skills, skill],
    }));
  }

  function resetForm() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setFormError(null);
  }

  function startEdit(task: TaskItem) {
    setDraft(draftFromTask(task));
    setEditingId(task.id);
    setFormError(null);
    setStatusMessage(null);
    setActionError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setDescriptionError(null);
    setActionError(null);
    setStatusMessage(null);

    /*
     * The description is required by PRD US-06, so it is sent as the text the
     * user typed (trimmed) rather than as null. Sending null here was how a
     * blank description reached the API and came back as a raw schema error.
     */
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      effort: Number(draft.effort),
      estimated_hours: draft.estimated_hours.trim() === '' ? NaN : Number(draft.estimated_hours),
      due_date: draft.due_date === '' ? null : draft.due_date,
      required_skills: draft.required_skills,
      locked: draft.locked,
      source: draft.source,
    };

    const parsed = taskSchema.safeParse(payload);
    if (!parsed.success) {
      /* Put the message on the field it belongs to, not only in a banner above
         the form, so the reader does not have to hunt for the box at fault. */
      const descriptionIssue = parsed.error.issues.find((issue) => issue.path[0] === 'description');
      if (descriptionIssue) {
        setDescriptionError(descriptionIssue.message);
      }
      setFormError(parsed.error.issues[0]?.message || 'Data tugas tidak valid.');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId
        ? `/api/projects/${encodeURIComponent(code)}/tasks/${encodeURIComponent(editingId)}`
        : `/api/projects/${encodeURIComponent(code)}/tasks`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || 'Gagal menyimpan tugas.');
        return;
      }

      setStatusMessage(editingId ? 'Perubahan tugas tersimpan.' : 'Tugas baru ditambahkan.');
      resetForm();
      await loadTasks();
    } catch (cause) {
      setActionError(errorMessage(cause, 'Terjadi kesalahan jaringan saat menyimpan tugas.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoadTemplates() {
    setActionError(null);
    setStatusMessage(null);
    setTemplateLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(code)}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load_templates' }),
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json)) {
        setTemplateDrafts(json);
        setStatusMessage(
          'Template berhasil dimuat sebagai draft. Harap lengkapi estimasi jam untuk setiap tugas.'
        );
        return;
      }
      if (!res.ok) {
        setActionError(json.error || 'Gagal memuat template.');
        return;
      }
      setStatusMessage('Template tugas berhasil dimuat.');
      await loadTasks();
    } catch (cause) {
      setActionError(errorMessage(cause, 'Terjadi kesalahan jaringan saat memuat template.'));
    } finally {
      setTemplateLoading(false);
    }
  }

  async function handleAiAnalysis() {
    if (tasks.length === 0) {
      setActionError('Tambahkan tugas terlebih dahulu sebelum menjalankan analisis AI.');
      return;
    }

    const tasksToAnalyze = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || '',
    }));

    setActionError(null);
    setStatusMessage(null);
    setAnalyzing(true);

    try {
      const res = await fetch('/api/analyze-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: tasksToAnalyze }),
      });

      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || 'Gagal menjalankan analisis AI.');
        return;
      }

      const analyses = json.analyses;
      // PRD: "Hasil yang belum dikonfirmasi tidak langsung digunakan". The model's
      // suggestion is shown for review and only written once the user confirms;
      // AI never changes a task on its own.
      setProposedAnalyses(
        (analyses as Array<{ taskId: string; requiredSkills: string[]; effort: number; note?: string }>)
          .filter((analysis) => tasks.some((t) => t.id === analysis.taskId))
      );
      setStatusMessage(`Analisis AI selesai. Tinjau saran untuk ${analyses.length} tugas sebelum menyimpan.`);
    } catch (cause) {
      setActionError(errorMessage(cause, 'Terjadi kesalahan jaringan saat analisis AI.'));
    } finally {
      setAnalyzing(false);
    }
  }

  /** Writes the reviewed AI suggestions. Only ever called from a user action. */
  async function handleApplyAnalyses() {
    setActionError(null);
    setStatusMessage(null);
    setAnalyzing(true);

    try {
      let appliedCount = 0;
      for (const analysis of proposedAnalyses) {
        const task = tasks.find((t) => t.id === analysis.taskId);
        if (!task) continue;

        const updateRes = await fetch(
          `/api/projects/${encodeURIComponent(code)}/tasks/${encodeURIComponent(analysis.taskId)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...task,
              required_skills: analysis.requiredSkills,
              effort: analysis.effort,
            }),
          }
        );
        if (updateRes.ok) appliedCount++;
      }

      setProposedAnalyses([]);
      setStatusMessage(`${appliedCount} tugas diperbarui sesuai saran analisis AI.`);
      await loadTasks();
    } catch (cause) {
      setActionError(errorMessage(cause, 'Terjadi kesalahan jaringan saat menyimpan saran AI.'));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDelete(task: TaskItem) {
    const confirmed = window.confirm(`Hapus tugas "${task.title}" dari proyek ini?`);
    if (!confirmed) return;

    setActionError(null);
    setStatusMessage(null);
    setDeletingId(task.id);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(code)}/tasks/${encodeURIComponent(task.id)}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || 'Gagal menghapus tugas.');
        return;
      }
      if (editingId === task.id) resetForm();
      setStatusMessage(`Tugas "${task.title}" dihapus.`);
      await loadTasks();
    } catch (cause) {
      setActionError(errorMessage(cause, 'Terjadi kesalahan jaringan saat menghapus tugas.'));
    } finally {
      setDeletingId(null);
    }
  }

  const busy = templateLoading || analyzing;

  return (
    <WorkspaceShell
      code={code}
      actions={
        <ButtonLink
          href={`/p/${encodeURIComponent(code)}/result`}
          variant="accent"
          size="sm"
        >
          Matriks rekomendasi →
        </ButtonLink>
      }
    >
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-20 sm:px-8 lg:px-16">
        {/* Page statement + primary tools. The header gets a short reveal and
            nothing below it does: this page is a form, and a form that animates
            while you type is a form that gets in your way. */}
        <RevealGroup className="flex flex-col justify-between gap-5 border-b border-line py-10 lg:flex-row lg:items-end lg:py-14">
          <div className="space-y-3">
            <RevealItem>
              <SectionMark>FR-04 · FR-05 · FR-06</SectionMark>
            </RevealItem>
            <RevealItem as="h1" className="display text-[clamp(1.9rem,3.6vw,2.75rem)] text-ink">
              Kelola <span className="accent-word">tugas</span>
            </RevealItem>
            <RevealItem as="p" className="max-w-[58ch] text-[13.5px] leading-relaxed text-muted">
              Tugas template dimuat dari katalog 11 tugas. Keterampilan dan bobot usaha diisi manual di
              sini, atau disarankan lewat analisis AI yang tetap bisa Anda koreksi.
            </RevealItem>
            {/* Two figures, hairline-split, same treatment as the members page: a
                reader checks how many tasks exist and how much work they add up
                to before reading any row, so those numbers carry more weight
                than the list heading below them. Both are tabular so they do not
                jitter as tasks are added. */}
            <RevealItem as="div" className="flex items-stretch gap-6 pt-1">
              <div className="pr-6">
                <p className="eyebrow">Tugas</p>
                <p
                  className="mt-1.5 font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink"
                  data-numeric
                >
                  {tasks.length}
                </p>
                <p className="mt-1 text-[10.5px] text-muted">baris</p>
              </div>
              <div className="border-l border-line pl-6">
                <p className="eyebrow">Total beban</p>
                <p
                  className="mt-1.5 font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink"
                  data-numeric
                >
                  {tasks.reduce((sum, task) => sum + (Number(task.estimated_hours) || 0), 0)}
                </p>
                <p className="mt-1 text-[10.5px] text-muted">jam</p>
              </div>
            </RevealItem>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="md" onClick={handleLoadTemplates} disabled={busy}>
              {templateLoading ? 'Memuat template…' : 'Muat 11 template'}
            </Button>
            <Button
              type="button"
              variant="solid"
              size="md"
              onClick={handleAiAnalysis}
              disabled={busy || tasks.length === 0}
            >
              {analyzing ? 'Menganalisis…' : 'Analisis semua dengan AI'}
            </Button>
          </div>
        </RevealGroup>

        {/* Progress for the AI run: single non-decorative indicator (PRD §12.7 / NFR-49). */}
        {analyzing && (
          <div className="pt-5" aria-live="polite">
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-cloud">
              <motion.div
                className="h-full w-1/3 origin-left rounded-full bg-accent"
                animate={reduced ? { x: 0 } : { x: ['-100%', '300%'] }}
                transition={reduced ? { duration: 0 } : { duration: 1.2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <p className="mt-2 font-mono text-[10.5px] text-muted">
              Menganalisis {tasks.length} tugas, maksimal 3 panggilan Gemini per proses.
            </p>
          </div>
        )}

        {/* Status banners */}
        <div className="space-y-2.5 pt-5">
          {/* No `initial={false}`: it would suppress the entrance animation of the
              first banner, which is exactly the common case. */}
          <AnimatePresence mode="popLayout">
            {statusMessage && (
              <motion.div
                key="status"
                role="status"
                data-motion-reveal=""
                initial={reduced ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: reduced ? 0 : DURATION.feedback, ease: EASE.out }}
                className="rounded-[var(--radius-input)] bg-ok-surface px-3.5 py-2.5 text-[12.5px] font-medium text-ok shadow-[inset_0_0_0_1px_var(--ok)]"
              >
                {statusMessage}
              </motion.div>
            )}
            {actionError && (
              <motion.div
                key="action-error"
                role="alert"
                data-motion-reveal=""
                initial={reduced ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: reduced ? 0 : DURATION.feedback, ease: EASE.out }}
                className="rounded-[var(--radius-input)] bg-danger-surface px-3.5 py-2.5 text-[12.5px] font-medium text-danger shadow-[inset_0_0_0_1px_var(--danger)]"
              >
                {actionError}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FR-06: AI output is a suggestion until the user confirms it. */}
        {proposedAnalyses.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-[var(--radius-card)] bg-accent-tint">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3.5">
              <h2 className="heading text-[15px] text-ink">Saran analisis AI</h2>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted" data-numeric>
                {proposedAnalyses.length} menunggu konfirmasi
              </span>
            </header>
            <p className="px-5 pt-3 text-[12px] leading-relaxed text-muted">
              Skill dan effort di bawah adalah usulan AI. Belum ada yang disimpan sampai Anda menekan terapkan.
            </p>
            <ul className="divide-y divide-line pt-1">
              {proposedAnalyses.map((analysis) => {
                const task = tasks.find((t) => t.id === analysis.taskId);
                return (
                  <li key={analysis.taskId} className="flex flex-wrap items-center gap-2 px-5 py-3">
                    <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">
                      {task?.title ?? analysis.taskId}
                    </span>
                    <span className="text-[11.5px] text-muted">{analysis.requiredSkills.join(', ')}</span>
                    <span className="font-mono text-[11px] text-muted" data-numeric>
                      effort {analysis.effort}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2 px-5 py-3.5">
              <Button type="button" variant="solid" size="sm" onClick={handleApplyAnalyses} disabled={analyzing}>
                Terapkan saran
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProposedAnalyses([])}
                disabled={analyzing}
              >
                Batalkan
              </Button>
            </div>
          </section>
        )}

        {/* Template drafts: still one row per template, in a hairline register. */}
        {templateDrafts.length > 0 && (
          <section className="glass-solid mt-5 overflow-hidden rounded-[var(--radius-card)]">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-mist px-5 py-3.5">
              <h2 className="heading text-[15px] text-ink">Draft template</h2>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted" data-numeric>
                {templateDrafts.length} belum disimpan
              </span>
            </header>
            <p className="px-5 pt-3 text-[12px] leading-relaxed text-muted">
              Isi estimasi jam untuk setiap tugas, lalu simpan satu per satu.
            </p>
            <ul className="divide-y divide-line pt-1">
              {templateDrafts.map((tmpl) => {
                const invalid = Boolean(
                  tmpl.estimated_hours_input && !isValidHours(tmpl.estimated_hours_input)
                );
                return (
                  <li
                    key={tmpl.template_id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3"
                  >
                    <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">{tmpl.title}</span>
                    <div className="flex flex-col">
                      <label htmlFor={`hours-${tmpl.template_id}`} className="sr-only">
                        Estimasi jam untuk {tmpl.title}
                      </label>
                      <input
                        id={`hours-${tmpl.template_id}`}
                        type="number"
                        step="1"
                        min="1"
                        placeholder="Jam"
                        aria-invalid={invalid}
                        className={`${FIELD} h-8 w-20 font-mono tabular-nums ${
                          invalid ? 'shadow-[inset_0_0_0_2px_var(--danger)]' : ''
                        }`}
                        value={tmpl.estimated_hours_input || ''}
                        onChange={(e) => {
                          setTemplateDrafts((prev) =>
                            prev.map((t) =>
                              t.template_id === tmpl.template_id
                                ? { ...t, estimated_hours_input: e.target.value }
                                : t
                            )
                          );
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="solid"
                      size="sm"
                      disabled={
                        savingTemplateId === tmpl.template_id ||
                        !isValidHours(tmpl.estimated_hours_input || '')
                      }
                      onClick={async () => {
                        setSavingTemplateId(tmpl.template_id);
                        const payload = {
                          title: tmpl.title,
                          description: tmpl.description,
                          effort: tmpl.effort,
                          estimated_hours: Number(tmpl.estimated_hours_input),
                          required_skills: tmpl.required_skills,
                          locked: tmpl.locked,
                          source: 'template',
                        };
                        try {
                          const res = await fetch(`/api/projects/${encodeURIComponent(code)}/tasks`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                          });
                          if (!res.ok) throw new Error('Gagal menyimpan.');
                          setTemplateDrafts(prev => prev.filter(t => t.template_id !== tmpl.template_id));
                          await loadTasks();
                        } catch (cause) {
                          setActionError(errorMessage(cause, 'Gagal menyimpan tugas template.'));
                        } finally {
                          setSavingTemplateId(null);
                        }
                      }}
                    >
                      Simpan
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Task register */}
        <section className="mt-10 space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="heading text-[17px] text-ink">Daftar tugas</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fog" data-numeric>
              {tasks.length} baris
            </span>
          </div>

          {/*
            Workload strip (T-5.04). The audit found this page static: five motion
            elements, none of them responding to scroll. This strip is the only
            scroll-linked device added, and it earns its place because it is about
            the thing this page is for: how much work each task carries, summed.
            It is `aria-hidden` (the same total is printed as text beside it) and
            it never touches the form, the list, or any input.
          */}
          <TaskWorkloadStrip tasks={tasks} reduced={reduced} />

          {loadError ? (
            <div
              role="alert"
              className="space-y-2.5 rounded-[var(--radius-card)] bg-danger-surface p-5 shadow-[inset_0_0_0_1px_var(--danger)]"
            >
              <p className="text-[12.5px] text-danger">{loadError}</p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  void (async () => {
                    await loadTasks();
                    setLoading(false);
                  })();
                }}
              >
                Coba lagi
              </Button>
            </div>
          ) : loading ? (
            <div
              className="glass-solid overflow-hidden rounded-[var(--radius-card)]"
              aria-busy="true"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2 border-b border-line p-5 last:border-b-0">
                  <div className="h-3.5 w-48 animate-pulse rounded bg-line" />
                  <div className="h-2.5 w-full max-w-md animate-pulse rounded bg-line" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="glass-solid rounded-[var(--radius-card)] px-6 py-10">
              <p className="heading text-[15px] text-ink">Belum ada tugas</p>
              <p className="mt-1.5 max-w-[56ch] text-[12.5px] leading-relaxed text-muted">
                Muat 11 template tugas atau tambahkan tugas manual lewat formulir di bawah.
              </p>
            </div>
          ) : (
            <ol className="glass-solid overflow-hidden rounded-[var(--radius-card)]">
              {tasks.map((task, index) => (
                <motion.li
                  key={task.id}
                  data-motion-reveal=""
                  initial={reduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduced ? 0 : DURATION.data,
                    ease: EASE.out,
                    delay: reduced ? 0 : Math.min(index, 10) * 0.03,
                  }}
                  className={`border-b border-line p-4 transition-colors duration-200 last:border-b-0 hover:bg-mist/70 sm:p-5 ${
                    editingId === task.id
                      ? 'bg-accent-tint shadow-[inset_3px_0_0_0_var(--accent-strong)]'
                      : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="w-5 shrink-0 pt-0.5 font-mono text-[11px] tabular-nums text-fog"
                        data-numeric
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-medium leading-snug tracking-[-0.01em] break-words text-ink">
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed break-words text-muted">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button type="button" variant="outline" size="sm" onClick={() => startEdit(task)}>
                        Ubah
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDelete(task)}
                        disabled={deletingId === task.id}
                      >
                        {deletingId === task.id ? 'Menghapus…' : 'Hapus'}
                      </Button>
                    </div>
                  </div>

                  {/* Metadata as hairline chips, with tabular numerals. */}
                  <dl className="mt-3 flex flex-wrap items-center gap-1.5 pl-0 sm:pl-[32px]">
                    <div className="flex items-center gap-1">
                      <dt className="sr-only">Usaha</dt>
                      <dd>
                        <Chip tone="muted">
                          usaha{' '}
                          <span className="font-mono tabular-nums text-ink" data-numeric>
                            {task.effort ?? 3}/5
                          </span>
                        </Chip>
                      </dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt className="sr-only">Estimasi jam</dt>
                      <dd>
                        <Chip tone="muted">
                          <span className="font-mono tabular-nums text-ink" data-numeric>
                            {task.estimated_hours}
                          </span>{' '}
                          jam
                        </Chip>
                      </dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt className="sr-only">Sumber</dt>
                      <dd>
                        <Chip tone={task.source === 'template' ? 'accent' : 'muted'}>
                          {task.source === 'template' ? 'template' : 'manual'}
                        </Chip>
                      </dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt className="sr-only">Tenggat</dt>
                      <dd>
                        <Chip tone="muted">
                          <span className="font-mono tabular-nums" data-numeric>
                            {task.due_date ?? 'tanpa tenggat'}
                          </span>
                        </Chip>
                      </dd>
                    </div>
                    {task.locked && (
                      <div className="flex items-center gap-1">
                        <dt className="sr-only">Status kunci</dt>
                        <dd>
                          <Chip tone="accent">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className="h-2.5 w-2.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2.4}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                            terkunci
                          </Chip>
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-2 flex flex-wrap gap-1 pl-0 sm:pl-[32px]">
                    {(task.required_skills ?? []).length === 0 ? (
                      <span className="text-[11.5px] text-fog">Keterampilan belum ditentukan.</span>
                    ) : (
                      task.required_skills.map((skill) => (
                        <Chip key={skill} tone="neutral">
                          {skill}
                        </Chip>
                      ))
                    )}
                  </div>
                </motion.li>
              ))}
            </ol>
          )}
        </section>

        {/* Manual task form */}
        <section className="mt-10">
          <Panel
            eyebrow={editingId ? 'Mode ubah' : 'FR-04 · FR-05'}
            title={editingId ? 'Ubah tugas' : 'Tambah tugas manual'}
            bodyClassName="space-y-4 p-5"
            action={
              editingId ? (
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                  Batal ubah
                </Button>
              ) : null
            }
          >
            <p className="text-[12px] leading-relaxed text-muted">
              Isi keterampilan dan bobot usaha sesuai kebutuhan tugas. Gunakan tombol “Analisis semua
              dengan AI” di atas untuk mendapatkan saran otomatis.
            </p>

            {formError && (
              <div
                role="alert"
                className="rounded-[var(--radius-input)] bg-danger-surface px-3 py-2 text-[12.5px] font-medium text-danger shadow-[inset_0_0_0_1px_var(--danger)]"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="task-title" className={FIELD_LABEL}>
                  Judul tugas <span className="text-danger">*</span>
                </label>
                <input
                  id="task-title"
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Contoh: Menyusun Bab 2 Pembahasan"
                  required
                  className={`${FIELD} h-10`}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="task-description" className={FIELD_LABEL}>
                  Deskripsi <span className="text-danger">*</span>
                </label>
                <textarea
                  id="task-description"
                  rows={3}
                  maxLength={500}
                  value={draft.description}
                  onChange={(e) => {
                    setDraft((prev) => ({ ...prev, description: e.target.value }));
                    /* Clear the error as soon as the field holds real text, so the
                       message stops nagging before the next submit. */
                    if (descriptionError && e.target.value.trim() !== '') setDescriptionError(null);
                  }}
                  placeholder="Jelaskan lingkup pekerjaan tugas ini."
                  aria-invalid={descriptionError ? true : undefined}
                  aria-describedby={descriptionError ? 'task-description-error' : undefined}
                  className={`${FIELD} resize-y py-2.5 leading-relaxed ${
                    descriptionError ? 'shadow-[inset_0_0_0_1px_var(--danger)]' : ''
                  }`}
                />
                {descriptionError && (
                  <p
                    id="task-description-error"
                    role="alert"
                    className="text-[11.5px] font-medium text-danger"
                  >
                    {descriptionError}
                  </p>
                )}
                <span className="block text-right font-mono text-[10.5px] tabular-nums text-muted" data-numeric>
                  {draft.description.length}/500 karakter
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor="task-effort" className={FIELD_LABEL}>
                    Bobot usaha (1–5) <span className="text-danger">*</span>
                  </label>
                  <select
                    id="task-effort"
                    value={draft.effort}
                    onChange={(e) => setDraft((prev) => ({ ...prev, effort: e.target.value }))}
                    className={`${FIELD} h-10 cursor-pointer font-mono tabular-nums`}
                  >
                    <option value="1">1 - Sangat ringan</option>
                    <option value="2">2 - Ringan</option>
                    <option value="3">3 - Sedang</option>
                    <option value="4">4 - Berat</option>
                    <option value="5">5 - Sangat berat</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="task-estimated-hours" className={FIELD_LABEL}>
                    Estimasi jam <span className="text-danger">*</span>
                  </label>
                  <input
                    id="task-estimated-hours"
                    type="number"
                    step="1"
                    min="1"
                    value={draft.estimated_hours}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, estimated_hours: e.target.value }))
                    }
                    placeholder="Contoh: 4"
                    required
                    aria-invalid={Boolean(draft.estimated_hours && !isValidHours(draft.estimated_hours))}
                    className={`${FIELD} h-10 font-mono tabular-nums ${
                      draft.estimated_hours && !isValidHours(draft.estimated_hours)
                        ? 'shadow-[inset_0_0_0_2px_var(--danger)]'
                        : ''
                    }`}
                  />
                  {draft.estimated_hours && !isValidHours(draft.estimated_hours) && (
                    <p className="text-[11px] text-danger">Harus berupa angka bulat positif.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="task-due-date" className={FIELD_LABEL}>
                    Tenggat tugas
                  </label>
                  {/* Custom calendar (T-5.09). Writes the same `YYYY-MM-DD`
                      string to the same `draft.due_date` field; optional here,
                      exactly as the native input was. */}
                  <DateField
                    id="task-due-date"
                    value={draft.due_date}
                    onChange={(next) => setDraft((prev) => ({ ...prev, due_date: next }))}
                    fieldClassName="h-10"
                  />
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className={FIELD_LABEL}>Keterampilan wajib</legend>
                <div className="flex flex-wrap gap-1.5">
                  {SKILL_TAXONOMY.map((skill) => {
                    const active = draft.required_skills.includes(skill);
                    return (
                      <label
                        key={skill}
                        className={`inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-[11.5px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                          active
                            ? 'bg-accent-strong text-accent-ink'
                            : 'bg-card text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-accent-tint hover:shadow-[inset_0_0_0_1px_var(--accent)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleSkill(skill)}
                          className="sr-only"
                        />
                        {skill}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] leading-relaxed text-muted">
                  Keterampilan diambil dari taksonomi tetap proyek. Pilih yang benar-benar dibutuhkan
                  tugas ini.
                </p>
              </fieldset>

              <label
                htmlFor="task-locked"
                className="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-card px-3.5 py-2 text-[12px] text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-shadow duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent hover:shadow-[inset_0_0_0_1px_var(--ink)]"
              >
                <input
                  id="task-locked"
                  type="checkbox"
                  checked={draft.locked}
                  onChange={(e) => setDraft((prev) => ({ ...prev, locked: e.target.checked }))}
                  className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
                />
                Tandai tugas sebagai terkunci
              </label>

              <div className="flex flex-col-reverse items-stretch justify-end gap-2.5 border-t border-line pt-5 sm:flex-row sm:items-center">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Kosongkan formulir
                </Button>
                <Button
                  type="submit"
                  variant="accent"
                  disabled={submitting || !isValidHours(draft.estimated_hours)}
                  className="px-5"
                >
                  {submitting ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Tambah tugas'}
                </Button>
              </div>
            </form>
          </Panel>
        </section>
      </main>
    </WorkspaceShell>
  );
}

/**
 * Workload strip: one bar per task, drawn from the task's own estimated hours.
 *
 * It sits between the register heading and the rows so it reads as a summary of
 * what follows. Bars grow with `scaleY` on a fixed track, so nothing reflows and
 * no row moves.
 *
 * The draw is a `whileInView` entrance, once, staggered left to right, rather
 * than a continuously scroll-linked scale. That was a deliberate correction
 * during this task: the scroll-linked version was measured pinned at
 * `scaleY(0)` in this layout, which left the bars permanently invisible. A
 * one-shot in-view draw is the same intended reading (the register's work loads
 * up as you reach it) and it cannot be left in a zero state.
 *
 * Under reduced motion the bars render at full length with no animation at all.
 */
function TaskWorkloadStrip({ tasks, reduced }: { tasks: TaskItem[]; reduced: boolean }) {
  if (tasks.length === 0) return null;

  const hours = tasks.map((task) => Number(task.estimated_hours) || 0);
  const peak = Math.max(...hours, 1);
  const total = hours.reduce((sum, value) => sum + value, 0);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="eyebrow shrink-0">Beban</span>
      {/* T-5.13: bars are now fixed-width hairline marks, not filled blocks that
          stretch to fill the row. A row of wide solid gold rectangles was the one
          chart-like object left on an editorial page, and with three tasks it
          also spent more of the gold budget than the rule allows. At 3px wide
          they read as a rhythm against the baseline rather than as a stacked bar
          chart, and locked tasks still carry the M hue so the distinction
          survives. Track height stays 20px so the tallest mark still reads. */}
      <span
        aria-hidden="true"
        className="flex h-5 min-w-0 flex-1 items-end gap-1.5"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        {hours.map((value, i) => {
          const height = Math.round((Math.max(30, (value / peak) * 100) / 100) * 20);
          const color = tasks[i].locked ? 'var(--m)' : 'var(--accent-strong)';
          return reduced ? (
            <span
              key={tasks[i].id}
              className="w-[3px] shrink-0 self-end rounded-t-[1px]"
              style={{ height: `${height}px`, backgroundColor: color }}
            />
          ) : (
            <motion.span
              key={tasks[i].id}
              className="w-[3px] shrink-0 origin-bottom self-end rounded-t-[1px]"
              data-motion-scroll=""
              style={{ height: `${height}px`, backgroundColor: color }}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: DURATION.reveal, ease: EASE.out, delay: i * 0.06 }}
            />
          );
        })}
      </span>
      <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-muted" data-numeric>
        {total} jam · {tasks.length} tugas
      </span>
    </div>
  );
}
