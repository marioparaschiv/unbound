import {
	getNativeModule,
	NativePlatform,
	type DCDFileManagerEncoding,
	type DCDFileManagerType,
} from '~/native/native';
import { unboundRelativePath } from '~/native/unbound-path';

const FileManager: DCDFileManagerType = getNativeModule(
	'NativeFileModule',
	'DCDFileManager',
	'RTNFileManager',
);

/** Absolute path to the platform's documents directory. */
export const documentsPath =
	FileManager.DocumentsDirPath ?? FileManager.getConstants().DocumentsDirPath;

/** @deprecated Use documentsPath */
export const Documents = documentsPath;

/**
 * @description Reads a file's contents, resolving relative paths against {@link documentsPath}.
 * @param path The file path to read, relative to {@link documentsPath} unless `inDocuments` is `false`.
 * @param encoding The encoding to read the file with.
 * @param inDocuments Whether to resolve `path` relative to {@link documentsPath}.
 * @returns A promise resolving to the file's contents.
 */
export function readFile(
	path: string,
	encoding: DCDFileManagerEncoding = 'utf8',
	inDocuments: boolean = true,
) {
	return FileManager.readFile(inDocuments ? `${documentsPath}/${path}` : path, encoding);
}

/** @deprecated Use readFile */
export const read = readFile;

/**
 * @description Writes content to a file within {@link documentsPath}.
 * @param path The file path to write to, relative to {@link documentsPath}.
 * @param content The content to write.
 * @param encoding The encoding to write the file with.
 * @returns A promise resolving once the file is written.
 */
export function writeFile(
	path: string,
	content: string,
	encoding: DCDFileManagerEncoding = 'utf8',
) {
	return FileManager.writeFile('documents', path, content, encoding);
}

/** @deprecated Use writeFile */
export const write = writeFile;

/**
 * @description Removes a file or a whole folder within {@link documentsPath}.
 * @param path The path to remove, relative to {@link documentsPath}.
 * @returns A promise resolving to whether anything was removed.
 */
export function removeFile(path: string): Promise<boolean> {
	const relative = unboundRelativePath(path);
	const files = NativePlatform?.files;

	if (relative && files) {
		return Promise.resolve(files.remove(relative));
	}

	return FileManager.removeFile('documents', path);
}

/** @deprecated Use removeFile */
export const rm = removeFile;

/**
 * @description Checks whether a file exists, resolving relative paths against {@link documentsPath}.
 * @param path The file path to check, relative to {@link documentsPath} unless `inDocuments` is `false`.
 * @param inDocuments Whether to resolve `path` relative to {@link documentsPath}.
 * @returns A promise resolving to whether the file exists.
 */
export function exists(path: string, inDocuments: boolean = true): Promise<boolean> {
	return FileManager.fileExists(inDocuments ? `${documentsPath}/${path}` : path);
}

export default {
	documentsPath,
	Documents,
	readFile,
	read,
	writeFile,
	write,
	removeFile,
	rm,
	exists,
};
