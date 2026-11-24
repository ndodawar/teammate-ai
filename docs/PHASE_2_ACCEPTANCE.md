# Penerimaan Fase 2 — AI Layer & Hybrid Recommendation

Dokumen ini memetakan setiap ID PRD yang menjadi cakupan Fase 2 ke implementasi, tes, status, dan bukti.
Sumber kebenaran: `prd.md` (PRD v0.2, 13 November 2026).

**Putusan: LULUS BERSYARAT.** Seluruh gerbang arsitektur lulus dan dibuktikan dengan tes yang berjalan.
Gerbang **live Gemini tetap BLOCKED** karena `GEMINI_API_KEY` belum tersedia; status ini tidak boleh
dibaca sebagai PASS.

- Tanggal verifikasi: 2026-11-17
- Branch: `redesign/fuelplate-ui`, `HEAD` = `9b62e3d` (tidak ada commit baru)
- Gerbang: typecheck PASS · lint 0 error / 2 warning lama · 236 tes lulus + 4 skipped · build exit 0

---

## 1. Matriks Penerimaan

| ID PRD | Implementasi | Berkas | Tes | Status | Bukti |
|---|---|---|---|---|---|
| **FR-06** Analisis tugas AI | Satu `generateContent` untuk semua tugas, Zod, taksonomi, review-before-apply | `lib/ai/analyze-task.ts`, `lib/ai/schemas.ts`, `app/api/analyze-task/route.ts`, `app/p/[code]/tasks/tasks-client.tsx` | `test/ai/analyze-task.test.ts` (14), `test/ai/ai-run-explanations.test.ts` | **IMPLEMENTED** (live BLOCKED) | Semua tugas dalam 1 request; task ID asing, skill di luar taksonomi, JSON rusak ditolak |
| **FR-07** Mesin rekomendasi | `0.40K + 0.30S + 0.20C + 0.10M`, `globalAssign` deterministik | `lib/scoring/score.ts`, `lib/scoring/assign.ts`, `lib/scoring/pipeline.ts` | `test/scoring.test.ts`, `test/scoring/numerical_8_4.test.ts`, `test/scoring/scenarios.test.ts` (20), `test/ai/ai-run-explanations.test.ts` | **VERIFIED** | Total = 0.4K+0.3S+0.2C+0.1M tepat (toleransi 1e-10); model tidak memilih anggota |
| **FR-09** Penjelasan skor | Satu panggilan untuk utama+alternatif, validator fakta, template bila gagal | `lib/ai/explain.ts`, `lib/ai/explanation-validator.ts`, `lib/scoring/assign.ts` (`generateExplanation`) | `test/ai/ai-run-explanations.test.ts` (validator + layanan) | **IMPLEMENTED** (live BLOCKED) | Persentase buatan, nama bukan subjek, skill di luar `required_skills`, angka tak terhitung → ditolak → template |
| **FR-13** Mode fallback | `K=0`, `S=0.50`, `C=0.33`, `M=0.17`; bobot dimiliki mesin, bukan pemanggil | `lib/scoring/assign.ts`, `lib/scoring/score.ts`, `lib/scoring/constants.ts` | `test/scoring/fallback.test.ts` (27) | **VERIFIED** | `POST /api/recommend` → HTTP 200, `isFallback: true`, semua `K=0`, 21/21 skor cocok `FALLBACK_WEIGHTS` |
| **NFR-06** Maks 3 panggilan/proses | Guard nyata menolak panggilan ke-4 sebelum jaringan | `lib/ai/call-budget.ts` | `test/ai/ai-run-explanations.test.ts`, `test/ai/call-budget-scenarios.test.ts`, `test/ai/gemini-integration.test.ts` | **VERIFIED** | 20/20 skenario D2 ≤ 2 panggilan; percobaan ke-4 → `CallBudgetExceededError`, `embedContent` tidak terpanggil |
| **NFR-07/08** Kegagalan AI tidak menghentikan aplikasi | Fallback otomatis pada semua kegagalan provider | `app/api/recommend/route.ts`, `lib/ai/explain.ts` | `test/api/recommend-route.test.ts` (4 mode kegagalan) | **VERIFIED** | Invalid key, rate limit, timeout, model unavailable → HTTP 200 + `isFallback: true` |
| **NFR-41** Catat error relevan | `sanitizeErrorMessage` ke log server, pesan stabil ke klien | `lib/ai/call-budget.ts`, kedua route | `test/api/recommend-route.test.ts` | **VERIFIED** | Detail asli hanya di log; klien menerima pesan tetap |
| **NFR-43/44/45** AiRun, token | Satu baris per proses, token asli atau `null` | `lib/ai/ai-run.ts`, `app/api/recommend/route.ts` | `test/ai/ai-run-explanations.test.ts` (11), `test/api/recommend-route.test.ts` | **PARTIAL** | Baris live tertulis (`status=fallback`, token `null`); kolom jumlah panggilan & durasi tidak ada di skema |
| **NFR-09 keamanan** Key server-only | Key dibaca hanya dari `process.env` di modul server | `lib/ai/analyze-task.ts`, `.gitignore` | `test/ai/gemini-models.live.test.ts` | **VERIFIED** | Tidak ada `NEXT_PUBLIC_*`; `.env.local` diabaikan Git (`.gitignore:34`); error disanitasi |
| **PRD 6.1 kinerja** | Fallback < 1 dtk, what-if < 100 ms | `lib/scoring/assign.ts` | probe terukur | **VERIFIED** | Fallback 1,34 ms; hybrid 0,35 ms/recompute; interaksi lokal 0 request |
| **PRD 6.4 privasi** | Prompt memperlakukan teks pengguna sebagai data | `lib/ai/analyze-task.ts`, `lib/ai/explain.ts` | `test/ai/analyze-task.test.ts` (prompt injection) | **VERIFIED** | Instruksi tertanam di deskripsi diabaikan model prompt |
| **FR-05** Batas input | Deskripsi ≤ 500, catatan anggota ≤ 300 | `lib/validation/index.ts`, `app/api/analyze-task/route.ts` | `test/api/tasks.test.ts`, `test/api/member-profile.test.ts` | **VERIFIED** | `max(500)` dan `max(300)` ditegakkan Zod |

