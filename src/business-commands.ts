import { command, type EditorCommand } from '@editor-platform/editor-core';
import { validateBusinessCase, type Assumption, type BusinessCase, type Calculation, type DecimalValue } from './business-case';
import { calculate } from './calculation';

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

function changeScenario(id: string, label: string, reason: string, change: (scenario: BusinessCase['scenarios'][number]) => void): EditorCommand<BusinessCase> {
  return { ...command<BusinessCase>('business.scenario.change', label, content => {
    validateBusinessCase(content);
    const next = copy(content);
    const scenario = next.scenarios.find(item => item.id === id);
    if (!scenario) throw new Error(reason);
    change(scenario);
    try { validateBusinessCase(next); } catch { throw new Error(reason); }
    return next;
  }), readonlyInput: true };
}

export function addScenarioReference(scenarioId: string, assumptionId: string): EditorCommand<BusinessCase> {
  const reason = 'シナリオと引用先、必要な依存先を確認してください。';
  return changeScenario(scenarioId, 'シナリオに引用を追加', reason, scenario => {
    if (scenario.assumptionIds.includes(assumptionId)) throw new Error(reason);
    scenario.assumptionIds.push(assumptionId);
  });
}

export function removeScenarioReference(scenarioId: string, assumptionId: string): EditorCommand<BusinessCase> {
  const reason = 'この引用は計算または上書きに必要なため外せません。';
  return changeScenario(scenarioId, 'シナリオの引用を外す', reason, scenario => {
    if (!scenario.assumptionIds.includes(assumptionId) || scenario.overrides.some(item => item.assumptionId === assumptionId)) throw new Error(reason);
    scenario.assumptionIds = scenario.assumptionIds.filter(item => item !== assumptionId);
  });
}

export function setScenarioOverride(scenarioId: string, assumptionId: string, value: DecimalValue): EditorCommand<BusinessCase> {
  const reason = '引用先と上書き値の形・範囲を確認してください。';
  const replacement = copy(value);
  return changeScenario(scenarioId, 'シナリオの上書きを設定', reason, scenario => {
    if (!scenario.assumptionIds.includes(assumptionId)) throw new Error(reason);
    scenario.overrides = scenario.overrides.filter(item => item.assumptionId !== assumptionId);
    scenario.overrides.push({ assumptionId, value: copy(replacement) });
  });
}

export function removeScenarioOverride(scenarioId: string, assumptionId: string): EditorCommand<BusinessCase> {
  return changeScenario(scenarioId, 'シナリオの上書きを外す', '元の前提値では計算条件を満たしません。', scenario => {
    if (!scenario.overrides.some(item => item.assumptionId === assumptionId)) throw new Error('外す上書きが見つかりません。');
    scenario.overrides = scenario.overrides.filter(item => item.assumptionId !== assumptionId);
  });
}

export function updateCalculation(calculation: Calculation): EditorCommand<BusinessCase> {
  const replacement = copy(calculation);
  return { ...command<BusinessCase>('business.calculation.update', '計算条件を変更', content => {
    validateBusinessCase(content);
    const next = { ...copy(content), calculation: copy(replacement) };
    try { validateBusinessCase(next); } catch { throw new Error('計算条件と各シナリオの引用を確認してください。'); }
    return next;
  }), readonlyInput: true };
}

export function acceptScenario(session: BusinessSession, current: BusinessCase, scenarioId: string): EditorCommand<BusinessCase> {
  validateBusinessCase(current);
  const number = session.next(current, 'AR');
  session.record('AR', number);
  return { ...command<BusinessCase>('business.result.accept', '結果を記録', content => {
    const reason = '結果を記録できません。根拠と計算結果を確認してください。';
    try {
      validateBusinessCase(content);
      if (content.lastIssued.AR >= number) throw new Error(reason);
      const scenario = content.scenarios.find(item => item.id === scenarioId);
      if (!scenario) throw new Error(reason);
      const assumptions = content.assumptions.filter(item => scenario.assumptionIds.includes(item.id));
      const get = (role: 'revenueTHB' | 'costJPY' | 'initialInvestmentJPY' | 'exchangeRate' | 'taxRate' | 'discountRate') => {
        const id = content.calculation[role];
        return scenario.overrides.find(item => item.assumptionId === id)?.value ?? assumptions.find(item => item.id === id)!.value;
      };
      const metrics = calculate({ version: content.calculation.version, revenueTHB: get('revenueTHB'), costJPY: get('costJPY'), initialInvestmentJPY: get('initialInvestmentJPY') as string, exchangeRate: get('exchangeRate') as string, taxRate: get('taxRate') as string, discountRate: get('discountRate') as string });
      const next = copy(content);
      next.lastIssued.AR = number;
      next.acceptedResults.push({ id: `AR-${String(number).padStart(2, '0')}`, scenario: copy(scenario), assumptions: copy(assumptions), calculation: copy(content.calculation), metrics: { npvJPY: metrics.npvJPY, irrPercent: metrics.irrPercent, paybackYear: metrics.paybackYear } });
      validateBusinessCase(next);
      return next;
    } catch { throw new Error(reason); }
  }), readonlyInput: true };
}
