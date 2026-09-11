import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { UI_COLORS } from '@/utils/constants';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'dark' | 'light';
  style?: StyleProp<ViewStyle>;
}

/**
 * Rounded panel with a soft shadow, used for stat chips, score displays,
 * and info panels across every screen instead of each screen hand-rolling
 * its own bordered box.
 */
export default function Card({ children, variant = 'dark', style }: CardProps) {
  return <View style={[styles.base, variant === 'dark' ? styles.dark : styles.light, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  dark: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
});
