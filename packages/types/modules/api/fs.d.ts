export type FileManagerEncoding = 'utf-8' | 'utf8' | 'base64';

export interface FileManagerConstants {
	CacheDirPath: string;
	DocumentsDirPath: string;
};

export interface FileManagerType extends FileManagerConstants {
	readFile(path: string, encoding: FileManagerEncoding): Promise<string>;
	writeFile(type: 'documents' | 'cache', path: string, data: string, encoding: FileManagerEncoding): Promise<string>;
	removeFile(type: 'documents' | 'cache', path: string): Promise<any>;
	readAsset(): Promise<unknown>;
	getSize(): Promise<unknown>;
	getVideoDimensions(): Promise<unknown>;
	fileExists(path: string): Promise<boolean>;
	saveFileToGallery(): Promise<unknown>;
	CacheDirPath: string;
	DocumentsDirPath: string;
	getConstants(): FileManagerConstants;
};