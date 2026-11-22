import { CONTRACT_VERSION, OPERATIONS_ADDON, type ExtensionDefinition, type ExtensionManifest } from '@editor-platform/extension-contract';
import { ARTIFACT_KIND, SCHEMA_VERSION, isBusinessCase, type BusinessCase } from './model';
import { mountEditor } from './Editor';
import { operationDeclarations, operations } from './operations';
export const manifest: Omit<ExtensionManifest, 'packageHash'> = {
  contractVersion: CONTRACT_VERSION, id: 'shinonome.business-case-editor', version: '0.1.0',
  artifactKind: ARTIFACT_KIND, schemaVersion: SCHEMA_VERSION,
  capabilities: ['local-edit', 'surface', 'persistence'], permissions: ['artifact:read', 'artifact:write'],
  licenseNotices: ['AGPL-3.0-only. See LICENSE and NOTICE shipped with this package.'],
  addons: { operations: { version: OPERATIONS_ADDON, declarations: operationDeclarations } },
};
export function definition(packageHash: string): ExtensionDefinition<BusinessCase> {
  return { manifest: { ...manifest, packageHash }, validate: isBusinessCase, mount: mountEditor, operations };
}
