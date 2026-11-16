import { javaReference, javaString } from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge, NativeJavaReference } from '@unbound-app/api/native';
import { fs } from '@unbound-app/api';

import { locationOf, signedCoordinate, type PhotoMetadata, type UploadFile } from '~/lib/metadata';
import type { PhotoTools } from '~/native/photos';

type Java = NativeBridge['java'];

const NULL_STRING = { type: 'null', class: 'java.lang.String' } as const;

const LOCATION_TAGS = [
	'GPSLatitude',
	'GPSLatitudeRef',
	'GPSLongitude',
	'GPSLongitudeRef',
	'GPSAltitude',
	'GPSAltitudeRef',
	'GPSTimeStamp',
	'GPSDateStamp',
	'GPSProcessingMethod',
	'GPSAreaInformation',
];

const IDENTIFYING_TAGS = [
	'Make',
	'Model',
	'Software',
	'DateTime',
	'DateTimeOriginal',
	'DateTimeDigitized',
	'Artist',
	'Copyright',
	'LensMake',
	'LensModel',
	'BodySerialNumber',
	'CameraOwnerName',
	'ImageUniqueID',
	'UserComment',
	'ImageDescription',
];

function application(java: Java): NativeJavaReference | undefined {
	const app = java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []);

	return javaReference(app) ?? undefined;
}

function openStream(java: Java, file: UploadFile): NativeJavaReference | undefined {
	const app = application(java);
	const resolver = app ? javaReference(java.invoke(app, 'getContentResolver', [])) : undefined;
	const uri = javaReference(
		java.invoke(java.getClass('android.net.Uri'), 'parse', [javaString(file.uri)]),
	);

	const stream = resolver && uri ? java.invoke(resolver, 'openInputStream', [uri]) : undefined;

	return (stream && javaReference(stream)) || undefined;
}

function textOf(value: unknown): string | undefined {
	const read = (value as { value?: unknown } | null)?.value ?? value;

	return typeof read === 'string' && read ? read : undefined;
}

function degreesOf(value: string | undefined): number | undefined {
	if (!value) return undefined;

	const parts = value.split(',').map((part) => {
		const [top, bottom] = part.split('/').map(Number);

		return bottom ? top! / bottom : Number.NaN;
	});

	return parts.length === 3 && parts.every(Number.isFinite)
		? parts[0]! + parts[1]! / 60 + parts[2]! / 3600
		: undefined;
}

function readMetadata(java: Java, exif: NativeJavaReference): PhotoMetadata {
	const read = (tag: string) => textOf(java.invoke(exif, 'getAttribute', [javaString(tag)]));
	const location = locationOf(
		signedCoordinate(degreesOf(read('GPSLatitude')), read('GPSLatitudeRef')),
		signedCoordinate(degreesOf(read('GPSLongitude')), read('GPSLongitudeRef')),
	);
	const camera = [read('Make'), read('Model')].filter(Boolean).join(' ');
	const takenAt = read('DateTimeOriginal') ?? read('DateTime');
	const software = read('Software');

	return {
		...(location ? { location } : {}),
		...(camera ? { camera } : {}),
		...(takenAt ? { takenAt } : {}),
		...(software ? { software } : {}),
	};
}

/**
 * @description Reads and removes photo metadata on Android with `ExifInterface`. Android already hides photo locations
 * from Discord, which lacks the media location permission, so removing copies the photo and clears its camera, date
 * and other identifying tags in place, without re-encoding it.
 * @param native The plugin's native bridge.
 * @returns The tools.
 */
export function createPhotoTools({ java }: NativeBridge): PhotoTools | undefined {
	return {
		async inspect(file) {
			const stream = openStream(java, file);

			if (!stream) return {};

			try {
				return readMetadata(java, java.construct('android.media.ExifInterface', [stream]));
			} finally {
				java.invoke(stream, 'close', []);
			}
		},
		async strip(file, _metadata, folder) {
			const stream = openStream(java, file);
			const filename = file.filename ?? 'photo.jpg';

			if (!stream) return undefined;

			const relative = `${folder}/${Date.now()}`;

			await fs.writeFile(`${relative}/.keep`, '');

			const path = `${fs.documentsPath}/${relative}/${filename}`;
			const target = java.construct('java.io.File', [javaString(path)]);
			const output = java.construct('java.io.FileOutputStream', [target]);

			try {
				java.invoke(java.getClass('android.os.FileUtils'), 'copy', [stream, output]);
			} finally {
				java.invoke(stream, 'close', []);
				java.invoke(output, 'close', []);
			}

			const exif = java.construct('android.media.ExifInterface', [javaString(path)]);
			for (const tag of [...LOCATION_TAGS, ...IDENTIFYING_TAGS]) {
				java.invoke(exif, 'setAttribute', [javaString(tag), NULL_STRING]);
			}

			java.invoke(exif, 'saveAttributes', []);

			return { uri: `file://${path}`, filename, mimeType: file.mimeType ?? 'image/jpeg' };
		},
	};
}

export default { createPhotoTools };
