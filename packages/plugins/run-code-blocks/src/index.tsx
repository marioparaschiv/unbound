import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { findElement } from '@unbound-plugins/shared/react/find-element';
import { assets, dialogs, metro, patcher, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { runCode } from '~/lib/compiler-explorer';
import { runnableBlocks, type CodeBlock } from '~/lib/code-blocks';

type SheetProps = { message?: { content?: string } };

async function run(block: CodeBlock) {
	toasts.show({ id: 'run-code-blocks', title: format('RUNNING', { language: block.language }) });

	try {
		const { output, exitCode } = await runCode(block.language, block.code);

		await dialogs.alert('OUTPUT_TITLE', {
			titleVars: { language: block.language, code: String(exitCode) },
			body: 'OUTPUT_BODY',
			bodyVars: { output: output || messages.NO_OUTPUT },
		});
	} catch (error) {
		toasts.show({ id: 'run-code-blocks', title: messages.RUN_FAILED, content: String(error) });
	}
}

export function start() {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Run Code Blocks skipped: Discord moved ActionSheets.');

		return;
	}

	let blocks: CodeBlock[] = [];
	let sheetKey: string | undefined;

	// UNKNOWN: an action sheet may render any node.
	function addRunRow(result: unknown) {
		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;
		const [block] = blocks;

		if (!block || !Array.isArray(rows) || rows.some((row) => row?.key === 'unbound-run-code')) {
			return result;
		}

		const ActionSheetRow = getActionSheetRow();
		const icon = assets.getIdByName('PlayIcon');

		rows.splice(
			1,
			0,
			<ActionSheetRow
				key='unbound-run-code'
				label={format('RUN', { language: block.language })}
				icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
				onPress={() => {
					if (sheetKey) ActionSheets.hideActionSheet(sheetKey);

					void run(block);
				}}
			/>,
		);

		return result;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet')) return;

		blocks = runnableBlocks(props.message?.content ?? '');
		sheetKey = key;

		return addRunRow;
	});
}
