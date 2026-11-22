import type { OperationDeclaration, OperationsAdapter } from '@editor-platform/extension-contract';
import { updateAssumption } from './business-commands';
import { validateBusinessCase, type BusinessCase } from './business-case';

export const operationDeclarations: readonly OperationDeclaration[] = [{
  id: 'update-assumption-value', version: '1.0.0', title: '前提の値を変更',
  inputSchema: { type: 'object', properties: {
    id: { type: 'string', minLength: 5, maxLength: 9 },
    before: { type: 'string', minLength: 1, maxLength: 28 },
    value: { type: 'string', minLength: 1, maxLength: 28 },
  }, required: ['id', 'before', 'value'], additionalProperties: false },
}];
function prepare(operation: string, value: unknown, content: BusinessCase) {
  if (operation !== 'update-assumption-value' || !value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('操作の入力を確認してください。');
  const v = value as Record<string, unknown>;
  if (Reflect.ownKeys(v).length !== 3 || !['id', 'before', 'value'].every(k => typeof v[k] === 'string') || !/^FA-(?:0[1-9]|[1-9][0-9]{1,5})$/.test(v.id as string) || ![v.before, v.value].every(x => typeof x === 'string' && x.length <= 28 && /^-?(?:0|[1-9]\d{0,17})(?:\.\d{0,7}[1-9])?$/.test(x) && x !== '-0')) throw new Error('操作の入力を確認してください。');
  validateBusinessCase(content);
  const before = content.assumptions.find(a => a.id === v.id);
  if (!before || before.value !== v.before) throw new Error('前提が変更または削除されました。現在の内容を確認してください。');
  const edit = updateAssumption(before, { ...before, value: v.value as string });
  edit.apply(content);
  return edit;
}
export const operations: OperationsAdapter<BusinessCase> = {
  checkInput(operation, value, content) { try { prepare(operation, value, content); return []; } catch (error) { return [error instanceof Error ? error.message : '操作の入力を確認してください。']; } },
  command(operation, value, content) { return prepare(operation, value, content); },
};
