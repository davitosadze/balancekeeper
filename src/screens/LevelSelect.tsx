import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Image, Pressable, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/store/gameStore';
import { LEVELS, getUnlockedLevels } from '@/data/levels';
import { CoinBalance } from '@/components/ui/ScreenHeader';
import { GAME_FONT } from '@/components/gameplay/assets';
import { useAudio } from '@/hooks/useAudio';
import { useHaptics } from '@/hooks/useHaptics';
import { useMusic } from '@/hooks/useMusic';
import type { Level } from '@/types/game';

const FOREST = require('../../assets/levels/forest.webp');
const GARDEN_PREVIEW = require('../../assets/thumbnails/garden-bg-thumb.webp');
const CREAM = '#fff0cc';
const GOLD = '#ffd45b';

/** Subtle grain and corner pegs keep the wooden chrome consistent at any size. */
function WoodDetail() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.woodDetail]}>
    {[18, 37, 61, 83].map((top, index) => <View key={top} style={[styles.grain, { top: `${top}%`, left: index % 2 ? '8%' : '2%', right: index % 2 ? '2%' : '12%' }]} />)}
    {[styles.topLeft, styles.topRight, styles.bottomLeft, styles.bottomRight].map((position, index) => <View key={index} style={[styles.peg, position]} />)}
  </View>;
}

function Crown({ size = 30 }: { size?: number }) {
  return <View pointerEvents="none" style={{ width: size, height: size * .85 }}>
    {[0, 1, 2].map(index => <View key={index} style={{ position: 'absolute', left: index * size * .34, top: index === 1 ? 0 : size * .14, width: size * .12, height: size * .12, borderRadius: size, backgroundColor: '#fff1a1', borderWidth: 1, borderColor: '#d78b0d' }} />)}
    {[0, 1, 2].map(index => <View key={index} style={{ position: 'absolute', left: index * size * .27, top: index === 1 ? size * .03 : size * .17, borderLeftWidth: size * .14, borderRightWidth: size * .14, borderBottomWidth: size * .53, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: index === 1 ? '#ffe579' : '#ffc638' }} />)}
    <LinearGradient colors={['#ffe78b', '#eea213', '#b86809']} style={{ position: 'absolute', bottom: 0, left: size * .05, width: size * .77, height: size * .25, borderRadius: 3, borderWidth: 1, borderColor: '#ffdf65' }} />
  </View>;
}

function Lock() {
  return <View style={styles.lock}>
    <View style={styles.lockShackle} />
    <LinearGradient colors={['#fff0d0', '#ceb48b']} style={styles.lockBody}>
      <View style={styles.keyhole} /><View style={styles.keyholeStem} />
    </LinearGradient>
  </View>;
}

