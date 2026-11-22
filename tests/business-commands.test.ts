import { EditorSession } from '@editor-platform/editor-core';
import { describe, expect, it } from 'vitest';
import example from '../fixtures/example.json';
import { addAssumption, createBusinessSession, removeAssumption, updateAssumption } from '../src/business-commands';
import type { BusinessCase } from '../src/business-case';

const initial = () => structuredClone(example) as BusinessCase;
const input = () => {
  const { id: _id, ...fields } = initial().assumptions[0];
  return fields;
};

describe('収支の前提操作', () => {
  it('追加後にUndoして再度追加しても同じIDを使わず、保存用の上限を維持する', () => {
    const allocator = createBusinessSession();
    const history = new EditorSession(initial());
    history.execute(addAssumption(allocator, history.content, input()));
    const first = history.content.assumptions.at(-1)!.id;
    history.undo();
    expect(allocator.synchronize(history.content).lastIssued.FA).toBe(7);
    history.execute(addAssumption(allocator, history.content, input()));
    expect(history.content.assumptions.at(-1)!.id).not.toBe(first);
    expect(history.content.lastIssued.FA).toBe(8);
  });
  it('古い編集と参照中の前提の削除を拒否する', () => {
    const current = initial();
    const before = structuredClone(current.assumptions[0]);
    const edited = { ...before, name: '変更' };
    const changed = updateAssumption(before, edited).apply(current);
    expect(() => updateAssumption(before, edited).apply(changed)).toThrow('変更または削除');
    expect(() => removeAssumption(before.id).apply(current)).toThrow('参照中');
    expect(current.assumptions[0]).toEqual(before);
  });
});
