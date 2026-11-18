import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

type ObjC = NativeBridge['objc'];

const READ_WRITE = 2;
const AUTHORIZED = 3;
const LIMITED = 4;
const ALBUM_TYPE = 1;
const REGULAR_ALBUM = 2;
const RECENT_MS = 15_000;

function library(objc: ObjC): NativeObjectHandle {
	return objc.call(objc.getClass('PHPhotoLibrary')!, 'sharedPhotoLibrary') as NativeObjectHandle;
}

function fetched(objc: ObjC, result: NativeObjectHandle): NativeObjectHandle[] {
	const count = Number(objc.invoke(result, 'count', []));

	return Array.from(
		{ length: count },
		(_, index) => objc.invoke(result, 'objectAtIndex:', [index]) as NativeObjectHandle,
	);
}

function findAlbum(objc: ObjC, title: string): NativeObjectHandle | undefined {
	const result = objc.call(
		objc.getClass('PHAssetCollection')!,
		'fetchAssetCollectionsWithType:subtype:options:',
		ALBUM_TYPE,
		REGULAR_ALBUM,
		null,
	) as NativeObjectHandle;

	return fetched(objc, result).find(
		(album) => String(objc.invoke(album, 'localizedTitle', [])) === title,
	);
}

function performChanges(objc: ObjC, change: () => void): void {
	const block = objc.block({ returnType: 'void', args: [] }, change as never);

	objc.invoke(library(objc), 'performChangesAndWait:error:', [block, null]);
}

function albumNamed(objc: ObjC, title: string): NativeObjectHandle | undefined {
	const existing = findAlbum(objc, title);

	if (existing) return existing;

	performChanges(objc, () => {
		objc.call(
			objc.getClass('PHAssetCollectionChangeRequest')!,
			'creationRequestForAssetCollectionWithTitle:',
			title,
		);
	});

	return findAlbum(objc, title);
}

function newestAsset(objc: ObjC, since: number): NativeObjectHandle | undefined {
	const options = objc.create('PHFetchOptions', 'init', []) as NativeObjectHandle;
	const newestFirst = objc.call(
		objc.getClass('NSSortDescriptor')!,
		'sortDescriptorWithKey:ascending:',
		'creationDate',
		false,
	);

	objc.invoke(options, 'setSortDescriptors:', [[newestFirst]]);
	objc.invoke(options, 'setFetchLimit:', [1]);

	const [asset] = fetched(
		objc,
		objc.call(
			objc.getClass('PHAsset')!,
			'fetchAssetsWithOptions:',
			options,
		) as NativeObjectHandle,
	);
	const created = asset
		? Number(
				objc.invoke(
					objc.invoke(asset, 'creationDate', []) as NativeObjectHandle,
					'timeIntervalSince1970',
					[],
				),
			)
		: 0;

	return asset && created * 1000 >= since - RECENT_MS ? asset : undefined;
}

/**
 * @description Tells whether the app may read the photo library, which finding the saved item and the album needs.
 * @param native The plugin's native bridge.
 * @returns Whether full or limited access is granted.
 */
export function canReadLibrary({ objc }: NativeBridge): boolean {
	const status = Number(
		objc.call(
			objc.getClass('PHPhotoLibrary')!,
			'authorizationStatusForAccessLevel:',
			READ_WRITE,
		),
	);

	return status === AUTHORIZED || status === LIMITED;
}

/**
 * @description Asks for full photo library access, which iOS shows once.
 * @param native The plugin's native bridge.
 * @returns Whether access was granted.
 */
export function askForLibrary({ objc }: NativeBridge): Promise<boolean> {
	return new Promise((resolve) => {
		const done = objc.block({ returnType: 'void', args: ['i64'] }, ((status: number) =>
			resolve(Number(status) === AUTHORIZED || Number(status) === LIMITED)) as never);

		objc.call(
			objc.getClass('PHPhotoLibrary')!,
			'requestAuthorizationForAccessLevel:handler:',
			READ_WRITE,
			done,
		);
	});
}

/**
 * @description Files the newest item in the photo library into an album, making the album when it is missing. Only an
 * item added after `since` counts, so an older photo is never moved.
 * @param native The plugin's native bridge.
 * @param title The album's name.
 * @param since When the save started, in milliseconds.
 * @returns Whether an item was filed.
 */
export function fileNewestAsset({ objc }: NativeBridge, title: string, since: number): boolean {
	const asset = newestAsset(objc, since);
	const album = asset && albumNamed(objc, title);

	if (!asset || !album) return false;

	performChanges(objc, () => {
		const request = objc.call(
			objc.getClass('PHAssetCollectionChangeRequest')!,
			'changeRequestForAssetCollection:',
			album,
		) as NativeObjectHandle;

		objc.invoke(request, 'addAssets:', [[asset]]);
	});

	return true;
}
