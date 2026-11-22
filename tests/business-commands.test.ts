import { EditorSession } from '@editor-platform/editor-core';
import { describe, expect, it } from 'vitest';
import example from '../fixtures/example.json';
import { acceptScenario, addAssumption, addScenarioReference, createBusinessSession, removeAssumption, removeScenarioOverride, removeScenarioReference, setScenarioOverride, updateAssumption, updateCalculation } from '../src/business-commands';
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

describe('シナリオと計算条件の操作', () => {
  it('引用と上書きを追加・削除し、元の文書を変更しない', () => {
    const original = initial();
    const allocator = createBusinessSession();
    const withAssumption = addAssumption(allocator, original, input()).apply(original);
    const id = withAssumption.assumptions.at(-1)!.id;
    const referenced = addScenarioReference('SC-01', id).apply(withAssumption);
    const overridden = setScenarioOverride('SC-01', id, Array(10).fill('1')).apply(referenced);
    expect(() => removeScenarioReference('SC-01', id).apply(overridden)).toThrow('必要');
    const cleared = removeScenarioOverride('SC-01', id).apply(overridden);
    const removed = removeScenarioReference('SC-01', id).apply(cleared);
    expect(removed.scenarios[0].assumptionIds).not.toContain(id);
    expect(original.assumptions).toHaveLength(6);
  });
  it('不正な形の上書きと不適合な計算条件を拒否する', () => {
    const current = initial();
    expect(() => setScenarioOverride('SC-01', 'FA-01', '1').apply(current)).toThrow('上書き');
    expect(() => removeScenarioReference('SC-01', 'FA-01').apply(current)).toThrow('必要');
    expect(() => updateCalculation({ ...current.calculation, exchangeRate: 'FA-01' }).apply(current)).toThrow('計算条件');
    expect(() => removeScenarioOverride('SC-01', 'FA-01').apply(current)).toThrow('見つかりません');
  });
  it('再計算した結果を独立した写しとして記録する', () => {
    const current = initial();
    const result = acceptScenario(createBusinessSession(), current, 'SC-01').apply(current);
    expect(result.acceptedResults.at(-1)?.metrics).toEqual({ npvJPY: '641127690', irrPercent: '18.0912', paybackYear: 5 });
    expect(result.acceptedResults.at(-1)?.id).toBe('AR-02');
    result.assumptions[0].name = '変更';
    expect(result.acceptedResults.at(-1)?.assumptions[0].name).not.toBe('変更');
    expect(current.acceptedResults).toHaveLength(1);
  });
});
