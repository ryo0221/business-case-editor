import { command, type EditorCommand } from '@editor-platform/editor-core';
import { validateBusinessCase, type Assumption, type BusinessCase } from './business-case';

type Counters = BusinessCase['lastIssued'];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The allocator belongs to one mounted editor session, not to a document or command. */
export function createBusinessSession() {
  const issued: Counters = { FA: 0, SC: 0, AR: 0 };
  return {
    observe(content: BusinessCase) {
      for (const key of ['FA', 'SC', 'AR'] as const)
        issued[key] = Math.max(issued[key], content.lastIssued[key]);
    },
    next(content: BusinessCase, key: keyof Counters) {
      const next = Math.max(issued[key], content.lastIssued[key]) + 1;
      if (next > 999999) throw new Error('これ以上IDを発行できません。');
      return next;
    },
    synchronize(content: BusinessCase): BusinessCase {
      validateBusinessCase(content);
      const result = copy(content);
      for (const key of ['FA', 'SC', 'AR'] as const)
        result.lastIssued[key] = Math.max(result.lastIssued[key], issued[key]);
      return result;
    },
    record(key: keyof Counters, value: number) { issued[key] = Math.max(issued[key], value); },
  };
}
export type BusinessSession = ReturnType<typeof createBusinessSession>;

export function addAssumption(session: BusinessSession, current: BusinessCase, input: Omit<Assumption, 'id'>): EditorCommand<BusinessCase> {
  validateBusinessCase(current);
  const addition = copy(input);
  const number = session.next(current, 'FA');
  session.record('FA', number);
  return { ...command<BusinessCase>('business.assumption.add', '前提を追加', content => {
    validateBusinessCase(content);
    if (content.lastIssued.FA >= number) throw new Error('前提の採番が変更されました。現在の内容を確認してください。');
    const next = copy(content);
    next.lastIssued.FA = number;
    next.assumptions.push({ ...addition, id: `FA-${String(number).padStart(2, '0')}` });
    try { validateBusinessCase(next); } catch { throw new Error('前提の入力または参照を確認してください。'); }
    return next;
  }), readonlyInput: true };
}

export function updateAssumption(before: Assumption, replacement: Assumption): EditorCommand<BusinessCase> {
  const original = copy(before), change = copy(replacement);
  return { ...command<BusinessCase>('business.assumption.update', '前提を編集', content => {
    validateBusinessCase(content);
    const index = content.assumptions.findIndex(a => a.id === original.id);
    if (index < 0 || JSON.stringify(content.assumptions[index]) !== JSON.stringify(original))
      throw new Error('前提が変更または削除されました。現在の内容を確認してください。');
    if (change.id !== original.id) throw new Error('前提IDは変更できません。');
    const next = copy(content);
    next.assumptions[index] = copy(change);
    try { validateBusinessCase(next); } catch { throw new Error('前提の入力または関連するシナリオを確認してください。'); }
    return next;
  }), readonlyInput: true };
}

export function removeAssumption(id: string): EditorCommand<BusinessCase> {
  return { ...command<BusinessCase>('business.assumption.remove', '前提を削除', content => {
    validateBusinessCase(content);
    if (!content.assumptions.some(a => a.id === id)) throw new Error('前提が見つかりません。');
    if (content.scenarios.some(s => s.assumptionIds.includes(id)) ||
        content.assumptions.some(a => a.dependsOn.includes(id)) ||
        Object.values(content.calculation).includes(id))
      throw new Error('参照中の前提は削除できません。');
    const next = copy(content);
    next.assumptions = next.assumptions.filter(a => a.id !== id);
    try { validateBusinessCase(next); } catch { throw new Error('必要な前提は削除できません。'); }
    return next;
  }), readonlyInput: true };
}
