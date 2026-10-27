import type {
	NativeJavaBridge,
	NativeJavaFieldDescription,
	NativeJavaMethodDescription,
} from '@unbound-app/api/native';
import { describeJavaClass } from '@unbound-plugins/shared/native/android/java-classes';

import shapes from './discord-shapes.json';

export type DiscordShapeName = keyof typeof shapes;

type DiscordShape = {
	owner?: string;
	member: string;
	name?: string;
	static?: boolean;
	type?: string;
	firstParameter?: string;
	parameterCount?: number;
	parameters?: string[];
	pick: string;
};

const DISCORD_SHAPES: Record<DiscordShapeName, DiscordShape> = shapes;

const LOADER_ONLY_KEYS = [
	'ownerShape',
	'parameterOf',
	'typeAssignableTo',
	'returnsAssignableFrom',
	'count',
] as const;

function shapeOf(name: DiscordShapeName, member: string): DiscordShape {
	const shape = DISCORD_SHAPES[name];
	const loaderOnly = LOADER_ONLY_KEYS.filter((key) => key in shape);

	if (loaderOnly.length > 0) {
		throw new Error(
			`The Discord shape ${name} uses ${loaderOnly.join(', ')}, which only the Android loader applies.`,
		);
	}

	if (shape.member !== member) {
		throw new Error(`The Discord shape ${name} describes a ${shape.member}, not a ${member}.`);
	}

	return shape;
}

function ownerOf(name: DiscordShapeName, className: string | undefined): string {
	const owner = className ?? DISCORD_SHAPES[name].owner;

	if (!owner) {
		throw new Error(`The Discord shape ${name} needs the class to look in.`);
	}

	return owner;
}

type ShapeMember = {
	name: string;
	static: boolean;
};

function matchesParameters(shape: DiscordShape, parameters: string[]): boolean {
	if (shape.firstParameter !== undefined && parameters[0] !== shape.firstParameter) {
		return false;
	}

	if (shape.parameterCount !== undefined && parameters.length !== shape.parameterCount) {
		return false;
	}

	return (
		shape.parameters === undefined ||
		(shape.parameters.length === parameters.length &&
			shape.parameters.every((parameter, index) => parameter === parameters[index]))
	);
}

function matchesMember(shape: DiscordShape, member: ShapeMember): boolean {
	return (
		(shape.name === undefined || member.name === shape.name) &&
		(shape.static === undefined || member.static === shape.static)
	);
}

function pick<T>(shape: DiscordShape, matches: T[], parameters: (match: T) => string[]): T | null {
	const longest = Math.max(0, ...matches.map((match) => parameters(match).length));
	const picked =
		shape.pick === 'most-parameters'
			? matches.filter((match) => parameters(match).length === longest)
			: matches;

	return picked.length === 1 ? picked[0] : null;
}

/**
 * @description Finds the method a Discord shape describes, for code that cannot name an obfuscated method. The compat scan checks the same shape against each Discord build.
 * @param java The Java bridge.
 * @param name The shape's name in `discord-shapes.json`.
 * @param className The class to look in, when the shape has no owner of its own.
 * @returns The method, or `null` when no method or several fit the shape.
 */
export function shapeMethod(
	java: NativeJavaBridge,
	name: DiscordShapeName,
	className?: string,
): NativeJavaMethodDescription | null {
	const shape = shapeOf(name, 'method');
	const matches = describeJavaClass(java, ownerOf(name, className)).methods.filter(
		(method) => matchesMember(shape, method) && matchesParameters(shape, method.parameters),
	);

	return pick(shape, matches, (method) => method.parameters);
}

/**
 * @description Finds the field a Discord shape describes, for code that cannot name an obfuscated field. The compat scan checks the same shape against each Discord build.
 * @param java The Java bridge.
 * @param name The shape's name in `discord-shapes.json`.
 * @param className The class to look in, when the shape has no owner of its own.
 * @returns The field, or `null` when no field or several fit the shape.
 */
export function shapeField(
	java: NativeJavaBridge,
	name: DiscordShapeName,
	className?: string,
): NativeJavaFieldDescription | null {
	const shape = shapeOf(name, 'field');
	const matches = describeJavaClass(java, ownerOf(name, className)).fields.filter(
		(field) =>
			matchesMember(shape, field) && (shape.type === undefined || field.type === shape.type),
	);

	return pick(shape, matches, () => []);
}

/**
 * @description Tells whether a class has the constructor a Discord shape describes, for recognising obfuscated classes. The compat scan checks the same shape against each Discord build.
 * @param java The Java bridge.
 * @param name The shape's name in `discord-shapes.json`.
 * @param className The class to look in, when the shape has no owner of its own.
 * @returns Whether exactly one constructor fits the shape.
 */
export function hasShapeConstructor(
	java: NativeJavaBridge,
	name: DiscordShapeName,
	className?: string,
): boolean {
	const shape = shapeOf(name, 'constructor');
	const matches = describeJavaClass(java, ownerOf(name, className)).constructors.filter(
		(parameters) => matchesParameters(shape, parameters),
	);

	return pick(shape, matches, (parameters) => parameters) !== null;
}