export default function LevelSelect() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const unlockedIds = useGameStore(state => state.progress.unlockedLevels);
  const highest = useGameStore(state => state.progress.highestUnlockedLevel);
  const records = useGameStore(state => state.progress.levelProgress);
  const unlocked = useMemo(() => new Set(getUnlockedLevels(unlockedIds, highest)), [unlockedIds, highest]);
  const current = LEVELS.find(level => unlocked.has(level.id) && !records[level.id]?.completed)?.id;
  const tileWidth = (Math.min(width - insets.left - insets.right, 440) - (width < 360 ? 36 : 48) - 36) / 4;
  const rowGap = height < 700 ? 18 : 24;
  const { playSound } = useAudio();
  const { triggerHaptic } = useHaptics();
  useMusic('menu');
  const select = useCallback((id: number) => {
    playSound('buttonTap'); triggerHaptic('select');
    if (useGameStore.getState().loadLevel(id)) router.push('/game');
  }, [router, playSound, triggerHaptic]);
  const goBack = useCallback(() => {
    playSound('back'); triggerHaptic('select');
    router.canGoBack() ? router.back() : router.replace('/');
  }, [router, playSound, triggerHaptic]);
  const openBackgrounds = useCallback(() => {
    playSound('buttonTap'); triggerHaptic('select');
    router.push({ pathname: '/shop', params: { category: 'background' } });
  }, [router, playSound, triggerHaptic]);
  const completed = LEVELS.filter(level => records[level.id]?.completed).length;

  return <View style={styles.root}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={FOREST} resizeMode="cover" fadeDuration={0} style={styles.background} />
      <LinearGradient colors={['rgba(8,19,12,.40)', 'rgba(17,25,12,.08)', 'rgba(21,12,5,.10)', 'rgba(15,9,4,.66)']} locations={[0, .22, .7, 1]} style={StyleSheet.absoluteFill} />
    </View>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.scene, { paddingHorizontal: width < 360 ? 18 : 24 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to main menu" onPress={goBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <LinearGradient colors={['#a06b3d', '#704122', '#482510']} style={styles.backFace}>
              <View style={styles.backInset} /><Text style={styles.backArrow}>➜</Text>
            </LinearGradient>
          </Pressable>
          <View style={styles.signWrap}>
            {[styles.ropeLeft, styles.ropeRight].map((position, index) => <View pointerEvents="none" key={index} style={[styles.rope, position]} />)}
            <LinearGradient colors={['#986337', '#70411f', '#583014', '#77451f']} locations={[0, .3, .7, 1]} style={styles.sign}>
              <WoodDetail />
              <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.title}>LEVELS</Text>
            </LinearGradient>
          </View>
          <View style={styles.wallet}><CoinBalance testID="level-coins" /></View>
        </View>
        <FlatList
          testID="level-grid"
          style={styles.list}
          data={LEVELS}
          extraData={records}
          keyExtractor={level => String(level.id)}
          numColumns={4}
          initialNumToRender={24}
          maxToRenderPerBatch={12}
          windowSize={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <LevelTile level={item} width={tileWidth} rowGap={rowGap} unlocked={unlocked.has(item.id)} current={item.id === current} stars={records[item.id]?.bestStars ?? 0} onSelect={select} />}
          ListFooterComponent={<Text style={styles.progress}>{completed} / {LEVELS.length} levels balanced</Text>}
        />
        <Pressable testID="level-backgrounds" accessibilityRole="button" accessibilityLabel="Explore backgrounds in the shop" onPress={openBackgrounds} style={({ pressed }) => [styles.rewardCard, pressed && styles.pressed]}>
          <LinearGradient colors={['#986337', '#4f2b15', '#8b542a']} style={styles.rewardFrame}>
            <View style={styles.rewardInner}>
              <WoodDetail />
              <Image source={GARDEN_PREVIEW} style={styles.rewardImage} />
              <View style={styles.rewardCopy}>
                <Text style={styles.rewardTitle}>A new view awaits</Text>
                <Text style={styles.rewardText}>Use your coins to unlock{ '\n' }beautiful backgrounds.</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  </View>;
}

