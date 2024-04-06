export type DCDFileManagerConstants = {
	CacheDirPath: string;
	DocumentsDirPath: string;
};

export type DCDFileManagerType = DCDFileManagerConstants & {
	readFile(path: string, encoding: 'utf-8' | 'utf8' | 'base64'): Promise<string>;
	writeFile(type: 'documents' | 'cache', path: string, data: string, encoding: 'utf-8' | 'utf8' | 'base64'): Promise<string>;
	removeFile(type: 'documents' | 'cache', path: string): Promise<any>;
	readAsset(): Promise<unknown>;
	getSize(): Promise<unknown>;
	getVideoDimensions(): Promise<unknown>;
	fileExists(path: string): Promise<boolean>;
	saveFileToGallery(): Promise<unknown>;
	CacheDirPath: string;
	DocumentsDirPath: string;
	getConstants(): DCDFileManagerConstants;
};

export interface Payload {
	store: string;
	key: string;
	value: any;
}