import type { AlertProps } from '@typings/api/dialogs';
import { Discord } from '@api/metro/components';
import { createElement } from 'react';
import { View } from 'react-native';
import { Strings } from '@api/i18n';
import { uuid } from '@utilities';


export type * from '@typings/api/dialogs';

export function showDialog(options: AlertProps) {
	options.key ??= uuid();

	Discord.openAlert(options.key, <Discord.AlertModal
		title={options.title}
		content={options.content}
		actions={<>
			<View
				style={{
					marginTop: !options.content ? -32 : -8,
					marginBottom: (options.componentMargin ?? true) && options.component ? 8 : 0
				}}
			>
				{options.component}
			</View>
			{options.buttons?.length > 0 && options.buttons.map(button => createElement(
				Discord[(button.closeAlert ?? true) ? 'AlertActionButton' : 'Button'],
				button
			))}
			{(options.cancelButton ?? true) && (
				<Discord.AlertActionButton
					text={Strings.CANCEL}
					variant='secondary'
					onPress={() => options.onCancel?.()}
				/>
			)}
		</>}
	/>);
}

export default { showDialog };