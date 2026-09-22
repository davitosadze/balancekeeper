import React, { useEffect, useSyncExternalStore } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { loadSettings, useSettingsStore, DEFAULT_SETTINGS } from '@/store/settingsStore';
import { MainBackground } from '@/components/main/MainArtwork';
import { MenuIcon, TactileButton, FooterMessage, type MenuIconName } from '@/components/main/MainChrome';
import { GlassPanel, ProgressBar } from '@/components/gameplay/GameplayHud';
import ScreenHeader from '@/components/ui/ScreenHeader';
import GameIcon, { type IconName } from '@/components/ui/GameIcon';
import { GAME_FONT } from '@/components/gameplay/assets';
import { useAudio } from '@/hooks/useAudio';
import { useHaptics } from '@/hooks/useHaptics';
import { useMusic } from '@/hooks/useMusic';
import { adsConsent } from '@/services/ads/rewardedAds';
import { showAdsPrivacyOptions } from '@/services/ads/adsLifecycle';

const CREAM = '#fff3dd';
const SOFT = '#e7ccaa';
const GOLD_FILL: [string, string, string] = ['#ffe16a', '#ffb22d', '#ee7e0c'];

/** Same glass-and-gold presentation as the main menu; all persistence stays in the settings store. */
export default function Settings() {
  const router = useRouter();
  const privacy = useSyncExternalStore(adsConsent.subscribe, adsConsent.getSnapshot, adsConsent.getSnapshot);
  const { settings, ready, error, update, retry } = useSettingsStore();
  const { playSound } = useAudio();
  const { triggerHaptic } = useHaptics();
  useMusic('menu');
  useEffect(() => { void loadSettings(); }, []);
  const tap = () => { playSound('buttonTap'); triggerHaptic('select'); };
  const back = () => { playSound('back'); triggerHaptic('select'); router.canGoBack() ? router.back() : router.replace('/'); };
  const setVolume = (volume: number) => { tap(); void update({ volume }); };
  return <View style={styles.root}>
    <MainBackground />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim]} />
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.scene}>
        <ScreenHeader title="Settings" onBack={back} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SectionLabel>Sound</SectionLabel>
          <Group>
            <ToggleRow icon="music" label="Music" value={settings.musicEnabled} disabled={!ready} onChange={() => { tap(); void update({ musicEnabled: !settings.musicEnabled }); }} />
            <ToggleRow icon="sound" label="Sound Effects" value={settings.soundEnabled} disabled={!ready} onChange={() => { tap(); void update({ soundEnabled: !settings.soundEnabled }); }} />
            <View style={styles.volumeRow}>
              <View style={styles.rowTop}>
                <Badge><GameIcon name="volume" color={CREAM} size={20} /></Badge>
                <Text style={[styles.label, { flex: 1 }]}>Volume</Text>
                <Text accessibilityLabel={`Volume ${settings.volume} percent`} style={styles.value}>{settings.volume}%</Text>
              </View>
              <View style={styles.slider}>
                <StepButton label="Decrease volume" symbol="−" disabled={!ready || settings.volume === 0} onPress={() => setVolume(Math.max(0, settings.volume - 10))} />
                <View style={styles.bar}><ProgressBar value={settings.volume / 100} height={10} /></View>
                <StepButton label="Increase volume" symbol="+" disabled={!ready || settings.volume === 100} onPress={() => setVolume(Math.min(100, settings.volume + 10))} />
              </View>
            </View>
          </Group>

          <SectionLabel>Comfort</SectionLabel>
          <Group>
            <ToggleRow icon="haptics" label="Haptics" value={settings.hapticsEnabled} disabled={!ready} onChange={() => { tap(); void update({ hapticsEnabled: !settings.hapticsEnabled }); }} />
            <ToggleRow icon="motion" label="Reduced Motion" caption="Softens effects. Also follows your device setting." value={!!settings.reducedMotion} disabled={!ready} onChange={() => { tap(); void update({ reducedMotion: !settings.reducedMotion }); }} />
          </Group>

          <SectionLabel>More</SectionLabel>
          <Group>
            <LinkRow menuIcon="guide" label="How to Play" accessibilityLabel="How to Play" onPress={() => { tap(); router.push('/tutorial'); }} />
            <LinkRow menuIcon="shop" label="Shop" caption="Make it yours" accessibilityLabel="Browse the Shop" onPress={() => { tap(); router.push('/shop'); }} />
          </Group>

          {privacy.required && <>
            <SectionLabel>Privacy</SectionLabel>
            <Group>
              <LinkRow menuIcon="guide" label={privacy.busy ? 'Opening privacy options...' : 'Ad privacy options'}
                disabled={privacy.busy} accessibilityLabel="Ad privacy options"
                onPress={() => { tap(); void showAdsPrivacyOptions(); }} />
            </Group>
            {privacy.error && <Text accessibilityLiveRegion="polite" style={styles.error}>{privacy.error}</Text>}
          </>}

          {error && <View style={styles.errorBox}>
            <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
            <TactileButton label="RETRY" onPress={() => { tap(); void (ready ? retry() : loadSettings()); }} style={styles.retry}>
              <LinearGradient colors={GOLD_FILL} start={{ x: .18, y: 0 }} end={{ x: .85, y: 1 }} style={styles.gold}>
                <Text style={styles.goldText}>Retry</Text>
              </LinearGradient>
            </TactileButton>
          </View>}

          <TactileButton label="RESET SETTINGS" disabled={!ready} onPress={() => { tap(); void update(DEFAULT_SETTINGS); }} style={[styles.reset, !ready && { opacity: .5 }]}>
            <GlassPanel style={styles.resetFace}><Text style={styles.resetText}>Reset settings</Text></GlassPanel>
          </TactileButton>
          <View style={styles.footer}><FooterMessage scale={1.1} /></View>
        </ScrollView>
      </View>
    </SafeAreaView>
  </View>;
}

