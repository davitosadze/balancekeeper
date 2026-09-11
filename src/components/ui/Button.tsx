import React from 'react';
import { Pressable, Text, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FONTS, UI_COLORS } from '@/utils/constants';

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
  primary: '#10b981',
  accent: '#f59e0b',
  secondary: 'transparent',
  danger: '#ef4444',
};

const SHADE_COLOR: Record<ButtonVariant, string> = {
  primary: '#047857',
  accent: '#b45309',
  secondary: UI_COLORS.border,
  danger: '#b91c1c',
};

const TEXT_COLOR: Record<ButtonVariant, string> = {
  primary: '#ffffff',
  accent: '#ffffff',
  secondary: UI_COLORS.text,
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
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.shadow,
        { backgroundColor: isOutline ? 'transparent' : SHADE_COLOR[variant] },
        style,
        disabled && styles.disabled,
      ]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.face,
            {
              backgroundColor: FACE_COLOR[variant],
              borderWidth: isOutline ? 1.5 : 0,
              borderColor: UI_COLORS.border,
              transform: [{ translateY: pressed ? 3 : 0 }],
              marginBottom: pressed ? 0 : 3,
            },
          ]}
        >
          <Text style={[styles.label, { color: TEXT_COLOR[variant] }]}>{label}</Text>
        </View>
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
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontFamily: FONTS.displayBold,
  },
  disabled: {
    opacity: 0.5,
  },
});
