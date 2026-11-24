import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * T-5.17 Scroll Craft engine integrity.
 *
 * The task's rules are explicit: the engine is a *shared mechanism* and is
 * "never edited per page". That is only true if something checks it, because
 * the cheapest way to fix a stubborn animation is to open the engine and change
 * one line — and once that happens the next page silently inherits a fork.
 *
 * So the engine is vendored as a byte-identical copy:
 *
 *   .agents/skills/scroll-craft/engine/scrollcraft.js   (the skill's source)
 *     → public/scrollcraft/vendor/scrollcraft.js        (served to the browser)
 *   .agents/skills/scroll-craft/engine/scrollcraft.css
 *     → app/scrollcraft-engine.css                      (imported by the layout)
 *
 * These cases fail the moment those two pairs diverge, which turns "do not edit
 * the engine" from a promise in a comment into a fact the test suite enforces.
 *
 * Note on the CSS copy: it is compared as *content*, not as a rename-proof
 * artifact, because the framework needs a `.css` file inside the app to import.
 * The bytes are what must match.
 */

const ROOT = process.cwd();
const SKILL_ENGINE = join(ROOT, '.agents/skills/scroll-craft/engine');

/** sha256 of a file, or null when it is absent (so the failure reads clearly). */
function digest(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('T-5.17 Scroll Craft engine is unmodified', () => {
  it('ships the skill engine byte-identically to the browser', () => {
    const source = digest(join(SKILL_ENGINE, 'scrollcraft.js'));
    expect(source, 'the skill engine is missing — the skill was not installed').not.toBeNull();

    const vendored = digest(join(ROOT, 'public/scrollcraft/vendor/scrollcraft.js'));
    expect(vendored, 'the vendored engine is missing — the page cannot mount').not.toBeNull();

    // A mismatch here means the engine was edited. The fix is to revert the
    // engine and solve the problem in the page's own CSS or in the adapter
    // (`components/motion/scrollcraft-engine.tsx`), never in this file.
    expect(vendored).toBe(source);
  });

  it('imports a byte-identical copy of the engine stylesheet', () => {
    const source = digest(join(SKILL_ENGINE, 'scrollcraft.css'));
    expect(source, 'the skill stylesheet is missing').not.toBeNull();

    const imported = digest(join(ROOT, 'app/scrollcraft-engine.css'));
    expect(imported, 'the imported engine stylesheet is missing').not.toBeNull();

    expect(imported).toBe(source);
  });

  it('keeps the project token bridge out of the engine files', () => {
    // The bridge is a separate file on purpose: if project tokens leaked into
    // the engine copy, the digest above would fail — but the reverse mistake
    // (hard-coding the project's palette into the engine) is worth naming.
    const bridge = join(ROOT, 'app/scrollcraft-bridge.css');
    expect(existsSync(bridge), 'the token bridge is missing').toBe(true);
    expect(readFileSync(bridge, 'utf8')).toContain('--sc-');
  });
});
