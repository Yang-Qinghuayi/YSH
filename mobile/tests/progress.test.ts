import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createProgressWriter } from '../src/services/progress';
test('writer coalesces updates and flushes the latest location on background', async () => {
  const values: number[] = [];
  const writer = createProgressWriter<number>(
    async (n) => {
      values.push(n);
    },
    assert.fail,
    15
  );
  writer.push(1);
  writer.push(2);
  await delay(40);
  writer.push(3);
  await writer.flush();
  assert.deepEqual(values, [2, 3]);
});
test('writes serialized; an error is reported and later writes continue', async () => {
  const values: number[] = [],
    errors: unknown[] = [];
  const writer = createProgressWriter<number>(
    async (n) => {
      await delay(5);
      if (n === 1) throw new Error('disk full');
      values.push(n);
    },
    (e) => errors.push(e),
    100
  );
  writer.push(1);
  const first = writer.flush();
  writer.push(2);
  const second = writer.flush();
  await Promise.all([first, second]);
  assert.equal(errors.length, 1);
  assert.deepEqual(values, [2]);
});
