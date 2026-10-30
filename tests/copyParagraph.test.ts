/**
 * 静默剪贴板写入回归测试。
 * 运行：pnpm test（node --test）。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { writeTextToClipboard } from '../src/utils/clipboard.ts';

const setGlobals = (navigatorValue: any, documentValue?: any) => {
  Object.defineProperty(globalThis, 'navigator', {
    value: navigatorValue,
    configurable: true,
    writable: true,
  });
  (globalThis as any).document = documentValue;
};

test('writeTextToClipboard：优先用 navigator.clipboard.writeText', async () => {
  const written: string[] = [];
  setGlobals({
    clipboard: {
      writeText: async (t: string) => {
        written.push(t);
      },
    },
  });
  assert.equal(await writeTextToClipboard('要复制的一段'), true);
  assert.deepEqual(written, ['要复制的一段']);
});

test('writeTextToClipboard：clipboard API 抛错时回退到 execCommand', async () => {
  const calls: string[] = [];
  const fakeTextarea: any = {
    value: '',
    style: {},
    setAttribute: () => {},
    select: () => {
      calls.push('select');
    },
    remove: () => {
      calls.push('remove');
    },
  };
  setGlobals(
    {
      clipboard: {
        writeText: async () => {
          throw new Error('permission denied');
        },
      },
    },
    {
      createElement: () => fakeTextarea,
      body: {
        appendChild: () => {
          calls.push('append');
        },
      },
      execCommand: (cmd: string) => {
        calls.push(cmd);
        return true;
      },
    }
  );
  assert.equal(await writeTextToClipboard('兜底复制'), true);
  assert.equal(fakeTextarea.value, '兜底复制');
  assert.deepEqual(calls, ['append', 'select', 'copy', 'remove']);
});

test('writeTextToClipboard：两条路径都不可用/失败时返回 false（静默）', async () => {
  setGlobals(
    {},
    {
      createElement: () => ({
        value: '',
        style: {},
        setAttribute: () => {},
        select: () => {},
        remove: () => {},
      }),
      body: { appendChild: () => {} },
      execCommand: () => false,
    }
  );
  assert.equal(await writeTextToClipboard('复制不了'), false);
});