function SectionLabel({ children }: { children: string }) {
  return <Text accessibilityRole="header" style={styles.section}>{children.toUpperCase()}</Text>;
}
/** A glass card whose rows are separated by hairlines. */
function Group({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children);
  return <GlassPanel style={styles.card}>{rows.map((row, i) => <View key={i}>{i > 0 && <View style={styles.divider} />}{row}</View>)}</GlassPanel>;
}
function Badge({ children }: { children: React.ReactNode }) {
  return <View style={styles.badge}>{children}</View>;
}
function RowLabel({ label, caption }: { label: string; caption?: string }) {
  return <View style={styles.rowText}><Text style={styles.label}>{label}</Text>{caption && <Text style={styles.caption}>{caption}</Text>}</View>;
}
function ToggleRow({ icon, label, caption, value, disabled, onChange }: { icon: IconName; label: string; caption?: string; value: boolean; disabled: boolean; onChange: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} aria-checked={value} aria-disabled={disabled} accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={onChange} style={({ pressed }) => [styles.row, disabled && { opacity: .5 }, pressed && styles.pressed]}>
    <Badge><GameIcon name={icon} color={CREAM} size={20} /></Badge>
    <RowLabel label={label} caption={caption} />
    <View style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff, { alignItems: value ? 'flex-end' : 'flex-start' }]}>
      {value && <LinearGradient pointerEvents="none" colors={GOLD_FILL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
      <View style={styles.thumb} />
    </View>
  </Pressable>;
}
function LinkRow({ menuIcon, label, caption, accessibilityLabel, onPress, disabled = false }: { menuIcon: MenuIconName; label: string; caption?: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.row, disabled && { opacity: .5 }, pressed && styles.pressed]}>
    <Badge><MenuIcon name={menuIcon} size={19} /></Badge>
    <RowLabel label={label} caption={caption} />
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
}
function StepButton({ label, symbol, disabled, onPress }: { label: string; symbol: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.step, disabled && { opacity: .4 }, pressed && { transform: [{ translateY: 2 }, { scale: .96 }] }]}>
    <LinearGradient colors={['#c69b64', '#88542e']} style={styles.stepFace}><Text style={styles.stepText}>{symbol}</Text></LinearGradient>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#7e5131' },
  safeArea: { flex: 1 },
  dim: { backgroundColor: 'rgba(37,21,10,.4)' },
  scene: { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8 },
  content: { gap: 10, paddingTop: 14, paddingBottom: 24 },
  section: { color: '#f4dfbd', fontFamily: GAME_FONT, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginLeft: 8, marginTop: 6, textShadowColor: 'rgba(37,20,8,.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  card: { borderRadius: 22, paddingHorizontal: 6, borderWidth: 1, borderColor: 'rgba(244,214,167,.18)' },
  divider: { height: 1, marginHorizontal: 10, backgroundColor: 'rgba(255,232,191,.13)' },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 16 },
  pressed: { backgroundColor: 'rgba(255,232,191,.08)' },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(31,24,17,.5)', borderWidth: 1, borderColor: 'rgba(235,211,171,.35)' },
  rowText: { flex: 1, gap: 1 },
  label: { color: CREAM, fontFamily: GAME_FONT, fontSize: 16, fontWeight: '600', textShadowColor: 'rgba(37,20,8,.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  caption: { color: SOFT, fontFamily: GAME_FONT, fontSize: 12, lineHeight: 16 },
  toggle: { width: 52, height: 30, borderRadius: 15, padding: 3, borderWidth: 1.5, overflow: 'hidden' },
  toggleOn: { borderColor: '#ffd77a' },
  toggleOff: { borderColor: 'rgba(235,211,171,.35)', backgroundColor: 'rgba(31,24,17,.6)' },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fffaf0', shadowColor: '#2e1607', shadowOpacity: .45, shadowRadius: 2, shadowOffset: { width: 0, height: 2 } },
  volumeRow: { paddingHorizontal: 8, paddingVertical: 12, gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { color: '#ffdc78', fontFamily: GAME_FONT, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  slider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bar: { flex: 1 },
  step: { width: 38, height: 34 },
  stepFace: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderTopColor: '#f1d09f', borderColor: '#825332', shadowColor: '#211003', shadowOffset: { width: 0, height: 2 }, shadowOpacity: .5, shadowRadius: 1 },
  stepText: { color: CREAM, fontSize: 22, lineHeight: 25, fontWeight: '600' },
  chevron: { color: '#e9c98f', fontSize: 30, lineHeight: 32, paddingHorizontal: 6 },
  errorBox: { alignItems: 'center', gap: 12, paddingVertical: 4 },
  error: { color: '#ffd7b8', fontFamily: GAME_FONT, fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 },
  retry: { width: 150, height: 46 },
  gold: { flex: 1, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffd77a', borderBottomWidth: 4, borderBottomColor: '#a84a07' },
  goldText: { color: '#3e2007', fontFamily: GAME_FONT, fontSize: 17, fontWeight: '800' },
  reset: { width: '100%', height: 54, marginTop: 6 },
  resetFace: { flex: 1, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(244,214,167,.3)' },
  resetText: { color: CREAM, fontFamily: GAME_FONT, fontSize: 16, fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 14 },
});
