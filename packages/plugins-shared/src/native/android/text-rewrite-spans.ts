import {
	covers,
	fits,
	overlapsStretch,
	restretchedRange,
	stretches,
	type TextEdit,
} from '@unbound-plugins/shared/native/android/text-edits';
import {
	classNames,
	invokeNumber,
	nothing,
	textOf,
	type Rule,
	type State,
} from '@unbound-plugins/shared/native/android/text-rewrite-state';
import type {
	NativeJavaArgument,
	NativeJavaBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import { javaInt, javaReference } from '@unbound-plugins/shared/native/android/java-values';

const SPAN_EXCLUSIVE_EXCLUSIVE = 33;
const PLACEHOLDER = '￼';
const ALIGN_BOTTOM = 0;
const ALIGN_CENTER = 2;

type Stretched = { span: NativeJavaReference; flags: number; stretch: boolean };

function clearSpans(
	java: NativeJavaBridge,
	builder: NativeJavaReference,
	state: State,
	from: number,
	to: number,
) {
	'worklet';

	if (from < 0 || to <= from) return;

	const spans = java.invoke(builder, 'getSpans', [javaInt(from), javaInt(to), state.objectClass]);

	for (const span of spans.type === 'array' ? spans.value : []) {
		const reference = javaReference(span as NativeJavaValue);

		if (!reference) {
			continue;
		}

		const start = invokeNumber(java, builder, 'getSpanStart', [reference]);
		const end = invokeNumber(java, builder, 'getSpanEnd', [reference]);

		if (start >= from && end <= to) {
			java.invoke(builder, 'removeSpan', [reference]);
		}
	}
}

function stretchedSpans(state: State, builder: NativeJavaReference, edit: TextEdit): Stretched[] {
	'worklet';

	if (!stretches(edit)) {
		return [];
	}

	const java = state.java;
	const spans = java.invoke(builder, 'getSpans', [
		javaInt(edit.stretchFrom),
		javaInt(edit.stretchTo),
		state.objectClass,
	]);
	const stretched: Stretched[] = [];

	for (const span of spans.type === 'array' ? spans.value : []) {
		const reference = javaReference(span as NativeJavaValue);

		if (!reference) {
			continue;
		}

		const start = invokeNumber(java, builder, 'getSpanStart', [reference]);
		const end = invokeNumber(java, builder, 'getSpanEnd', [reference]);

		if (!overlapsStretch(start, end, edit)) {
			continue;
		}

		const named = classNames(java, reference).some((name) =>
			edit.stretchClasses.includes(name),
		);

		stretched.push({
			span: reference,
			flags: invokeNumber(java, builder, 'getSpanFlags', [reference]),
			stretch: named || covers(start, end, edit),
		});
	}

	return stretched;
}

function restretch(
	java: NativeJavaBridge,
	builder: NativeJavaReference,
	edit: TextEdit,
	spans: Stretched[],
) {
	'worklet';

	for (const entry of spans) {
		const range = restretchedRange(
			entry.stretch,
			invokeNumber(java, builder, 'getSpanStart', [entry.span]),
			invokeNumber(java, builder, 'getSpanEnd', [entry.span]),
			edit,
		);

		java.invoke(builder, 'removeSpan', [entry.span]);

		if (range) {
			java.invoke(builder, 'setSpan', [
				entry.span,
				javaInt(range[0]),
				javaInt(range[1]),
				javaInt(entry.flags),
			]);
		}
	}
}

function insertImage(
	state: State,
	builder: NativeJavaReference,
	edit: TextEdit,
	length: number,
): boolean {
	'worklet';
	const java = state.java;
	const bitmap = edit.imageKey ? state.images.get(edit.imageKey) : undefined;
	const index = edit.start + edit.imageOffset;

	if (!bitmap || index < 0 || index >= length) {
		return false;
	}

	const drawable = java.construct('android.graphics.drawable.BitmapDrawable', [
		nothing('android.content.res.Resources'),
		bitmap,
	]);

	java.invoke(drawable, 'setBounds', [
		javaInt(0),
		javaInt(0),
		javaInt(edit.imageSize),
		javaInt(edit.imageSize),
	]);
	java.invoke(builder, 'setSpan', [
		java.construct('android.text.style.ImageSpan', [drawable, javaInt(ALIGN_CENTER)]),
		javaInt(index),
		javaInt(index + 1),
		javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
	]);

	return true;
}

function addSpacer(java: NativeJavaBridge, builder: NativeJavaReference, edit: TextEdit) {
	'worklet';
	const spacer = edit.start + edit.spacerOffset;
	const text = textOf(java, builder) ?? '';

	if (edit.spacerOffset < 0 || spacer >= text.length || text[spacer] !== PLACEHOLDER) return;

	const drawable = java.construct('android.graphics.drawable.ColorDrawable', [javaInt(0)]);

	java.invoke(drawable, 'setBounds', [
		javaInt(0),
		javaInt(0),
		javaInt(edit.width),
		javaInt(edit.height),
	]);
	java.invoke(builder, 'setSpan', [
		java.construct('android.text.style.ImageSpan', [drawable, javaInt(ALIGN_BOTTOM)]),
		javaInt(spacer),
		javaInt(spacer + 1),
		javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
	]);

	if (edit.collapseNext && spacer + 2 <= text.length && text[spacer + 1] === '\n') {
		java.invoke(builder, 'setSpan', [
			java.construct('android.text.style.AbsoluteSizeSpan', [javaInt(1)]),
			javaInt(spacer + 1),
			javaInt(spacer + 2),
			javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
		]);
	}
}

/**
 * @description Applies a rule's edits to a text, keeping its spans, drawing its images and sizing its spacers.
 * @param state The connection's state.
 * @param text The text Discord set.
 * @param rule The rule.
 * @returns The rewritten text, or `null` when an edit no longer fits or the result is not the rule's rendered text.
 */
export function applyRule(
	state: State,
	text: NativeJavaArgument,
	rule: Rule,
): NativeJavaArgument | null {
	'worklet';
	const java = state.java;
	const builder = java.construct('android.text.SpannableStringBuilder', [text]);

	for (const edit of rule.edits) {
		const length = invokeNumber(java, builder, 'length');

		if (!fits(edit, length)) return null;

		clearSpans(java, builder, state, edit.clearFrom, edit.clearTo);

		const stretched = stretchedSpans(state, builder, edit);

		java.invoke(builder, 'replace', [
			javaInt(edit.start),
			javaInt(edit.end),
			{ type: 'string', value: edit.text },
		]);

		if (
			edit.imageKey &&
			!insertImage(state, builder, edit, invokeNumber(java, builder, 'length'))
		) {
			return null;
		}

		if (stretched.length) {
			restretch(java, builder, edit, stretched);
		}

		addSpacer(java, builder, edit);
	}

	return textOf(java, builder) === rule.rendered ? builder : null;
}
