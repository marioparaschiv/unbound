import type { NativeJavaBridge } from '@unbound-app/api/native';
import { currentActivity, resourceDensity } from '@unbound-plugins/shared/native/android/views';
import {
	javaNumber,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';

const DISCORD_PACKAGE = 'com.discord';

/** The views of a message row the bubbles read and move, by their resource names, which Discord keeps on every build. */
export const ROW_VIEWS = [
	'header',
	'author_name',
	'timestamp',
	'reply_preview_view',
	'reply_spline',
	'reply_leading_views',
	'reply_text',
	'accessories_view',
	'author_avatar',
	'author_avatar_decoration',
	'mosaic',
] as const;

export type RowViewName = (typeof ROW_VIEWS)[number];

/** Each row view's resource id, 0 when this build has no such view. */
export type RowViewIds = Record<RowViewName, number>;

/**
 * @description Looks up the resource id of each message row view once, so the UI thread finds them with `findViewById`.
 * @param java The plugin's Java bridge.
 * @returns The ids and how many pixels make one point, or `undefined` while no activity is showing.
 */
export function rowViewIds(java: NativeJavaBridge): { ids: RowViewIds; scale: number } | undefined {
	const activity = currentActivity(java);
	const resources = activity ? javaReference(java.invoke(activity, 'getResources', [])) : null;

	if (!resources) return;

	const entries = ROW_VIEWS.map((name) => [
		name,
		javaNumber(
			java.invoke(resources, 'getIdentifier', [
				javaString(name),
				javaString('id'),
				javaString(DISCORD_PACKAGE),
			]),
		) ?? 0,
	]);

	return {
		ids: Object.fromEntries(entries) as RowViewIds,
		scale: resourceDensity(java, resources),
	};
}

export default { rowViewIds };
