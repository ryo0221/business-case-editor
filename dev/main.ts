import { IndexedDBStorage, createArtifact, type Artifact } from '@editor-platform/artifact-core';
import { ArtifactEditor } from '@editor-platform/editor-host';
import { ExtensionRegistry } from '@editor-platform/extension-runtime';
import { artifactEditorHost } from '@editor-platform/extension-runtime/editor-host';
import { verifyExtensionPackage, loadVerifiedExtension, installVerifiedExtension } from '@editor-platform/extension-runtime/package';
import { editorPackage, trustedPin } from 'virtual:editor-package';
import sample from '../fixtures/example.json';
import { isBusinessCase, type BusinessCase } from '../src/model';
import './styles.css';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<main class="workspace"><h1>収支の比較</h1><p id="status" role="status"></p><button id="undo">Undo</button> <button id="redo">Redo</button> <button id="save">保存</button><div id="surface"></div></main>';
async function main() {
  const verified = await verifyExtensionPackage({ manifest: editorPackage.manifest, entry: editorPackage.entry, files: editorPackage.files.map(f => ({path: f.path, bytes: Uint8Array.from(atob(f.base64), c => c.charCodeAt(0))})) }, (id, version) => id === trustedPin.id && version === trustedPin.version ? trustedPin.packageHash : undefined);
  const loaded = await loadVerifiedExtension<BusinessCase>(verified);
  const registration = installVerifiedExtension(new ExtensionRegistry(), loaded);
  if (!isBusinessCase(sample)) throw new Error('見本文書を読み込めません。');
  const storage = new IndexedDBStorage<Artifact<BusinessCase>>('business-case');
  const active = localStorage.getItem('business-case-active');
  const saved = active ? await storage.get(active) : undefined;
  const editor = new ArtifactEditor(saved ?? createArtifact(registration.manifest.artifactKind, '収支', sample), { kind: registration.manifest.artifactKind, validate: isBusinessCase, capabilities: { undo: true, nativeJson: true, formats: [], preview: 'none', shared: false } }, storage);
  const handle = registration.open(artifactEditorHost(editor, { schemaVersion: 1, allowed: () => true }));
  handle.mount(document.querySelector<HTMLElement>('#surface')!);
  const report = (error: unknown) => { document.querySelector('#status')!.textContent = error instanceof Error ? error.message : '操作できませんでした。'; };
  document.querySelector<HTMLButtonElement>('#undo')!.onclick = () => { try { handle.api.undo(); } catch (e) { report(e); } };
  document.querySelector<HTMLButtonElement>('#redo')!.onclick = () => { try { handle.api.redo(); } catch (e) { report(e); } };
  document.querySelector<HTMLButtonElement>('#save')!.onclick = () => { void handle.api.save().then(() => { localStorage.setItem('business-case-active', editor.id); document.querySelector('#status')!.textContent = '保存しました。'; }).catch(report); };
}
void main().catch(error => { document.querySelector('#status')!.textContent = String(error); });
