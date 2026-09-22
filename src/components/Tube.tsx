import { recordRender } from '@/utils/performance';
import { getBottleSkinAsset, getBottleThumbnail } from '@/assets/cosmetics';
import { useEquippedCosmetic } from '@/hooks/useCosmetics';
import React, { useEffect, useRef, memo } from "react";
import { View, Text, Image, Pressable, StyleSheet, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  cancelAnimation,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import type { Tube as TubeType, ImpactIntensity } from "@/types/game";
import { EFFECT_TIMING, getBottleStress } from "@/domain/bottleFeedback";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import CountUpText from "./CountUpText";
import { bottleWeight } from "@/utils/physics";
import { getDamageStage } from "@/utils/durability";
import {
  DURABILITY_CONFIG,
} from "@/utils/constants";
import Ball from "./Ball";
import { BOTTLE_CROP, displayWeightScale } from "./gameplay/layout";
import { BOTTLE_IMAGES, GAME_FONT } from "./gameplay/assets";
import { ProgressBar } from "./gameplay/GameplayHud";

export interface TubeProps {
  tube: TubeType;
  prerequisiteNumber: number;
  effects?: import("@/types/game").GameplayEffect[];
  won?: boolean;
  width?: number;
  bottleHeight?: number;
  hovered?: boolean;
  hinted?: boolean;
  dragActive?: boolean;
  index: number;
  /** Highlighted as a valid drop target for the currently selected/dragged tray ball. */
  isSelected: boolean;
  isComplete: boolean;
  onPress: (index: number) => void;
  /** Timestamp of an invalid placement attempt into this bottle; re-triggers the shake each time it changes. */
  shakeAt?: number;
  /** Locked bottles still forward invalid attempts for soft feedback and combo reset. */
  locked?: boolean;
  /** Current durability if the durability system is active for this bottle; null/undefined = disabled (unbreakable, legacy behavior). */
  durability?: number | null;
  /** This bottle's durability ceiling; ignored when durability is null. */
  maxDurability?: number | null;
  /** Whether this bottle has shattered and can no longer receive balls. */
  broken?: boolean;
  /** The most recent impact on this bottle, driving its shake/spark feedback; undefined when nothing recent. */
  impact?: { intensity: ImpactIntensity; at: number } | null;
}

/** Bounce/shake/impact transforms fire on the bottle's wrapper every placement; caching it as a
 * rasterized texture (instead of re-rendering the image/gradient stack and its shadow on every
 * animated frame) is what keeps that moment from dropping frames, especially on Android. */
const RASTERIZE_PROPS = Platform.OS === "android"
  ? { renderToHardwareTextureAndroid: true }
  : { shouldRasterizeIOS: true };

function Tube({
  tube, prerequisiteNumber,
  effects = [], won = false,
  index,
  isSelected,
  isComplete,
  onPress,
  shakeAt,
  locked = false,
  durability = null,
  maxDurability = null,
  broken = false,
  impact = null,
  width = 85,
  bottleHeight = 230,
  hovered = false,
  hinted = false,
  dragActive = false,
}: TubeProps) {
  recordRender('bottle');
  const reduced = useReducedMotionPreference();
  const stress = getBottleStress(tube);
  const weight = bottleWeight(tube);

  const stage = broken
    ? "broken"
    : durability != null && maxDurability
      ? getDamageStage(durability, maxDurability)
      : "pristine";

  const bounceY = useSharedValue(0);
  const bounceScale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const sparkle = useSharedValue(0);
  const stressPulse = useSharedValue(0);
  const glow = useSharedValue(0);
  const previousStage = useRef(stage);
  useEffect(() => {
    if (!reduced && stage !== previousStage.current && stage !== "pristine") {
      stressPulse.value = withSequence(withTiming(.13, { duration: 80 }), withTiming(0, { duration: 240 }));
    }
    previousStage.current = stage;
  }, [stage, stressPulse]);
  const stressStyle = useAnimatedStyle(() => ({ opacity: stressPulse.value }));

  const ballCount = tube.balls.length;
  const topBallWeight = tube.balls[tube.balls.length - 1]?.weight ?? 0;
  const prevBallCount = useRef(ballCount);
  useEffect(() => {
    if (!reduced && ballCount > prevBallCount.current) {
      bounceY.value = withSequence(withTiming(3, { duration: 80 }), withTiming(0, { duration: 160 }));
      bounceScale.value = withSequence(withTiming(1.018, { duration: 80 }), withTiming(1, { duration: 160 }));
    }
    prevBallCount.current = ballCount;
  }, [ballCount, topBallWeight, bounceY, bounceScale]);

  useEffect(() => {
    if (shakeAt === undefined || reduced) return;
    shakeX.value = withSequence(
      withTiming(-3, { duration: 45, easing: Easing.linear }),
      withTiming(3, { duration: 90, easing: Easing.linear }),
      withTiming(-2, { duration: 90, easing: Easing.linear }),
      withTiming(0, { duration: 60, easing: Easing.linear }),
    );
  }, [shakeAt, shakeX]);

  // Durability feedback: every impact gives a vibration scaled by how hard
  // the hit was and how fragile the glass already is — a light tap on a
  // pristine bottle barely registers, the same tap on a critical one
  // rattles it visibly.
  const lastImpactAt = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!impact || impact.at === lastImpactAt.current) return;
    lastImpactAt.current = impact.at;
    sparkle.value = withSequence(withTiming(1, { duration: 45 }), withTiming(0, { duration: 200 }));
    const base = DURABILITY_CONFIG.shakeIntensity[impact.intensity];
    const stageKey = stage === "broken" ? "critical" : stage;
    const amplitude = reduced ? 0 : Math.min(broken ? 7 : 4, base * DURABILITY_CONFIG.stageShakeMultiplier[stageKey]);
    shakeX.value = withSequence(
      withTiming(-amplitude, { duration: 40, easing: Easing.linear }),
      withTiming(amplitude, { duration: 80, easing: Easing.linear }),
      withTiming(-amplitude * 0.6, { duration: 80, easing: Easing.linear }),
      withTiming(0, { duration: 70, easing: Easing.linear }),
    );
  }, [impact, stage, shakeX]);

  const seenSequence = useRef(effects.at(-1)?.sequence ?? 0);
  useEffect(() => {
    for (const event of effects) {
      if(event.sequence <= seenSequence.current) continue;
      if(event.bottleIndex !== index) continue;
      if(event.type === 'PERFECT_FIT' || event.type === 'BOTTLE_UNLOCKED') {
        glow.value = withSequence(withTiming(1,{duration:reduced?0:90}),withTiming(0,{duration:reduced?220:500}));
        if(!reduced) bounceScale.value = withSequence(withTiming(1.025,{duration:100}),withTiming(1,{duration:220}));
      }
      if(event.type === 'BOTTLE_STRESS_CHANGED' && event.stress === 'danger' && !reduced) {
        stressPulse.value = withSequence(withTiming(.15,{duration:90}),withTiming(0,{duration:240}));
      }
    }
    if(effects.length) seenSequence.current = effects[effects.length-1].sequence;
  }, [effects, index, reduced, glow, bounceScale, stressPulse]);
  useEffect(() => {
    if(!won) return;
    const delay = reduced ? 0 : EFFECT_TIMING.winPulseStart + index * EFFECT_TIMING.winPulseStep;
    glow.value = withDelay(delay, withSequence(withTiming(1,{duration:reduced?0:85}),withTiming(.25,{duration:180})));
    if(!reduced) bounceScale.value = withDelay(delay,withSequence(withTiming(1.02,{duration:85}),withTiming(1,{duration:160})));
  }, [won, index, reduced, glow, bounceScale]);
  useEffect(() => () => { [bounceY,bounceScale,shakeX,sparkle,stressPulse,glow].forEach(cancelAnimation); }, [bounceY,bounceScale,shakeX,sparkle,stressPulse,glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * .3 }));
  const targetStyle = useAnimatedStyle(() => ({ transform: [{scale: reduced ? 1 : 1 + glow.value * .045}], opacity: 1 - glow.value * .12 }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeX.value },
      { translateY: bounceY.value },
      { scale: bounceScale.value },
    ],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({ opacity: sparkle.value, transform: [{ scale: .7 + sparkle.value * .3 }] }));

  const invalidHover = hovered && !isSelected;
  const glowColor = invalidHover ? "#d8735f" : "#b8d991";
  const fill = tube.target > 0 ? Math.min(1, weight / tube.target) : 0;
  const sizes = tube.balls.map(ball => width * .78 * displayWeightScale(ball.weight));
  // Sum actual object heights, so mixed weights touch without overlapping.
  const naturalHeight = sizes.reduce((sum, size, i) => sum + size * (tube.balls[i].weight >= 15 ? 1.24 : .94), 0);
  const fit = Math.min(1, bottleHeight * .64 / Math.max(1, naturalHeight));
  return (
    <Pressable onPress={() => !broken && onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={locked ? `Bottle ${index + 1}, locked until bottle ${prerequisiteNumber} is solved` : broken ? `Bottle ${index + 1}, shattered` : `Bottle ${index + 1}, ${weight} of ${tube.target} kilograms${tube.type === "fragile" ? `, fragile, durability ${tube.durability}` : ""}${tube.type === "exact" ? ", exact fit only" : tube.type === "oneWay" ? ", one way, Undo only" : ""}${hinted ? ", hint destination" : ""}`}
      style={[styles.wrapper, { width }]} testID={`bottle-station-${index}`}>
      <Animated.View {...RASTERIZE_PROPS} style={[{ width, height: bottleHeight, zIndex: 2 }, (hovered || hinted || (isSelected && !dragActive)) && { shadowColor: glowColor, shadowOpacity: .34, shadowRadius: 11, shadowOffset: { width: 0, height: 0 } }, animatedStyle]}>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: '24%', bottom: 0, left: -3, right: -3, borderRadius: width * .3, backgroundColor: '#da815f' }, stressStyle]} />
        <View pointerEvents="none" style={{opacity:locked?.48:tube.type==='fragile'?.88:1}}><BottleVisual stage={stage} width={width} height={bottleHeight} natural /></View>
        {!broken && (stress === 'warning' || stress === 'danger' || (tube.type === 'fragile' && invalidHover)) && <View pointerEvents="none" testID={`bottle-stress-${index}`} accessibilityLabel={`${stress} bottle stress`} style={{position:'absolute',top:'22%',bottom:0,left:0,right:0,borderRadius:width*.25,borderWidth:1,borderColor:stress==='warning'?'rgba(239,190,101,.3)':'rgba(221,117,75,.45)',backgroundColor:stress==='warning'?'rgba(239,190,101,.035)':'rgba(221,117,75,.06)'}} />}
        <Animated.View pointerEvents="none" style={[{position:'absolute',top:'20%',bottom:-2,left:-2,right:-2,borderRadius:width*.28,backgroundColor:'#ffe5a0',borderColor:'#fff1bd',borderWidth:2},glowStyle]} />
        {!broken && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: bottleHeight * .067 }]}>
          {tube.balls.slice().reverse().map((ball, reverseIndex) => {
            const i = tube.balls.length - 1 - reverseIndex;
            return <SettlingBall key={ball.id} color={ball.color} weight={ball.weight} size={sizes[i] * fit} />;
          })}
        </View>}
        {/* The same glass texture lightly catches the objects' edges. Stays mounted (opacity-toggled, not
            conditionally rendered) so the image never has to decode for the first time at drop moment. */}
        {!broken && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: tube.balls.length > 0 ? .14 : 0 }]}><BottleVisual stage={stage} width={width} height={bottleHeight} natural /></View>}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: bottleHeight * .3, left: width * .05 }, sparkleStyle]}><Text style={{ color: '#fff1cc', fontSize: 15, textShadowColor: '#e2bb76', textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } }}>✦</Text></Animated.View>
        {tube.type === "fragile" && !broken && <View pointerEvents="none" style={{ position: 'absolute', top: -18, left: -2, right: -2, alignItems: 'center' }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 9, color: '#ffe0ab', fontFamily: GAME_FONT, fontWeight: '700' }}>Fragile · {tube.durability}</Text>
        </View>}
        {(tube.type === 'exact' || tube.type === 'oneWay' || tube.type === 'one-way') && !broken && <View pointerEvents="none" style={{position:'absolute',top:-18,left:-2,right:-2,alignItems:'center'}}><Text style={{fontSize:9,color:'#ffe0ab',fontWeight:'700'}}>{tube.type==='exact'?'◎ Exact':'↓ One way'}</Text></View>}
        {locked && <View style={styles.lockOverlay}><View style={{width:18,height:22,alignItems:'center'}}><View style={{width:12,height:12,borderWidth:2,borderColor:'#fff1d4',borderTopLeftRadius:6,borderTopRightRadius:6}}/><View style={{width:18,height:12,backgroundColor:'#fff1d4',borderRadius:3,marginTop:-3}}/></View><Text style={styles.lockText}>Locked</Text><Text style={{ color: "#fff1d4", fontSize: 8 }}>Solve {prerequisiteNumber}</Text></View>}
      </Animated.View>
      <Animated.View style={targetStyle}><BottleBase target={tube.target} weight={weight} fill={fill} width={width} broken={broken} selected={hinted || (isSelected && !dragActive)} complete={isComplete} stress={stress} danger={broken || stress === "danger"} hovered={hovered} invalid={invalidHover || shakeAt !== undefined} /></Animated.View>
    </Pressable>
  );
}

