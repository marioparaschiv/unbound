import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { ROOT, loadWorkspaces, workspaceDependencies } from './workspaces';

// Dependencies publish before their dependents so the registry never advertises a package whose
// pinned workspace deps do not exist yet.
function publishOrder(): string[] {
	const { manifests, dirs } = loadWorkspaces();

	const publics = new Map([...manifests].filter(([, manifest]) => !manifest.private));

	const sorted: string[] = [];
	const visited = new Set<string>();

	function visit(dir: string) {
		const manifest = publics.get(dir);
		if (!manifest || visited.has(dir)) return;

		visited.add(dir);

		for (const dep of workspaceDependencies(manifest, dirs)) visit(dep);

		sorted.push(dir);
	}

	for (const dir of publics.keys()) visit(dir);

	return sorted;
}

function publishAll() {
	for (const dir of publishOrder()) {
		execFileSync('bun', [join(import.meta.dir, 'publish-package.ts'), dir], {
			cwd: ROOT,
			stdio: 'inherit',
		});
	}
}

publishAll();
