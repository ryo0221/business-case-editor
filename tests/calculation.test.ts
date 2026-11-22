import { describe, expect, it } from 'vitest';
import { calculate } from '../src/calculation';
import specification from '../docs/format-spec.json';

describe('十進数の収支計算', () => {
  it('形式の見本の基本シナリオを再計算する', () => {
    const doc = specification.fixtures.valid.document;
    const value = (id: string) => doc.assumptions.find(a => a.id === id)!.value;
    const c = doc.calculation;
    const result = calculate({ version: c.version, revenueTHB: value(c.revenueTHB), costJPY: value(c.costJPY), initialInvestmentJPY: value(c.initialInvestmentJPY) as string, exchangeRate: value(c.exchangeRate) as string, taxRate: value(c.taxRate) as string, discountRate: value(c.discountRate) as string });
    expect([result.npvJPY, result.irrPercent, result.paybackYear]).toEqual(['641127690', '18.0912', 5]);
    expect(result.rows.cashFlow).toHaveLength(11);
  });
});
