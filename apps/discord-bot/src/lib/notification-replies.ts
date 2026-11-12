import type { APIComponentInContainer } from 'discord.js';
import { ButtonStyle, ComponentType } from 'discord.js';

import {
	diagnosisLook,
	HELP_VIEWS,
	writeInstructions,
	type HelpView,
} from '~/lib/notification-instructions';
import { DIAGNOSES, type Diagnosis, type NotificationFacts } from '~/lib/notification-diagnosis';
import { containerMessage, separator, textDisplay } from '~/lib/container-message';
import type { ContainerMessage } from '~/lib/container-message';

/** Which instructions to show, to whom, and the facts they rest on; all of it rides in the button's custom id. */
export type HelpTarget = { view: HelpView; askerId: string; facts: NotificationFacts };

const CUSTOM_ID_PREFIX = 'notification-help';
const MAX_CUSTOM_ID = 100;

const isView = (value?: string): value is HelpView => HELP_VIEWS.some((view) => view === value);
const isDiagnosis = (value?: string): value is Diagnosis =>
	DIAGNOSES.some((diagnosis) => diagnosis === value);

/**
 * @description Encodes a help target as a button custom id, so the button works after a restart.
 * @param target The view the button switches to, the asker and the facts.
 * @returns The custom id, under Discord's 100 character limit; a wildcard App ID that does not fit is dropped.
 */
export function helpCustomId({ view, askerId, facts }: HelpTarget): string {
	const id = [CUSTOM_ID_PREFIX, view, askerId, facts.diagnosis, facts.team, facts.push]
		.map((part) => part ?? '')
		.join(':');
	const withAppId = `${id}:${facts.appId ?? ''}`;

	return facts.appId && withAppId.length <= MAX_CUSTOM_ID ? withAppId : id;
}

/**
 * @description Decodes a custom id `helpCustomId` wrote.
 * @param customId A button's custom id.
 * @returns The target, or `undefined` when the id belongs to another button.
 */
export function readHelpCustomId(customId: string): HelpTarget | undefined {
	const [prefix, view, askerId, diagnosis, team, push, appId] = customId.split(':');

	if (prefix !== CUSTOM_ID_PREFIX || !isView(view) || !askerId || !isDiagnosis(diagnosis)) {
		return undefined;
	}

	const facts: NotificationFacts = {
		diagnosis,
		team: team || undefined,
		push: push || undefined,
	};

	return { view, askerId, facts: appId ? { ...facts, appId } : facts };
}

function factsLine({ diagnosis, team, push, appId }: NotificationFacts): string | undefined {
	const facts = [
		['cert', diagnosisLook(diagnosis).cert],
		['team', team],
		['app id', appId],
		['push', push],
	].flatMap(([label, value]) => (value ? [`\`${label} ${value}\``] : []));

	return facts.length > 0 ? `-# ${facts.join(' ')}` : undefined;
}

/**
 * @description Renders the notifications help in one view, with a button that switches to the other.
 * @param target The view to show, the asker and the facts.
 * @returns The container message; both views share its heading and accent.
 */
export function renderNotificationHelp(target: HelpTarget): ContainerMessage {
	const { heading, accent } = diagnosisLook(target.facts.diagnosis);
	const other: HelpView = target.view === 'simple' ? 'advanced' : 'simple';
	const facts = factsLine(target.facts);
	const [summary, ...blocks] = writeInstructions(target.view, target.facts);
	const components: APIComponentInContainer[] = [
		textDisplay(`### ${heading}\n${summary ?? ''}`),
		...blocks.map(textDisplay),
		separator(),
		...(facts ? [textDisplay(facts)] : []),
		{
			type: ComponentType.ActionRow,
			components: [
				{
					type: ComponentType.Button,
					style: ButtonStyle.Secondary,
					custom_id: helpCustomId({ ...target, view: other }),
					label: other === 'advanced' ? 'Advanced instructions' : 'Simple instructions',
				},
			],
		},
	];

	return containerMessage(accent, components);
}

export default { helpCustomId, readHelpCustomId, renderNotificationHelp };