const LevelTile = memo(function LevelTile({ level, width, rowGap, unlocked, current, stars, onSelect }: {
  level: Level; width: number; rowGap: number; unlocked: boolean; current: boolean; stars: number; onSelect: (id: number) => void;
}) {
  const milestone = !!level.milestone;
  const purple = milestone && !current;
  const colors: [string, string, string] = current ? ['#ffd658', '#f9a51f', '#c76b09']
    : purple ? ['#aa72c7', '#754196', '#452352']
    : unlocked ? ['#5cad58', '#2d813e', '#18512b'] : ['#795638', '#563b28', '#3a271c'];
  const border = current || purple ? '#ffe077' : unlocked ? '#b0b765' : '#b38d60';
  return <Pressable
    testID={`level-tile-${level.id}`}
    accessibilityRole="button"
    accessibilityLabel={`Level ${level.id}, ${level.name}${unlocked ? `, ${stars} of 3 stars` : ', locked'}${current ? ', current level' : ''}`}
    accessibilityHint={`${stars} of 3 stars${current ? ', current level' : ''}${milestone ? ', milestone' : ''}`}
    accessibilityState={{ disabled: !unlocked, selected: current }}
    disabled={!unlocked}
    onPress={() => onSelect(level.id)}
    style={({ pressed }) => [{ width, height: width * 1.28, marginBottom: rowGap }, styles.tileShell, current && styles.currentGlow, purple && styles.milestoneGlow, pressed && styles.pressed]}
  >
    <LinearGradient colors={colors} style={[styles.tile, { borderColor: border }]}>
      <View style={[styles.tileInset, { borderColor: current || purple ? 'rgba(255,240,155,.68)' : 'rgba(240,221,167,.34)' }]} />
      <View style={styles.tileShine} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.number, { fontSize: width * .46 }, !unlocked && !purple && styles.lockedNumber]}>{level.id}</Text>
      <View style={styles.tileStatus}>
        {unlocked ? <View style={styles.stars}>{[1, 2, 3].map(n => <Text key={n} style={[styles.star, { fontSize: width * .265, lineHeight: width * .32 }, n > stars && styles.emptyStar, n > stars && current && styles.currentEmptyStar]}>★</Text>)}</View> : <Lock />}
      </View>
    </LinearGradient>
    {(current || milestone) && <View style={styles.crown}><Crown size={Math.min(32, width * .44)} /></View>}
  </Pressable>;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#182419' },
  background: { width: '100%', height: '100%', position: 'absolute' },
  safe: { flex: 1 },
  scene: { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center' },
  header: { height: 108, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 2 },
  back: { width: 47, height: 49, zIndex: 2, shadowColor: '#140b04', shadowOpacity: .8, shadowOffset: { width: 0, height: 4 }, shadowRadius: 3, elevation: 4 },
  backFace: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#c2935e', borderBottomWidth: 4, borderBottomColor: '#482711', alignItems: 'center', justifyContent: 'center' },
  backInset: { position: 'absolute', top: 2, left: 2, right: 2, bottom: 2, borderRadius: 8, borderWidth: 1, borderColor: '#a47849' },
  backArrow: { color: CREAM, fontSize: 30, lineHeight: 36, transform: [{ rotate: '180deg' }], textShadowColor: '#321909', textShadowRadius: 2, textShadowOffset: { width: 0, height: -2 } },
  signWrap: { flex: 1, height: 66, minWidth: 105 },
  rope: { position: 'absolute', top: -100, bottom: 53, width: 5, backgroundColor: '#4a321b', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#9b7745', transform: [{ rotate: '2deg' }] },
  ropeLeft: { left: 19 }, ropeRight: { right: 19 },
  sign: { flex: 1, borderRadius: 10, borderWidth: 2, borderTopColor: '#bb8851', borderColor: '#623715', borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center', shadowColor: '#130b04', shadowOpacity: .8, shadowRadius: 4, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  title: { fontFamily: GAME_FONT, fontWeight: '800', color: CREAM, fontSize: 27, letterSpacing: .7, paddingHorizontal: 12, textShadowColor: '#361c0a', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 2 },
  wallet: { backgroundColor: 'rgba(19,29,20,.9)', borderColor: '#7a7049', borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, maxWidth: 103, shadowColor: '#080e07', shadowOpacity: .5, shadowRadius: 3, shadowOffset: { width: 0, height: 3 } },
  woodDetail: { overflow: 'hidden', borderRadius: 9 },
  grain: { position: 'absolute', height: 1, backgroundColor: 'rgba(29,13,3,.25)', borderBottomWidth: 1, borderBottomColor: 'rgba(218,152,79,.14)' },
  peg: { position: 'absolute', width: 4, height: 4, borderRadius: 3, backgroundColor: '#362514', borderTopWidth: 1, borderTopColor: '#c39054' },
  topLeft: { top: 6, left: 7 }, topRight: { top: 6, right: 7 }, bottomLeft: { bottom: 6, left: 7 }, bottomRight: { bottom: 6, right: 7 },
  list: { flex: 1 }, row: { gap: 12 }, grid: { paddingTop: 24, paddingBottom: 8, paddingHorizontal: 0 },
  tileShell: { borderRadius: 17, backgroundColor: '#2d1c0f', shadowColor: '#100a03', shadowOffset: { width: 0, height: 5 }, shadowOpacity: .85, shadowRadius: 3, elevation: 5 },
  tile: { flex: 1, borderRadius: 17, borderWidth: 2, borderBottomWidth: 4, paddingTop: 6, paddingBottom: 7, alignItems: 'center', justifyContent: 'center' },
  tileInset: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1, borderBottomColor: 'rgba(20,13,5,.5)', borderRadius: 12 },
  tileShine: { position: 'absolute', top: 5, left: 12, right: 12, height: 2, borderRadius: 2, backgroundColor: 'rgba(255,238,179,.22)' },
  currentGlow: { shadowColor: '#ffbb24', shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  milestoneGlow: { shadowColor: '#ffd45b', shadowOpacity: .65, shadowRadius: 7, shadowOffset: { width: 0, height: 0 }, elevation: 7 },
  number: { fontFamily: GAME_FONT, fontWeight: '600', color: CREAM, textAlign: 'center', textShadowColor: 'rgba(23,22,7,.85)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 2 },
  lockedNumber: { color: '#e2cdb1', fontWeight: '500' },
  tileStatus: { height: 26, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  star: { color: GOLD, textShadowColor: '#a45e09', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  emptyStar: { color: '#24442b', textShadowColor: 'rgba(15,26,13,.7)' },
  currentEmptyStar: { color: '#ac671b', textShadowColor: '#ffde76' },
  crown: { position: 'absolute', top: -20, alignSelf: 'center', shadowColor: '#ffb918', shadowOpacity: .7, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3 },
  lock: { width: 20, height: 24, alignItems: 'center' },
  lockShackle: { width: 12, height: 13, borderWidth: 3, borderBottomWidth: 0, borderColor: '#ead5b3', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  lockBody: { position: 'absolute', bottom: 0, width: 18, height: 15, borderRadius: 3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#b79970' },
  keyhole: { width: 4, height: 4, borderRadius: 3, backgroundColor: '#64482e', marginTop: -2 },
  keyholeStem: { position: 'absolute', top: 6, width: 2, height: 5, backgroundColor: '#64482e' },
  progress: { color: '#ead6b3', fontFamily: GAME_FONT, fontSize: 12, textAlign: 'center', paddingBottom: 15, textShadowColor: '#23160b', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  rewardCard: { marginTop: 14, marginBottom: 12, shadowColor: '#0f0803', shadowOpacity: .8, shadowOffset: { width: 0, height: 5 }, shadowRadius: 5, elevation: 6 },
  rewardFrame: { borderRadius: 22, borderWidth: 1, borderTopColor: '#d3a76a', borderColor: '#a17443', padding: 4, borderBottomWidth: 4, borderBottomColor: '#593113' },
  rewardInner: { minHeight: 84, borderRadius: 17, borderWidth: 1, borderColor: '#ae7941', backgroundColor: 'rgba(41,23,12,.92)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, gap: 12 },
  rewardImage: { width: 49, height: 61, borderRadius: 9, borderWidth: 2, borderColor: '#dba856' },
  rewardCopy: { flex: 1, gap: 3 },
  rewardTitle: { color: CREAM, fontFamily: GAME_FONT, fontSize: 14, fontWeight: '700' },
  rewardText: { color: '#dec9aa', fontFamily: GAME_FONT, fontSize: 12, lineHeight: 17 },
  chevron: { color: '#f6d896', fontSize: 40, lineHeight: 44, marginTop: -4 },
  pressed: { transform: [{ scale: .96 }, { translateY: 2 }] },
});
