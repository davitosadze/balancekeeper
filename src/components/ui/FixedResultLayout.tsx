import React, { useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';

/** Fit the complete result composition inside its safe-area viewport.
 * Measure unscaled content so rewards, notices, and font changes also fit. */
export default function FixedResultLayout({ children }: { children: React.ReactNode }) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [contentHeight, setContentHeight] = useState(0);
  const measureViewport = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setViewport(previous => previous.width === layout.width && previous.height === layout.height
      ? previous : { width: layout.width, height: layout.height });
  };
  const width = Math.min(350, Math.max(0, viewport.width - 52));
  const scale = contentHeight > 0 ? Math.min(1, Math.max(0, viewport.height - 24) / contentHeight) : 1;

  return <View testID="fixed-result-viewport" onLayout={measureViewport} style={styles.viewport}>
    {width > 0 && <View
      testID="fixed-result-content"
      onLayout={({ nativeEvent: { layout } }) => setContentHeight(previous => previous === layout.height ? previous : layout.height)}
      style={[
        styles.content,
        {
          width,
          left: (viewport.width - width) / 2,
          // Transforms scale around the center; center the unscaled layout first.
          top: (viewport.height - contentHeight) / 2,
          transform: [{ scale }],
          opacity: contentHeight > 0 ? 1 : 0,
        },
      ]}
    >{children}</View>}
  </View>;
}

const styles = StyleSheet.create({
  viewport: { flex: 1, width: '100%', overflow: 'hidden' },
  content: { position: 'absolute', alignItems: 'center' },
});
