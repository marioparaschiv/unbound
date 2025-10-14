import type { FileManagerEncoding, FileManagerType } from '@unbound-app/types/api/fs';
import { getNativeModule } from '~/api/native';


export type * from '@unbound-app/types/api/fs';

const FileManager: FileManagerType = getNativeModule('NativeFileModule', 'DCDFileManager', 'RTNFileManager');

export const Documents = FileManager.DocumentsDirPath;

export function read(path: string, encoding: FileManagerEncoding = 'utf8', inDocuments: boolean = true) {
	return FileManager.readFile(inDocuments ? `${Documents}/${path}` : path, encoding);
}

export function write(path: string, content: string, encoding: FileManagerEncoding = 'utf8') {
	return FileManager.writeFile('documents', path, content, encoding);
}

export function rm(path: string): Promise<boolean> {
	return FileManager.removeFile('documents', path);
}

export function exists(path: string, inDocuments: boolean = true): Promise<boolean> {
	return FileManager.fileExists(inDocuments ? `${Documents}/${path}` : path);
}

export default { Documents, read, write, rm, exists };