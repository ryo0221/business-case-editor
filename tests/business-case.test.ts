import { describe, expect, it } from 'vitest';
import example from '../fixtures/example.json';
import { validateBusinessCase } from '../src/business-case';

const copy = () => structuredClone(example);
describe('収支文書の検証', () => {
  it('形式の見本と受け入れ結果を検証する', () => {
    expect(() => validateBusinessCase(copy())).not.toThrow();
  });
  it('受け入れ結果の改変、依存関係の循環、採番上限超過を拒否する', () => {
    const wrongResult = copy(); wrongResult.acceptedResults[0].metrics.npvJPY = '1';
    expect(() => validateBusinessCase(wrongResult)).toThrow();
    const cycle = copy(); cycle.assumptions[0].kind = 'calculated'; (cycle.assumptions[0].dependsOn as string[]).push('FA-01');
    expect(() => validateBusinessCase(cycle)).toThrow();
    const issued = copy(); issued.lastIssued.FA = 1;
    expect(() => validateBusinessCase(issued)).toThrow();
  });
  it('不正な年次列と不正な Unicode を拒否する', () => {
    const years = copy(); years.assumptions[0].value = ['1'];
    expect(() => validateBusinessCase(years)).toThrow();
    const unicode = copy(); unicode.assumptions[0].name = '\ud800';
    expect(() => validateBusinessCase(unicode)).toThrow();
  });
});
