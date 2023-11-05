export type DCDPhotosType = {
	saveToCameraRoll: Fn;
	getAlbums(args: string[]): Promise<unknown>;
	getPhotos(args: string[]): Promise<unknown>;
	deletePhotos(uris: string[]): Promise<string | boolean>;
	getPhotoByInternalID(id: string): Promise<unknown>;
	getConstants(): AnyProps;
};

type DCDFileManagerConstants = {
	CacheDirPath: string;
	DocumentsDirPath: string;
};

export type DCDFileManagerType = DCDFileManagerConstants & {
	readFile(path: string): Promise<unknown>;
	writeFile(type: 'documents' | 'cache', path: string, data: string, encoding: 'utf-8' | 'utf8' | 'base64'): Promise<string>;
	deleteFile(type: 'documents' | 'cache' | 'full', path: string): Promise<string>;
	readAsset(): Promise<unknown>;
	getSize(): Promise<unknown>;
	getVideoDimensions(): Promise<unknown>;
	fileExists(path: string): Promise<boolean>;
	saveFileToGallery(): Promise<unknown>;
	CacheDirPath: string;
	DocumentsDirPath: string;
	getConstants(): DCDFileManagerConstants;
};