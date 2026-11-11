import { CONFIG_FILENAME } from '@unbound-app/contracts/workspace';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A file a build commit adds, by path from the repository root. */
export type VendoredFile = {
	path: string;
	contents: Uint8Array;
};

const GITLINK_MODE = '160000';

function gitLines(cwd: string, args: string[]): string[] | undefined {
	const proc = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });

	if (proc.exitCode !== 0) return;

	return proc.stdout
		.toString()
		.split(/[\n\0]/)
		.filter(Boolean);
}

/**
 * @description Tells whether a workspace is a submodule at HEAD, so its files and history live in its own repository.
 * @param root The repository root.
 * @param workspace The workspace folder, relative to the root, such as `packages/icon-packs`.
 * @returns Whether HEAD records the workspace as a submodule commit.
 */
export function isSubmodule(root: string, workspace: string): boolean {
	const [entry] = gitLines(root, ['ls-tree', 'HEAD', '--', workspace]) ?? [];

	return entry?.startsWith(`${GITLINK_MODE} `) ?? false;
}

/**
 * @description Copies a submodule workspace's committed files for some addons, and its config, into the root's tree,
 * so a build commit holds them whole and stays readable if the submodule's repository goes away.
 * @param root The repository root.
 * @param workspace The submodule workspace, relative to the root.
 * @param dirs The addon folders to copy, relative to the workspace.
 * @returns Each file, by path from the root.
 */
export function vendorWorkspace(root: string, workspace: string, dirs: string[]): VendoredFile[] {
	const checkout = join(root, workspace);
	const paths = gitLines(checkout, ['ls-files', '-z', '--', ...dirs]);

	if (!paths) {
		throw new Error(
			`${workspace} is not checked out. Run \`git submodule update --init ${workspace}\`.`,
		);
	}

	return [CONFIG_FILENAME, ...paths].map((path) => ({
		path: `${workspace}/${path}`,
		contents: readFileSync(join(checkout, path)),
	}));
}

export default { isSubmodule, vendorWorkspace };
