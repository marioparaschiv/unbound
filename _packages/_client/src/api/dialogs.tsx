import type { AlertDialogProps } from '@unbound-app/types/dialogs';
import { Discord } from '~/api/metro/components';
import { createElement } from 'react';
import { Strings } from '~/api/i18n';
import { View } from 'react-native';
import { uuid } from '~/utilities';


export function showDialog(options: AlertDialogProps) {
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
					text={Strings.UNBOUND_CANCEL}
					variant='secondary'
					onPress={() => options.onCancel?.()}
				/>
			)}
		</>}
	/>);
}

export default { showDialog };