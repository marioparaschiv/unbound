import { ReactNative as RN } from '@metro/common';

export function ColorBlock({ color }: { color: string }) {
  return <RN.View
    style={{
      width: 20,
      aspectRatio: 1,
      borderRadius: 4,
      backgroundColor: color
    }}
  />;
}
