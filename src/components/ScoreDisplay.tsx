import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UI_COLORS, FONTS } from '@/utils/constants';

export interface ScoreDisplayProps {
  score: number;
}

/**
 * Displays the player's current score in a bordered box, styled for the
 * top-right corner of the gameplay header.
 */
export default function ScoreDisplay({ score }: ScoreDisplayProps) {
  return (
    <View style={styles.container} accessibilityLabel={`Coins: ${score}`}>
      <Text style={styles.coin}>$</Text>
      <Text style={styles.value}>{score.toLocaleString()}</Text>
      <Text style={styles.plus}>+</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 78, 107, 0.92)',
    borderRadius: 24,
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 5,
  },
  coin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fbbf24',
    color: '#fff7c2',
    textAlign: 'center',
    lineHeight: 26,
    fontSize: 17,
    fontWeight: '800',
  },
  value: {
    fontSize: 16,
    fontFamily: FONTS.displayBold,
    color: '#fff',
  },
  plus: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#28b66f',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 19,
    fontSize: 16,
    fontWeight: '800',
  },
});
