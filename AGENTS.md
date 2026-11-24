# AGENTS.md

## Referensi PRD v0.2
- Skoring & Logika: PRD Bagian 8
- Skema Data: PRD Bagian 9
- Arsitektur & Stack: PRD Bagian 10
- Panduan Desain: PRD Bagian 12

## Penggunaan Skill Anti-Slop
Muat skill sesuai jenis tugas:
- UI: antislop-ui
- Teks/Copy: antislop-copywriting
- Kode: antislop-code
- Inti: antislop (selalu muat)

## Aturan Kerja
- Satu Sesi, Satu Tugas: Jangan mengerjakan unit tugas kecil ganda.
- Strict Mode: Gunakan TypeScript strict.
- Tanpa Slop: Ikuti instruksi teknis tanpa redundansi.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
