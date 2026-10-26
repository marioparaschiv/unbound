import type {
	NativeJavaBridge,
	NativeJavaClassDescription,
	NativeJavaMethodDescription,
	NativeJavaReference,
} from '@unbound-app/api/native';
import {
	javaInt,
	javaNumber,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';

export const MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
export const MESSAGE = 'com.discord.chat.bridge.Message';
export const DRAWEE_TEXT_VIEW = 'com.facebook.drawee.span.SimpleDraweeSpanTextView';
export const DRAWEE_TEXT_SETTER = 'setDraweeSpanStringBuilder';

const DISCORD_PACKAGE = 'com.discord';
const STRING = 'java.lang.String';

const descriptions = new Map<string, NativeJavaClassDescription>();
const viewIds = new Map<string, number>();

/**
 * @description Describes a Java class once and reuses the description, since a class does not change while Discord runs.
 * @param java The Java bridge.
 * @param name The class name.
 * @returns The class's declared constructors, methods and fields.
 */
export function describeJavaClass(
	java: NativeJavaBridge,
	name: string,
): NativeJavaClassDescription {
	const cached = descriptions.get(name);

	if (cached) {
		return cached;
	}

	const description = java.describe(name);

	descriptions.set(name, description);

	return description;
}

/**
 * @description Finds the method a `MessageView` binds a message with. Discord obfuscates its name and most parameter types, but on every build it takes the message first and has the most parameters.
 * @param java The Java bridge.
 * @returns The method's name and parameter types, ready to hook.
 */
export function messageBindMethod(java: NativeJavaBridge): NativeJavaMethodDescription {
	const candidates = describeJavaClass(java, MESSAGE_VIEW).methods.filter(
		(method) => !method.static && method.parameters[0] === MESSAGE,
	);
	const longest = candidates.reduce<NativeJavaMethodDescription | null>(
		(best, method) =>
			best === null || method.parameters.length > best.parameters.length ? method : best,
		null,
	);

	if (!longest) {
		throw new Error('This Discord build has no MessageView method that binds a message.');
	}

	return longest;
}

/**
 * @description Finds the span builder class that Discord's drawee text views take. Fresco's class is obfuscated on newer builds, but it stays the only parameter of the setter.
 * @param java The Java bridge.
 * @returns The builder's class name.
 */
export function draweeTextBuilder(java: NativeJavaBridge): string {
	const builder = describeJavaClass(java, DRAWEE_TEXT_VIEW).methods.find(
		(method) => method.name === DRAWEE_TEXT_SETTER && method.parameters.length === 1,
	)?.parameters[0];

	if (!builder) {
		throw new Error('This Discord build has no drawee span text builder setter.');
	}

	return builder;
}

/**
 * @description Names the field holding the id of the message a `MessageView` shows, its only `String` field.
 * @param java The Java bridge.
 * @returns The field name.
 */
export function messageIdField(java: NativeJavaBridge): string {
	const fields = describeJavaClass(java, MESSAGE_VIEW).fields.filter(
		(field) => !field.static && field.type === STRING,
	);

	if (fields.length !== 1) {
		throw new Error(
			`MessageView has ${fields.length} text fields, so its message id is ambiguous.`,
		);
	}

	return fields[0].name;
}

/**
 * @description Finds a descendant view by the name of its Discord resource id. Resource ids keep their names on every build, unlike the view binding classes.
 * @param java The Java bridge.
 * @param view The view to search under.
 * @param name The id's resource name, such as `author_name`.
 * @returns The view, or `null` when the view has no such descendant.
 */
export function viewByIdName(
	java: NativeJavaBridge,
	view: NativeJavaReference,
	name: string,
): NativeJavaReference | null {
	const id = viewId(java, view, name);

	return id ? javaReference(java.invoke(view, 'findViewById', [javaInt(id)])) : null;
}

function viewId(
	java: NativeJavaBridge,
	view: NativeJavaReference,
	name: string,
): number | undefined {
	const cached = viewIds.get(name);

	if (cached !== undefined) {
		return cached;
	}

	const resources = javaReference(java.invoke(view, 'getResources', []));
	const id = resources
		? javaNumber(
				java.invoke(resources, 'getIdentifier', [
					javaString(name),
					javaString('id'),
					javaString(DISCORD_PACKAGE),
				]),
			)
		: undefined;

	if (id) {
		viewIds.set(name, id);
	}

	return id;
}
