/** The fake `fs`: an in-memory documents folder. */
export type FakeFs = {
	/** Every file, by absolute path, with the content as written; a test may read or add to it. */
	files: Map<string, string>;
	documentsPath: string;
	exists: (path: string, inDocuments?: boolean) => Promise<boolean>;
	readFile: (path: string, encoding?: string, inDocuments?: boolean) => Promise<string>;
	writeFile: (path: string, content: string, encoding?: string) => Promise<string>;
	removeFile: (path: string) => Promise<boolean>;
};

const DOCUMENTS = '/documents';

/**
 * @description Creates the fake `fs`, which keeps files in memory and resolves relative paths against its documents folder, as the client does.
 * @returns The fs.
 */
export function createFakeFs(): FakeFs {
	const files = new Map<string, string>();

	function resolve(path: string, inDocuments = true) {
		return inDocuments ? `${DOCUMENTS}/${path}` : path;
	}

	return {
		files,
		documentsPath: DOCUMENTS,
		exists: async (path, inDocuments) => files.has(resolve(path, inDocuments)),
		async readFile(path, _encoding, inDocuments) {
			const content = files.get(resolve(path, inDocuments));

			if (content === undefined) {
				throw new Error(`Failed to read file ${path}: it does not exist.`);
			}

			return content;
		},
		async writeFile(path, content) {
			files.set(resolve(path), content);

			return resolve(path);
		},
		async removeFile(path) {
			const target = resolve(path);
			const removed = [...files.keys()].filter(
				(file) => file === target || file.startsWith(`${target}/`),
			);

			for (const file of removed) files.delete(file);

			return removed.length > 0;
		},
	};
}
