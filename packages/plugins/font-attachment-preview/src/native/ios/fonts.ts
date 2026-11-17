import type { NativeBridge, NativeFFIType, NativePointer } from '@unbound-app/api/native';

import type { FontHost } from '~/native/fonts';

const UTF8 = 0x08000100;
const NAME_BYTES = 256;

type Ffi = NativeBridge['ffi'];

function call<T>(
	ffi: Ffi,
	name: string,
	returnType: NativeFFIType,
	args: NativeFFIType[],
	...values: unknown[]
): T {
	const symbol = ffi.symbol(name);

	if (!symbol) throw new Error(`${name} is missing`);

	return ffi.call(symbol, { returnType, args }, ...values) as T;
}

function cString(ffi: Ffi, text: string): NativePointer {
	const bytes = new TextEncoder().encode(text);
	const pointer = ffi.alloc(bytes.byteLength + 1);

	ffi.writeBytes(pointer, Uint8Array.from([...bytes, 0]));

	return pointer;
}

function readCString(ffi: Ffi, pointer: NativePointer, size: number): string {
	const bytes = ffi.readBytes(pointer, size);
	const end = bytes.indexOf(0);

	return String.fromCharCode(...bytes.subarray(0, end < 0 ? size : end));
}

function inflate(ffi: Ffi, compressed: Uint8Array, length: number): Uint8Array {
	const source = ffi.alloc(compressed.byteLength);
	const target = ffi.alloc(length);
	const targetLength = ffi.alloc(8);

	try {
		ffi.writeBytes(source, compressed);
		ffi.write(targetLength, 'u64', BigInt(length), 0);

		const status = call<number>(
			ffi,
			'uncompress',
			'i32',
			['pointer', 'pointer', 'pointer', 'u64'],
			target,
			targetLength,
			source,
			BigInt(compressed.byteLength),
		);

		if (status !== 0) throw new Error(`zlib returned ${status}`);

		return ffi.readBytes(target, Number(ffi.read(targetLength, 'u64', 0)));
	} finally {
		ffi.free(source);
		ffi.free(target);
		ffi.free(targetLength);
	}
}

function release(ffi: Ffi, ...objects: (NativePointer | null)[]) {
	for (const object of objects) {
		if (object) call(ffi, 'CFRelease', 'void', ['pointer'], object);
	}
}

function register(ffi: Ffi, path: string): string {
	const file = cString(ffi, path);
	const name = ffi.alloc(NAME_BYTES);
	const length = BigInt(new TextEncoder().encode(path).byteLength);
	const url = call<NativePointer | null>(
		ffi,
		'CFURLCreateFromFileSystemRepresentation',
		'pointer',
		['pointer', 'pointer', 'i64', 'bool'],
		null,
		file,
		length,
		false,
	);
	const provider = url
		? call<NativePointer | null>(
				ffi,
				'CGDataProviderCreateWithURL',
				'pointer',
				['pointer'],
				url,
			)
		: null;
	const font = provider
		? call<NativePointer | null>(
				ffi,
				'CGFontCreateWithDataProvider',
				'pointer',
				['pointer'],
				provider,
			)
		: null;
	const postScript = font
		? call<NativePointer | null>(ffi, 'CGFontCopyPostScriptName', 'pointer', ['pointer'], font)
		: null;

	try {
		if (!font || !postScript) throw new Error('iOS could not read the font');

		call(
			ffi,
			'CFStringGetCString',
			'bool',
			['pointer', 'pointer', 'i64', 'u32'],
			postScript,
			name,
			BigInt(NAME_BYTES),
			UTF8,
		);
		call(ffi, 'CTFontManagerRegisterGraphicsFont', 'bool', ['pointer', 'pointer'], font, null);

		return readCString(ffi, name, NAME_BYTES);
	} finally {
		release(ffi, postScript, font, provider, url);
		ffi.free(file);
		ffi.free(name);
	}
}

/**
 * @description Loads fonts on iOS: zlib's `uncompress` for WOFF tables, Core Graphics to read the file and Core Text to
 * register it for this process under its PostScript name.
 * @param bridge The plugin's native bridge.
 * @returns The font host.
 */
export function createFontHost(bridge: NativeBridge): FontHost {
	const { ffi } = bridge;

	return {
		inflate: (compressed, length) => inflate(ffi, compressed, length),
		register: async (path) => register(ffi, path),
	};
}
