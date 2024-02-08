import type { Asset as AssetType } from '@typings/api/assets';
import { React, ReactNative as RN } from '@metro/common';
import { Media, Redesign } from '@metro/components';
import { findByProps } from '@metro';


const AssetHandler = findByProps('getAssetUriForEmbed', { lazy: true });

export default class Asset extends React.PureComponent<{ item: AssetType; index: number; total: number; }> {
	render() {
		const { item, index, total } = this.props;

		return <Redesign.TableRow
			label={item.name}
			subLabel={`${item.type.toUpperCase()} - ${item.width}x${item.height} - ${item.id}`}
			trailing={<RN.Image
				source={item.id}
				style={{
					width: 24,
					height: 24
				}}
			/>}
			onPress={({ nativeEvent }) => this.open(AssetHandler.getAssetUriForEmbed(item.id), nativeEvent)}
			start={index === 0}
			end={index === total - 1}
		/>;
	}

	open(uri: string, event) {
		ReactNative.Image.getSize(uri, (width, height) => {
			Media.openMediaModal({
				originLayout: {
					width: 0,
					height: 0,
					x: event.pageX,
					y: event.pageY,
					resizeMode: 'fill'
				},
				initialIndex: 0,
				initialSources: [
					{
						uri,
						sourceURI: uri,
						width,
						height
					}
				]
			});
		});
	}
}