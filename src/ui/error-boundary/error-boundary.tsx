import { View, Text, Image, SafeAreaView, Dimensions } from 'react-native';
import { Icons, getIDByName } from '@api/assets';
import { useSettingsStore } from '@api/storage';
import { Design } from '@api/metro/components';
import { Clipboard } from '@api/metro/common';
import { TintedIcon } from '@ui/misc/forms';
import { CLIENT_NAME } from '@constants';
import { CodeBlock } from '@ui/misc';
import { reload } from '@api/native';
import { Strings } from '@api/i18n';
import { useState } from 'react';

import useStyles from './error-boundary.style';

interface ErrorBoundaryProps {
	error: Record<string, any>;
	retryRender: () => void;
	res: any;
};

interface CardProps {
	style?: Record<string, any>,
	children: any;
};

const Card = ({ style, ...props }: CardProps) => {
	const styles = useStyles();

	return <View style={[styles.cardShadow, style]}>
		<View
			style={[styles.card, style]}
			{...props}
		/>
	</View>;
};

const Header = ({ res }: Pick<ErrorBoundaryProps, 'res'>) => {
	const styles = useStyles();

	return <Card>
		<View style={{ flexDirection: 'column' }}>
			<Text style={styles.headerTitle}>
				{res.props?.title?.replace('Discord', CLIENT_NAME)}
			</Text>
			<Text style={styles.headerBody}>
				{res.props.body}
			</Text>
		</View>

		<Image
			source={{ uri: 'https://raw.githubusercontent.com/unbound-mod/assets/main/logo/logo.png' }}
			style={[styles.headerChainIcon, {
				transform: [
					{ rotateZ: '20deg' },
					{ scale: 1.4 }
				],
				opacity: 0.3,
			}]}
			blurRadius={6}
			defaultSource={Icons['MoreHorizontalIcon']}
		/>

		<Image
			source={{ uri: 'https://raw.githubusercontent.com/unbound-mod/assets/main/logo/logo.png' }}
			style={styles.headerChainIcon}
			defaultSource={Icons['MoreHorizontalIcon']}
		/>
	</Card>;
};

const Outline = ({ state, error }: any) => {
	const styles = useStyles();

	let loadingTimeout: Timer;
	const [loading, setLoading] = useState(false);

	return <Card style={{ flexGrow: 1 }}>
		<Text style={styles.outlineTitle}>
			{Strings.UNBOUND_ERROR_BOUNDARY_OUTLINE_TITLE}
		</Text>

		<View style={{ flexGrow: 1 }}>
			<Design.SegmentedControlPages state={state} />

			<View style={{
				position: 'absolute',
				bottom: 20,
				right: 20
			}}>
				<Design.IconButton
					icon={getIDByName('ic_message_copy')}
					variant={'primary'}
					size={'md'}
					loading={loading}
					onPress={() => {
						clearTimeout(loadingTimeout);

						setLoading(previous => !previous);
						loadingTimeout = setTimeout(() => setLoading(previous => !previous), 400);

						Clipboard.setString(error);
					}}
				/>
			</View>
		</View>

		<View style={{ margin: 10, marginTop: 0 }}>
			<Design.SegmentedControl state={state} variant={'experimental_Large'} />
		</View>
	</Card>;
};

const Actions = ({ retryRender }: Pick<ErrorBoundaryProps, 'retryRender'>) => {
	const settings = useSettingsStore('unbound');

	return <Card style={{ marginBottom: 0 }}>
		<View style={{ flexDirection: 'row', margin: 10 }}>
			<View style={!settings.get('recovery', false) ? { flex: 0.5, marginRight: 10 } : { flex: 1 }}>
				<Design.Button
					onPress={retryRender}
					variant={'destructive'}
					size={'md'}
					icon={getIDByName('ic_message_retry')}
					iconPosition={'start'}
					text={Strings.UNBOUND_ERROR_BOUNDARY_ACTION_RETRY_RENDER}
				/>
			</View>

			{!settings.get('recovery', false) && (
				<View style={{ flex: 0.5 }}>
					<Design.Button
						onPress={() => (settings.set('recovery', true), reload(false))}
						icon={getIDByName('ic_shield_24px')}
						variant={'tertiary'}
						size={'md'}
						text={Strings.UNBOUND_ERROR_BOUNDARY_ACTION_RECOVERY_MODE}
					/>
				</View>
			)}
		</View>
	</Card>;
};

export default function ErrorBoundary({ error, retryRender, res }: ErrorBoundaryProps) {
	const possibleErrors = [
		{
			id: 'component',
			icon: () => <TintedIcon source={Icons['ImageTextIcon']} size={20} />,
			label: Strings.UNBOUND_ERROR_BOUNDARY_ACTION_COMPONENT,
			error: error.toString() + error.componentStack
		},
		{
			id: 'stack',
			icon: () => <TintedIcon source={Icons['ic_category_16px']} size={20} />,
			label: Strings.UNBOUND_ERROR_BOUNDARY_ACTION_STACK_TRACE,
			error: error.stack.replace(/(at .*) \(.*\)/g, '$1')
		}
	];

	const [index, setIndex] = useState(0);
	const styles = useStyles();
	const state = Design.useSegmentedControlState({
		defaultIndex: 0,
		items: possibleErrors.map(({ label, id, icon, error }) => {
			return {
				label,
				id,
				icon,
				page: (
					<CodeBlock
						selectable
						style={styles.outlineCodeblock}
					>
						{error}
					</CodeBlock>
				)
			};
		}),
		pageWidth: Dimensions.get('window').width - 40,
		onPageChange: setIndex
	});

	return <SafeAreaView style={styles.container}>
		<Header res={res} />
		<Outline state={state} error={possibleErrors[index].error} />
		<Actions retryRender={retryRender} />
	</SafeAreaView>;
};