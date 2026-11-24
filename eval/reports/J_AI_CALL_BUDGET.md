# J. AI Call Budget

Runner: `eval/scripts/run_ai_budget.test.ts`. Data: `eval/results/ai_budget.json`.

## Prasyarat (jujur)

`GEMINI_API_KEY` **tidak tersedia**. Karena itu:

- **Tidak ada** panggilan Gemini nyata dalam evaluasi ini. Tidak ada token/latency provider nyata.
- Yang diuji **nyata**: kelas `AiRun` (`lib/ai/call-budget.ts`) — batas 3 panggilan per proses,
  pencatatan token, pencatatan latency, dan redaksi key. Serta `explainAssignments` pada **mode
  cadangan** (yang memang offline).
- **FR-06 dan jalur hybrid FR-09 tetap BLOCKED** sampai diuji dengan key live.

## Hasil logika budget (AiRun, nyata)

| Uji | Hasil | Bukti |
|---|---|---|
| 3 panggilan pertama diterima | **lulus** | `callCount=3, remaining=0` |
| Panggilan ke-4 ditolak **sebelum** jaringan | **lulus** | `CallBudgetExceededError`, `callCount` tetap 3 |
| Ringkasan token dijumlahkan | **lulus** | `promptTokens=30, completionTokens=15` |
| `finish()` kedua → `null` (immutable) | **lulus** | mencegah mutasi baris terdokumentasi |
| Slot terpakai walau `fn` gagal | **lulus** | 3 kegagalan → `callCount=3`, panggilan ke-4 diblok |
| Redaksi key di pesan error | **lulus** | `AIza…` & `api_key=…` → `[REDACTED]` |
| Mode cadangan tanpa panggilan | **lulus** | `run.callCount=0`, reason template terisi |

## Angka nyata vs yang belum tersedia

| Item | Nilai |
|---|---|
| Maks panggilan/proses (konstanta) | **3** (`MAX_GEMINI_CALLS_PER_PROCESS`) |
| Panggilan Gemini aktual (live) | **0** — tidak ada key (**BLOCKED**) |
| Token aktual | **tidak ada** — tidak ada respons provider |
| Latency provider aktual | **tidak ada** — tidak ada respons provider |
| Penggunaan cache (live) | **BLOCKED** |
| Aktivasi fallback | **terverifikasi** pada mode cadangan (0 panggilan, template dipakai) |

## Interpretasi

- Mekanisme budget **terbukti bekerja**: ia tidak mungkin melebihi 3 panggilan per proses, dan
  kegagalan pun tetap menghabiskan slot (sesuai desain "request yang gagal tetap keluar dari mesin").
- Klaim "maks 3 panggilan Gemini per proses" dapat **diverifikasi pada kodenya**, tetapi
  **belum diverifikasi terhadap provider live** (BLOCKED).
- Tidak ada angka token/latency yang dikarang untuk mengisi kolom ini.

## Untuk menutup BLOCKED

1. `GEMINI_API_KEY` valid di `.env.local`.
2. Jalankan satu proses rekomendasi penuh dengan analisis+embedding+explanation.
3. Baca `AiRun` row (callCount, token, latency, status) dari DB/log.
4. Ulangi ≤20 proses D2, catat distribusi; verifikasi tidak pernah >3.
