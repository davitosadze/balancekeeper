import React from 'react';
import { Pressable, Text, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from './theme';
import { GAME_FONT } from '../gameplay/assets';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const FACE_COLOR: Record<ButtonVariant, string> = {
  primary: THEME.green,
  accent: '#f59e0b',
  secondary: THEME.wood,
  danger: THEME.rust,
};

const SHADE_COLOR: Record<ButtonVariant, string> = {
  primary: THEME.greenDark,
  accent: '#b45309',
  secondary: THEME.darkWood,
  danger: '#713d2c',
};

const TEXT_COLOR: Record<ButtonVariant, string> = {
  primary: '#ffffff',
  accent: '#ffffff',
  secondary: THEME.cream,
  danger: '#ffffff',
};

/**
 * Casual-game "gumdrop" pill button: a solid face over a darker bottom
 * shade to imply 3D depth, with a subtle press-down animation via
 * Pressable's built-in pressed state (no Reanimated needed for this).
 */
export default function Button({ label, onPress, variant = 'primary', disabled = false, style, accessibilityLabel }: ButtonProps) {
  const isOutline = variant === 'secondary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.shadow,
        { backgroundColor: SHADE_COLOR[variant] },
        style,
        disabled && styles.disabled,
      ]}
    >
      {({ pressed }) => (
        <LinearGradient colors={[FACE_COLOR[variant], SHADE_COLOR[variant]]}
          style={[
            styles.face,
            {
              backgroundColor: FACE_COLOR[variant],
              borderWidth: isOutline ? 1.5 : 0,
              borderColor: THEME.border,
              transform: [{ translateY: pressed ? 3 : 0 }],
              marginBottom: 3,
            },
          ]}
        >
          <Text style={[styles.label, { color: TEXT_COLOR[variant] }]}>{label}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 999,
  },
  face: {
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontFamily: GAME_FONT,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
