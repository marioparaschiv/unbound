import { fastFindByProps } from '@metro';
import { React, ReactNative } from '@metro/common';
import type { PropsWithChildren } from 'react';

const { Animated, PanResponder, Dimensions } = ReactNative;
const { width, height } = Dimensions.get('window');

const SafeArea = fastFindByProps('useSafeAreaInsets', { lazy: true });

type DraggableProps = PropsWithChildren<{ layout: { width: number, height: number } }>;

const Draggable = ({ children, layout }: DraggableProps) => {
  const insets = SafeArea.useSafeAreaInsets();
  const pan = React.useRef(new Animated.ValueXY({
    x: width - layout.width,
    y: height - 200 - layout.height
  })).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          // @ts-ignore
          x: pan.x._value,
          // @ts-ignore
          y: pan.y._value,
        });
      },
      onPanResponderMove: Animated.event(
        [
          null,
          { dx: pan.x, dy: pan.y },
        ],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();

        // calculate the distance to each edge
        const distanceTop = gesture.moveY;
        const distanceBottom = height - gesture.moveY;
        const distanceLeft = gesture.moveX;
        const distanceRight = width - gesture.moveX;

        // determine the closest edge
        const minDistance = Math.min(distanceTop, distanceBottom, distanceLeft, distanceRight);

        let x = gesture.moveX;
        let y = gesture.moveY;

        // snap to the nearest edge while preserving the other axis
        // order of snapping: top, bottom, left, right
        if (minDistance === distanceTop) {
          y = 0 + insets.top;
        } else if (minDistance === distanceBottom) {
          y = height - layout.height - insets.bottom;
        } else if (minDistance === distanceLeft) {
          x = 0 + insets.left;
        } else if (minDistance === distanceRight) {
          x = width - layout.width - insets.right;
        }

        Animated.spring(pan, {
          toValue: { x, y },
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[pan.getLayout(), { ...layout, position: 'absolute' }]}
    >
      {children}
    </Animated.View>
  );
};

export default Draggable;
