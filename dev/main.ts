import { IndexedDBStorage, createArtifact, type Artifact } from '@editor-platform/artifact-core';
import { ArtifactEditor } from '@editor-platform/editor-host';
import { ExtensionRegistry, type PreparedOperation } from '@editor-platform/extension-runtime';
import { artifactEditorHost } from '@editor-platform/extension-runtime/editor-host';
import { verifyExtensionPackage, loadVerifiedExtension, installVerifiedExtension } from '@editor-platform/extension-runtime/package';
import { editorPackage, trustedPin } from 'virtual:editor-package';
import sample from '../fixtures/example.json';
import { isBusinessCase, type BusinessCase } from '../src/model';
import './styles.css';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<main class="workspace"><h1>収支の比較</h1><p id="status" role="status"></p><button id="undo">Undo</button> <button id="redo">Redo</button> <button id="save">保存</button><label><input id="readonly" type="checkbox"> 読み取り専用</label><p id="readonly-note" hidden>読み取り専用です。内容を変える操作はできません。</p><div id="surface"></div><section><h2>外からの提案</h2><div id="proposal-list"></div></section><section><h2>開発用：提案の作成</h2><label>前提ID <input id="proposal-id" value="FA-04"></label><label>変更前 <input id="proposal-before" value="4"></label><label>変更後 <input id="proposal-value" value="5"></label><button id="proposal-prepare">提案を確認</button></section></main>';
async function main() {
  const verified = await verifyExtensionPackage({ manifest: editorPackage.manifest, entry: editorPackage.entry, files: editorPackage.files.map(f => ({path: f.path, bytes: Uint8Array.from(atob(f.base64), c => c.charCodeAt(0))})) }, (id, version) => id === trustedPin.id && version === trustedPin.version ? trustedPin.packageHash : undefined);
  const loaded = await loadVerifiedExtension<BusinessCase>(verified);
  const registration = installVerifiedExtension(new ExtensionRegistry(), loaded);
  if (!isBusinessCase(sample)) throw new Error('見本文書を読み込めません。');
  const storage = new IndexedDBStorage<Artifact<BusinessCase>>('business-case');
  const active = localStorage.getItem('business-case-active');
  const saved = active ? await storage.get(active) : undefined;
  const editor = new ArtifactEditor(saved ?? createArtifact(registration.manifest.artifactKind, '収支', sample), { kind: registration.manifest.artifactKind, validate: isBusinessCase, capabilities: { undo: true, nativeJson: true, formats: [], preview: 'none', shared: false } }, storage);
  let readOnly = false;
  const adapter = artifactEditorHost(editor, { schemaVersion: 1, allowed: () => true });
  const handle = registration.open({ ...adapter, readOnly: () => readOnly || adapter.readOnly() });
  const readonly = document.querySelector<HTMLInputElement>('#readonly')!;
  readonly.onchange = () => { readOnly = readonly.checked; document.querySelector<HTMLElement>('#readonly-note')!.hidden = !readOnly; };
  const proposals: { operation: PreparedOperation<BusinessCase>; description: string }[] = [];
  const list = document.querySelector<HTMLElement>('#proposal-list')!;
  const renderProposals = () => {
    list.replaceChildren();
    if (!proposals.length) { list.textContent = '提案はありません。'; return; }
    proposals.forEach((proposal, index) => {
      const entry = document.createElement('div'); entry.className = 'proposal-preview';
      const description = document.createElement('span'); description.textContent = proposal.description;
      const accept = document.createElement('button'); accept.textContent = '提案を採る';
      const discard = document.createElement('button'); discard.textContent = '提案を戻す';
      accept.onclick = () => { try { proposal.operation.commit(); proposals.splice(index, 1); renderProposals(); } catch (e) { report(e); } };
      discard.onclick = () => { proposals.splice(index, 1); renderProposals(); };
      entry.append(description, accept, discard); list.append(entry);
    });
  };
  document.querySelector<HTMLButtonElement>('#proposal-prepare')!.onclick = () => { try {
    const id = document.querySelector<HTMLInputElement>('#proposal-id')!.value;
    const before = document.querySelector<HTMLInputElement>('#proposal-before')!.value;
    const value = document.querySelector<HTMLInputElement>('#proposal-value')!.value;
    const operation = handle.operations!.prepare({ id: 'update-assumption-value', version: '1.0.0' }, { id, before, value });
    proposals.push({ operation, description: `${id}: ${before} → ${value}` }); renderProposals();
  } catch (e) { report(e); } };
  renderProposals();
  handle.mount(document.querySelector<HTMLElement>('#surface')!);
  const report = (error: unknown) => { document.querySelector('#status')!.textContent = error instanceof Error ? error.message : '操作できませんでした。'; };
  document.querySelector<HTMLButtonElement>('#undo')!.onclick = () => { try { handle.api.undo(); } catch (e) { report(e); } };
  document.querySelector<HTMLButtonElement>('#redo')!.onclick = () => { try { handle.api.redo(); } catch (e) { report(e); } };
  document.querySelector<HTMLButtonElement>('#save')!.onclick = () => { void handle.api.save().then(() => { localStorage.setItem('business-case-active', editor.id); document.querySelector('#status')!.textContent = '保存しました。'; }).catch(report); };
}
void main().catch(error => { document.querySelector('#status')!.textContent = String(error); });
