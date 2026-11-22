// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import type { ScopedHost } from '@editor-platform/extension-contract';
import example from '../fixtures/example.json';
import type { BusinessCase } from '../src/business-case';
import { mountEditor } from '../src/Editor';
it('前提と比較結果を表示し、外部変更を反映して終了時に監視を止める', () => {
  vi.useFakeTimers();
  let content = structuredClone(example) as BusinessCase;
  const root = document.createElement('div');
  const unmount = mountEditor(root, { read: () => content } as ScopedHost<BusinessCase>);
  expect(root.textContent).toContain('年間売上');
  expect(root.textContent).toContain('6.41 億円');
  expect(root.textContent).toContain('18.0912%');
  expect(root.textContent).toContain('5年');
  content = structuredClone(content); content.assumptions[0].name = '新しい前提';
  vi.advanceTimersByTime(200);
  expect(root.textContent).toContain('新しい前提');
  unmount(); expect(root.children).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
