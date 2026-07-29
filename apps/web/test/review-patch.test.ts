import assert from 'node:assert/strict';
import test from 'node:test';
import { patchForReviewFile, reviewPath } from '../src/components/chat/review-patch.js';

const patch = [
  'diff --git a/src/first.ts b/src/first.ts',
  'index 1111111..2222222 100644',
  '--- a/src/first.ts',
  '+++ b/src/first.ts',
  '@@ -1 +1 @@',
  '-export const value = 1;',
  '+export const value = 2;',
  'diff --git a/src/second.ts b/src/second.ts',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/src/second.ts',
  '@@ -0,0 +1 @@',
  '+export const second = true;',
].join('\n');

test('selecting a changed file returns only that file diff', () => {
  const selected = patchForReviewFile(patch, 'src/second.ts');

  assert.match(selected, /second = true/);
  assert.doesNotMatch(selected, /value = 2/);
});

test('reviewPath resolves the destination of a renamed file', () => {
  assert.equal(reviewPath('{src/old.ts -> src/new.ts}'), 'src/new.ts');
});

test('a missing file diff does not fall back to an unrelated patch', () => {
  assert.equal(patchForReviewFile(patch, 'src/missing.ts'), '');
});

test('staged and unstaged diffs for the same file remain visible together', () => {
  const repeated = `${patch}\n${patch.split('diff --git a/src/second.ts')[0]}`;
  const selected = patchForReviewFile(repeated, 'src/first.ts');

  assert.equal(selected.match(/diff --git a\/src\/first\.ts/g)?.length, 2);
});
