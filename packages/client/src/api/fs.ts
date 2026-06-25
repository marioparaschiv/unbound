import {
	getNativeModule,
	type DCDFileManagerEncoding,
	type DCDFileManagerType,
} from '~/api/native';

const FileManager: DCDFileManagerType = getNativeModule(
	'NativeFileModule',
	'DCDFileManager',
	'RTNFileManager',
);

/** Absolute path to the platform's documents directory. */
export const Documents = FileManager.DocumentsDirPath;

/**
 * @description Reads a file's contents, resolving relative paths against {@link Documents}.
 * @param path The file path to read, relative to {@link Documents} unless `inDocuments` is `false`.
 * @param encoding The encoding to read the file with.
 * @param inDocuments Whether to resolve `path` relative to {@link Documents}.
 * @returns A promise resolving to the file's contents.
 */
export function read(
	path: string,
	encoding: DCDFileManagerEncoding = 'utf8',
	inDocuments: boolean = true,
) {
	return FileManager.readFile(inDocuments ? `${Documents}/${path}` : path, encoding);
}

/**
 * @description Writes content to a file within {@link Documents}.
 * @param path The file path to write to, relative to {@link Documents}.
 * @param content The content to write.
 * @param encoding The encoding to write the file with.
 * @returns A promise resolving once the file is written.
 */
export function write(path: string, content: string, encoding: DCDFileManagerEncoding = 'utf8') {
	return FileManager.writeFile('documents', path, content, encoding);
}

/**
 * @description Removes a file within {@link Documents}.
 * @param path The file path to remove, relative to {@link Documents}.
 * @returns A promise resolving to whether the file was removed.
 */
export function rm(path: string): Promise<boolean> {
	return FileManager.removeFile('documents', path);
}

/**
 * @description Checks whether a file exists, resolving relative paths against {@link Documents}.
 * @param path The file path to check, relative to {@link Documents} unless `inDocuments` is `false`.
 * @param inDocuments Whether to resolve `path` relative to {@link Documents}.
 * @returns A promise resolving to whether the file exists.
 */
export function exists(path: string, inDocuments: boolean = true): Promise<boolean> {
	return FileManager.fileExists(inDocuments ? `${Documents}/${path}` : path);
}

export default { Documents, read, write, rm, exists };