/** All source canvases share the same crop and frame, including shattered glass. */
export function BottleVisual({ skinId, stage, width, height, natural = false, thumbnail = false }: { skinId?: string; thumbnail?: boolean; stage: import('@/types/game').DamageStage; width: number; height: number; natural?: boolean }) {
  const equipped = useEquippedCosmetic('bottle');
  const appearance = getBottleSkinAsset(skinId ?? equipped,stage);
  const pixelScale = width / BOTTLE_CROP.width;
  const imageStyle = natural ? { position: "absolute" as const, width: 1024 * pixelScale, height: 1536 * pixelScale, left: -BOTTLE_CROP.x * pixelScale, top: -BOTTLE_CROP.y * pixelScale } : { position: 'absolute' as const, width: width / .61, height: height / .945, left: -width * .195 / .61, top: -height * .017 / .945 };
  // A little transparency lets the warm room show through the supplied glass.
  // Keep one continuous image so its highlights and cracks have no seams.
  return <View pointerEvents="none" style={{ width, height, overflow: 'hidden' }}>
    <Image fadeDuration={0} source={thumbnail && stage === 'pristine' ? getBottleThumbnail(skinId ?? equipped) : appearance.source} resizeMode={natural ? "contain" : "stretch"} style={[imageStyle, { opacity: stage === 'broken' ? 1 : appearance.glassOpacity ?? .72 }]} />
    {appearance.tint && appearance.tintOpacity > 0 && <Image fadeDuration={0} source={thumbnail && stage === 'pristine' ? getBottleThumbnail(skinId ?? equipped) : appearance.source} resizeMode={natural ? "contain" : "stretch"} style={[imageStyle,{tintColor:appearance.tint,opacity:appearance.tintOpacity}]} />}
  </View>;
}
function SettlingBall(props: React.ComponentProps<typeof Ball>) {
  const reduced = useReducedMotionPreference();
  const y = useSharedValue(reduced ? 0 : -32);
  const squash = useSharedValue(.96);
  useEffect(() => { if(reduced) { y.value=0; squash.value=1; return; } y.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) }); squash.value = withSequence(withTiming(1.035, { duration: 110 }), withSpring(1, { damping: 14, stiffness: 250 })); return () => { cancelAnimation(y); cancelAnimation(squash); }; }, [y, squash, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scaleX: squash.value }, { scaleY: 2 - squash.value }] }));
  return <Animated.View {...RASTERIZE_PROPS} style={[{ marginBottom: -(props.size ?? 40) * .1 }, style]}><View pointerEvents="none" style={{ position: "absolute", bottom: 0, left: "22%", width: "56%", height: 4, borderRadius: 99, backgroundColor: "rgba(29,16,7,.24)", shadowColor: "#26160c", shadowOpacity: .4, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } }} /><Ball {...props} /></Animated.View>;
}
export function BottleBase({ weight, target, fill, width, broken, selected, complete, stress = 'safe', danger = false, hovered = false, invalid = false }: { weight: number; target: number; fill: number; width: number; broken: boolean; selected: boolean; complete: boolean; danger?: boolean; stress?: import('@/domain/bottleFeedback').BottleStress; hovered?: boolean; invalid?: boolean }) {
  const tone = danger || invalid || broken ? 'red' : complete || stress === 'safe' ? 'green' : 'gold';
  const previousWeight = useRef(weight);
  const from = previousWeight.current;
  useEffect(() => { previousWeight.current = weight; }, [weight]);
  return <View style={{ width, paddingTop: 8 }}>
    <View pointerEvents="none" style={{ position: 'absolute', top: -4, left: '5%', width: '90%', height: 7, borderRadius: 99, backgroundColor: 'rgba(43,23,9,.28)', shadowColor: '#2d180a', shadowOpacity: .35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }} />
    <LinearGradient colors={['rgba(76,49,29,.78)', 'rgba(45,28,17,.82)']} style={[styles.pedestal, { width, height: 44, borderRadius: 11 }, (selected || hovered || invalid) && { borderColor: invalid ? '#bc7563' : '#b0c58a' }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.total, { fontSize: Math.min(15, Math.max(11, width * .17)), marginTop: 7 }]}><CountUpText value={weight} from={from} duration={180} /> / {target}<Text style={{ fontSize: 10, fontWeight: '500', color: '#ddc9ac' }}> kg</Text></Text>
      <View style={{ width: '78%', marginTop: 5 }}><ProgressBar value={fill} tone={tone} height={4} /></View>
    </LinearGradient>
  </View>;
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'flex-end' },
  pedestal: { alignItems: 'center', borderWidth: 1, borderColor: 'rgba(242,207,157,.23)', borderTopColor: 'rgba(250,223,185,.35)', shadowColor: '#160b03', shadowOpacity: .22, shadowOffset: { width: 0, height: 3 }, shadowRadius: 4 },
  total: { color: '#fff6eb', fontFamily: GAME_FONT, fontWeight: '700', textShadowColor: '#160d05', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  lockOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(39,27,15,.2)' },
  lockText: { color: '#ffefcf', fontFamily: GAME_FONT, fontSize: 11 },
});

export default memo(Tube);
