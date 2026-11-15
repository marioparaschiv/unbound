import type { NativeBridge } from '@unbound-app/api/native';

const SCANNER_VIEW = 'com.budiyev.android.codescanner.CodeScannerView';

/** The obfuscated classes of the ZXing build Discord's QR scanner carries, found by shape. */
export type ZXingClasses = {
	reader: string;
	task: string;
	point: string;
	rect: string;
	decode: string;
	result: string;
	text: string;
};

type Java = NativeBridge['java'];

function fieldTypes(java: Java, name: string): string[] {
	return java
		.describe(name)
		.fields.filter((field) => !field.static)
		.map((field) => field.type);
}

function ownClasses(types: string[]): string[] {
	return types.filter((type) => !/^(java|android|kotlin)\.|^\[|^[a-z]+$/.test(type));
}

function findType(
	java: Java,
	types: string[],
	matches: (name: string) => boolean,
): string | undefined {
	return ownClasses(types).find((type) => {
		try {
			return matches(type);
		} catch {
			return false;
		}
	});
}

function isTask(java: Java, name: string): boolean {
	return java
		.describe(name)
		.constructors.some(
			(parameters) =>
				parameters.length === 7 &&
				parameters[0] === '[B' &&
				parameters[5] === 'int' &&
				parameters[6] === 'boolean',
		);
}

/**
 * @description Finds ZXing inside Discord by walking from its QR scanner view, whose name Discord keeps: the scanner,
 * its camera decoder, the decoder's reader and its decode task. Each Discord build renames these classes.
 * @param java The plugin's Java bridge.
 * @returns The classes and names, or `undefined` when Discord no longer carries the scanner.
 */
export function findZXing(java: Java): ZXingClasses | undefined {
	const scanner = findType(java, fieldTypes(java, SCANNER_VIEW), (type) =>
		fieldTypes(java, type).includes(SCANNER_VIEW),
	);
	const camera =
		scanner &&
		findType(java, fieldTypes(java, scanner), (type) =>
			fieldTypes(java, type).includes('android.hardware.Camera'),
		);
	const decoder =
		camera &&
		findType(java, fieldTypes(java, camera), (type) =>
			fieldTypes(java, type).includes('java.util.EnumMap'),
		);

	if (!decoder) return undefined;

	const decoderFields = fieldTypes(java, decoder);
	const reader = findType(java, decoderFields, (type) => {
		const fields = fieldTypes(java, type);

		return fields.includes('java.util.Map') && fields.some((field) => field.startsWith('['));
	});
	const task = findType(java, decoderFields, (type) => isTask(java, type));

	if (!reader || !task) return undefined;

	const parameters =
		java.describe(task).constructors.find((candidate) => candidate.length === 7) ?? [];
	const decode = java
		.describe(task)
		.methods.find(
			(method) => method.parameters.length === 1 && method.parameters[0] === reader,
		);
	const text =
		decode &&
		java.describe(decode.returnType).fields.find((field) => field.type === 'java.lang.String');

	if (!decode || !text || !parameters[1] || !parameters[4]) return undefined;

	return {
		reader,
		task,
		point: parameters[1],
		rect: parameters[4],
		decode: decode.name,
		result: decode.returnType,
		text: text.name,
	};
}

export default findZXing;
