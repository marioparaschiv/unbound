import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { publishOrder, ROOT } from './workspaces';

function publishAll() {
	for (const dir of publishOrder()) {
		execFileSync('bun', [join(import.meta.dir, 'publish-package.ts'), dir], {
			cwd: ROOT,
			stdio: 'inherit',
		});
	}
}

publishAll();
