import { getBytecodePath } from '@unbound-app/contracts/version-layout';
import { listAddonFiles } from '@unbound-app/contracts/addon-files';
import type { AddonManifest } from '@unbound-app/types';

import { canReplaceFolders, replaceFolder } from '~/native/folders';
import { writeAddonFiles, type AddonFiles } from '~/addons/files';
import { stagingDirectoryOf } from '~/addons/staging';
import { getLoader } from '~/native/unbound-native';
import fs from '~/native/fs';

/** What one addon version writes to disk. */
export type AddonWrite = {
	/** The addon's folder, relative to the documents directory. */
	target: string;
	bundle: string;
	manifest: AddonManifest;
	/** The bundle compiled for this runtime, base64-encoded. */
	bytecode?: string;
	/** The extra files beside the bundle by path; the ones on disk stay when omitted. */
	files?: AddonFiles;
};

/**
 * @description Writes an addon version into its folder. When the loader can move folders and every file of the version is
 * at hand, it writes into a staging folder first and moves it into place whole, so an interrupted install never leaves a
 * manifest beside another version's bundle.
 * @param write The folder and the version's files.
 */
export async function writeAddon({
	target,
	bundle,
	manifest,
	bytecode,
	files,
}: AddonWrite): Promise<void> {
	const staged =
		canReplaceFolders() && (files !== undefined || listAddonFiles(manifest).length === 0);
	const dir = staged ? stagingDirectoryOf(target) : target;
	const bytecodeVersion = getLoader()?.bytecodeVersion;

	if (staged) {
		await fs.removeFile(dir);
	}

	await fs.writeFile(`${dir}/manifest.json`, JSON.stringify(manifest));
	await fs.writeFile(`${dir}/${manifest.main}`, bundle);

	if (bytecode && bytecodeVersion) {
		await fs.writeFile(
			`${dir}/${getBytecodePath(manifest.main, bytecodeVersion)}`,
			bytecode,
			'base64',
		);
	}

	if (files) {
		await writeAddonFiles(dir, manifest, files);
	}

	if (staged && !replaceFolder(dir, target)) {
		throw new Error(`Failed to move ${manifest.id} from ${dir} into ${target}`);
	}
}

export default { writeAddon };
