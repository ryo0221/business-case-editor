import { describe, expect, it } from 'vitest';
import example from '../fixtures/example.json';
import type { BusinessCase } from '../src/business-case';
import { operations } from '../src/operations';
const input = { id: 'FA-04', before: '4', value: '5' };
const initial = () => structuredClone(example) as BusinessCase;
describe('前提値の操作提案', () => {
  it('前提を検査し、元の文書と無関係な値を保って変更する', () => {
    const doc = initial();
    expect(operations.checkInput('update-assumption-value', input, doc)).toEqual([]);
    const candidate = operations.command('update-assumption-value', input, doc).apply(doc);
    expect(candidate.assumptions[3].value).toBe('5');
    expect(doc.assumptions[3].value).toBe('4');
    expect(candidate.assumptions[0]).toEqual(doc.assumptions[0]);
  });
  it('不正な入力と古い元の値を拒否する', () => {
    const doc = initial();
    expect(operations.checkInput('update-assumption-value', { ...input, extra: true }, doc).length).toBeGreaterThan(0);
    expect(operations.checkInput('update-assumption-value', { ...input, value: '0' }, doc).length).toBeGreaterThan(0);
    const edit = operations.command('update-assumption-value', input, doc);
    const changed = structuredClone(doc); changed.assumptions[3].name = '別の編集';
    expect(() => edit.apply(changed)).toThrow('変更または削除');
  });
});