---

## 2. Rincian Bukti Kunci

### 2.1 Anggaran panggilan (NFR-06)

`AiRun.track()` memesan slot **sebelum** panggilan dijalankan, sehingga penghitung mencerminkan panggilan yang
benar-benar dicoba, bukan yang berhasil. Pembuktian tingkat provider:

```
Budget habis (3 slot terpakai) -> embedTexts(['a'])
  embedContent dipanggil: 0 kali
  hasil: [null]                      -> caller jatuh ke fallback, tanpa vektor palsu

Percobaan ke-4 run.track(...)
  CallBudgetExceededError
```

Worst case nyata per proses: **1 embedding + 1 penjelasan = 2 panggilan** (analisis tugas adalah proses
terpisah dengan run sendiri). Diukur pada **20/20 skenario D2**: `max(calls) = 2`.
Saat provider gagal di semua skenario: **1 panggilan** (tanpa retry storm, tanpa panggilan penjelasan).

### 2.2 AiRun

Bukti live setelah tiga proses rekomendasi berurutan:

```
ai_runs total=3
  2026-11-17T15:37:06 status=fallback model=text-embedding-004 prompt=null completion=null
  2026-11-17T15:37:52 status=fallback model=text-embedding-004 prompt=null completion=null
  2026-11-17T15:38:01 status=fallback model=text-embedding-004 prompt=null completion=null
```

Token `null` benar: provider tidak terhubung, jadi tidak ada angka yang dikarang. Kegagalan penulisan AiRun
(upload ditolak / melempar) terbukti tidak menggagalkan rekomendasi.

