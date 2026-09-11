import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Switch, Pressable, StyleSheet, PanResponder, GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameSettings } from '@/types/game';
import Button from '@/components/ui/Button';
import FadeSlideIn from '@/components/FadeSlideIn';
import { UI_COLORS, STORAGE_KEY_SETTINGS, FONTS } from '@/utils/constants';

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
  highContrast: false,
  volume: 80,
  animationSpeed: 'normal',
};

const SPEEDS: GameSettings['animationSpeed'][] = ['slow', 'normal', 'fast'];
const SLIDER_WIDTH = 260;

/**
 * Settings screen: sound/haptics/high-contrast toggles, a volume slider,
 * an animation-speed selector, and reset/clear-cache actions. Persists to
 * AsyncStorage on every change.
 */
export default function Settings() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_SETTINGS).then((raw) => {
      if (raw) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
        } catch {
          // ignore malformed cache, fall back to defaults
        }
      }
    });
  }, []);

  const update = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void AsyncStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleReset = () => update(DEFAULT_SETTINGS);

  const handleClearCache = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (evt: GestureResponderEvent) => {
      const x = Math.max(0, Math.min(SLIDER_WIDTH, evt.nativeEvent.locationX));
      update({ volume: Math.round((x / SLIDER_WIDTH) * 100) });
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <FadeSlideIn>
        <Text style={styles.header}>Settings</Text>
      </FadeSlideIn>

      <FadeSlideIn delay={80} style={styles.section}>
        <ToggleRow
          label="Sound Effects"
          value={settings.soundEnabled}
          onChange={(v) => update({ soundEnabled: v })}
        />
        <ToggleRow
          label="Haptic Feedback"
          value={settings.hapticsEnabled}
          onChange={(v) => update({ hapticsEnabled: v })}
        />
        <ToggleRow
          label="High Contrast Mode"
          value={settings.highContrast}
          onChange={(v) => update({ highContrast: v })}
        />
      </FadeSlideIn>

      <FadeSlideIn delay={160} style={styles.section}>
        <Text style={styles.sliderLabel}>Volume: {settings.volume}%</Text>
        <View style={styles.sliderTrack} {...panResponder.panHandlers}>
          <View style={[styles.sliderFill, { width: `${settings.volume}%` }]} />
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={240} style={styles.section}>
        <Text style={styles.sliderLabel}>Animation Speed</Text>
        <View style={styles.speedRow}>
          {SPEEDS.map((speed) => (
            <Pressable
              key={speed}
              onPress={() => update({ animationSpeed: speed })}
              style={({ pressed }) => [
                styles.speedButton,
                settings.animationSpeed === speed && styles.speedButtonActive,
                pressed && styles.pressedScale,
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.speedButtonText,
                  settings.animationSpeed === speed && styles.speedButtonTextActive,
                ]}
              >
                {speed}
              </Text>
            </Pressable>
          ))}
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={320} style={styles.actions}>
        <Button label="Reset to Defaults" variant="secondary" onPress={handleReset} />
        <Button label="Clear Cache" variant="danger" onPress={handleClearCache} />
      </FadeSlideIn>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#334155', true: '#10b981' }}
        thumbColor="#f1f5f9"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
    padding: 20,
    paddingTop: 32,
    gap: 24,
  },
  header: {
    fontSize: 24,
    fontFamily: FONTS.displayBold,
    color: UI_COLORS.text,
  },
  section: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    color: UI_COLORS.text,
    fontSize: 15,
  },
  sliderLabel: {
    color: UI_COLORS.text,
    fontSize: 15,
    marginBottom: 4,
  },
  sliderTrack: {
    width: SLIDER_WIDTH,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  speedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  speedButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    alignItems: 'center',
  },
  speedButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  speedButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  speedButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  actions: {
    gap: 12,
  },
  pressedScale: {
    transform: [{ scale: 0.95 }],
  },
});
