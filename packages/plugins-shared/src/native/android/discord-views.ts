import {
	javaInt,
	javaNumber,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import type {
	NativeJavaBridge,
	NativeJavaMethodDescription,
	NativeJavaReference,
} from '@unbound-app/api/native';
import { shapeField, shapeMethod } from '@unbound-plugins/shared/native/android/discord-shapes';

export const MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
export const DRAWEE_TEXT_VIEW = 'com.facebook.drawee.span.SimpleDraweeSpanTextView';
export const DRAWEE_TEXT_SETTER = 'setDraweeSpanStringBuilder';

const DISCORD_PACKAGE = 'com.discord';

const viewIds = new Map<string, number>();

/**
 * @description Finds the method a `MessageView` binds a message with. Discord obfuscates its name and most parameter types, but on every build it takes the message first and has the most parameters.
 * @param java The Java bridge.
 * @returns The method's name and parameter types, ready to hook.
 */
export function messageBindMethod(java: NativeJavaBridge): NativeJavaMethodDescription {
	const method = shapeMethod(java, 'messageBind');

	if (!method) {
		throw new Error(
			'This Discord build has no single MessageView method that binds a message.',
		);
	}

	return method;
}

/**
 * @description Finds the span builder class that Discord's drawee text views take. Fresco's class is obfuscated on newer builds, but it stays the only parameter of the setter.
 * @param java The Java bridge.
 * @returns The builder's class name.
 */
export function draweeTextBuilder(java: NativeJavaBridge): string {
	const builder = shapeMethod(java, 'draweeTextBuilder')?.parameters[0];

	if (!builder) {
		throw new Error('This Discord build has no single drawee span text builder setter.');
	}

	return builder;
}

/**
 * @description Names the field holding the id of the message a `MessageView` shows, its only `String` field.
 * @param java The Java bridge.
 * @returns The field name.
 */
export function messageIdField(java: NativeJavaBridge): string {
	const field = shapeField(java, 'messageId');

	if (!field) {
		throw new Error('MessageView has no single text field, so its message id is ambiguous.');
	}

	return field.name;
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

/**
 * @description Finds a descendant view by the name of its Discord resource id, reading the views on the main thread.
 * @param java The Java bridge.
 * @param view The view to search under.
 * @param name The id's resource name, such as `accessories_view`.
 * @returns The view, or `null` when the view has no such descendant.
 */
export async function viewByIdNameAsync(
	java: NativeJavaBridge,
	view: NativeJavaReference,
	name: string,
): Promise<NativeJavaReference | null> {
	let id = viewIds.get(name);

	if (id === undefined) {
		const resources = javaReference(await java.invokeAsync(view, 'getResources', []));

		id = resources ? resourceId(java, resources, name) : undefined;
	}

	return id ? javaReference(await java.invokeAsync(view, 'findViewById', [javaInt(id)])) : null;
}

function resourceId(
	java: NativeJavaBridge,
	resources: NativeJavaReference,
	name: string,
): number | undefined {
	const id = javaNumber(
		java.invoke(resources, 'getIdentifier', [
			javaString(name),
			javaString('id'),
			javaString(DISCORD_PACKAGE),
		]),
	);

	if (id) {
		viewIds.set(name, id);
	}

	return id;
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