### 2.3 Embedding dan cache

```
COLD: gemini calls=1, batch sizes=[10]   tasks=7 members=3 failedPairs=0
WARM: gemini calls=0 (all from cache)
```
Payload terverifikasi: `{ model: "text-embedding-004", contents: ["a","b"], config: { outputDimensionality: 768 } }`.
Dimensi 768 divalidasi pada jalur baca **dan** tulis; NaN/Infinity/767/769 ditolak.

### 2.4 Interaksi lokal

Diukur di Chromium terhadap server nyata:

```
API calls during initial load:            ["POST /api/recommend"]
API calls during slider/lock/undo:        []
fallback banner visible:                  true
```

---

## 3. Penyimpangan yang Harus Tetap Dicatat

| # | Penyimpangan | Dampak | Sikap |
|---|---|---|---|
| 1 | **Penyimpanan embedding memakai `vector(768)` (pgvector), bukan JSONB.** Rujukan "PRD Bagian 9" pada penugasan tidak dapat diverifikasi karena `prd.md` tidak memiliki bagian data-model; yang ada hanya NFR-45 menyebut entitas AiRun | Skema live sudah `vector(768)`; menggantinya akan destruktif | Kompatibilitas dipertahankan; **tidak** diklaim sesuai penuh dengan rujukan Bagian 9 |
| 2 | **`ai_runs` tidak punya kolom `call_count`, `duration_ms`, `error_message`** | NFR-42/43 tidak dapat dipenuhi sepenuhnya di tingkat data | Diukur di memori dan diuji; gap didokumentasikan; migration tidak diubah (dilarang) |
| 3 | **Verifikasi live Gemini belum dijalankan** | Model teks/embedding masih asumsi default kode | Ditandai **BLOCKED**, bukan PASS |
| 4 | Jalur hybrid (`K > 0`) belum pernah dieksekusi dengan provider nyata | Hanya terbukti lewat provider di-stub | Menunggu kredensial |
| 5 | UI mengirim bobot standar pada fetch awal sebelum tahu mode | Backend mengabaikan bobot pemanggil dalam mode fallback, jadi hasil tetap benar | Dibiarkan; memperbaikinya menambah request jaringan tanpa manfaat |

---

## 4. Blocker Konkret

1. **`GEMINI_API_KEY` tidak tersedia.** Diperlukan untuk: `ai.models.list()`, verifikasi `gemini-2.5-flash`
   dan `text-embedding-004`, analisis nyata, embedding nyata 768 dim, `isFallback=false` dengan `K > 0`,
   dan cache hit lintas proses dengan embedding Gemini sungguhan.
   **Tindakan:** isi key di `.env.local` (server-side), lalu
   `npx vitest run test/ai/gemini-models.live.test.ts` (4 tes live sudah siap dan akan gagal keras bila model
   tidak tersedia).
2. **Kolom observabilitas AiRun tidak ada.** Diperlukan migration **aditif** (`call_count int`,
   `duration_ms int`, `error_message text`) pada fase berikutnya. Tidak dilakukan sekarang karena penugasan
   melarang perubahan migration.

---

## 5. Konfirmasi Batasan

- Tidak ada `git commit`, `push`, atau `deploy`. `HEAD` tetap `9b62e3d`.
- Tidak ada `git reset --hard` atau `git clean -fd`; seluruh perubahan lokal pengguna utuh.
- Tidak ada migration yang diubah dan tidak ada data proyek yang dihapus (3 baris `ai_runs` adalah data
  observabilitas baru yang dibuat oleh fitur ini sendiri).
- Formula AI, formula fallback, dan R1–R5 tidak berubah.
- Tidak ada dependency baru.
- Tidak ada nilai `GEMINI_API_KEY` yang dibaca atau dicetak (key tidak ada).
