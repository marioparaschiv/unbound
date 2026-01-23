import type { DCDFileManagerEncoding, DCDFileManagerType } from '@unbound-app/types/discord/native';
import { getNativeModule } from '~/api/native';


const FileManager: DCDFileManagerType = getNativeModule('NativeFileModule', 'DCDFileManager', 'RTNFileManager');

export const Documents = FileManager.DocumentsDirPath;

export function read(path: string, encoding: DCDFileManagerEncoding = 'utf8', inDocuments: boolean = true) {
	return FileManager.readFile(inDocuments ? `${Documents}/${path}` : path, encoding);
}

export function write(path: string, content: string, encoding: DCDFileManagerEncoding = 'utf8') {
	return FileManager.writeFile('documents', path, content, encoding);
}

export function rm(path: string): Promise<boolean> {
	return FileManager.removeFile('documents', path);
}

export function exists(path: string, inDocuments: boolean = true): Promise<boolean> {
	return FileManager.fileExists(inDocuments ? `${Documents}/${path}` : path);
}

export default { Documents, read, write, rm, exists };