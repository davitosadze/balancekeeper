import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FadeSlideIn from '../FadeSlideIn';
import { GAME_FONT } from './assets';

/** Scene padding + HUD + feedback row + a small gap, measured from the top of the safe area. */
const BELOW_HUD = 86;

/** Overlay occupies existing free space; showing/dismissing a lesson cannot shift the table. */
export default function TutorialCoach({ message }: { message: string | null }) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  // Absolutely positioned children ignore the SafeAreaView's padding, so the notch inset is added here.
  const { top } = useSafeAreaInsets();
  if (!message || message === dismissed) return null;
  return <FadeSlideIn key={message} distance={-8} style={[styles.wrap, { top: top + BELOW_HUD }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Tutorial: ${message} Tap to dismiss.`}
      testID="tutorial-coach" onPress={() => setDismissed(message)}>
      <LinearGradient colors={['rgba(68,54,40,.96)', 'rgba(40,30,21,.97)']} style={styles.card}>
        <View style={styles.header}>
          <LinearGradient colors={['#ffe293', '#dda343']} style={styles.tip}><Text style={styles.tipText}>TIP</Text></LinearGradient>
          <Text style={styles.dismiss}>Tap to dismiss</Text>
        </View>
        <Text style={styles.copy}>{message}</Text>
      </LinearGradient>
    </Pressable>
  </FadeSlideIn>;
}
const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 20 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(244,214,167,.3)', borderTopColor: 'rgba(255,232,191,.45)', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, gap: 5, shadowColor: '#140c05', shadowOpacity: .5, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  tipText: { color: '#4a2a0c', fontFamily: GAME_FONT, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  copy: { color: '#fff3dd', fontFamily: GAME_FONT, fontSize: 12.5, fontWeight: '500', lineHeight: 17 },
  dismiss: { color: '#d8c09c', fontFamily: GAME_FONT, fontSize: 10, letterSpacing: .3 },
});
