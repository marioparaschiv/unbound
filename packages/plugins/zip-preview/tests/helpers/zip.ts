const encoder = new TextEncoder();

function header(size: number): { bytes: Uint8Array; view: DataView } {
	const bytes = new Uint8Array(size);

	return { bytes, view: new DataView(bytes.buffer) };
}

/**
 * @description Builds a stored (uncompressed) zip archive, enough for the lister's tests.
 * @param files The archive's entries, by name; a name ending in `/` is a folder.
 * @returns The archive bytes.
 */
export function storedZip(files: Record<string, string>): Uint8Array {
	const locals: Uint8Array[] = [];
	const entries: Uint8Array[] = [];
	let offset = 0;

	for (const [name, text] of Object.entries(files)) {
		const nameBytes = encoder.encode(name);
		const data = encoder.encode(text);
		const local = header(30 + nameBytes.length);

		local.view.setUint32(0, 0x04034b50, true);
		local.view.setUint32(18, data.length, true);
		local.view.setUint32(22, data.length, true);
		local.view.setUint16(26, nameBytes.length, true);
		local.bytes.set(nameBytes, 30);

		const entry = header(46 + nameBytes.length);

		entry.view.setUint32(0, 0x02014b50, true);
		entry.view.setUint32(20, data.length, true);
		entry.view.setUint32(24, data.length, true);
		entry.view.setUint16(28, nameBytes.length, true);
		entry.view.setUint32(42, offset, true);
		entry.bytes.set(nameBytes, 46);

		locals.push(local.bytes, data);
		entries.push(entry.bytes);
		offset += local.bytes.length + data.length;
	}

	const directorySize = entries.reduce((total, entry) => total + entry.length, 0);
	const end = header(22);

	end.view.setUint32(0, 0x06054b50, true);
	end.view.setUint16(8, entries.length, true);
	end.view.setUint16(10, entries.length, true);
	end.view.setUint32(12, directorySize, true);
	end.view.setUint32(16, offset, true);

	return new Uint8Array(Buffer.concat([...locals, ...entries, end.bytes]));
}
