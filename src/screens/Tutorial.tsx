import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ball from '@/components/Ball';
import { WoodlandBackdrop, WoodHeader, WoodPanel, WoodButton, WOODLAND } from '@/components/ui/Woodland';
import { GAME_FONT } from '@/components/gameplay/assets';
import { useAudio } from '@/hooks/useAudio';
import { useHaptics } from '@/hooks/useHaptics';
import { useMusic } from '@/hooks/useMusic';

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: 'Ball Weights',
    body: 'Every ball is labeled with its weight in kg. Bigger balls are heavier — a 5kg ball takes up more room than a 2kg one.',
  },
  {
    title: 'Bottle Targets',
    body: 'Each bottle shows one weight — match it exactly to solve the bottle. Going over it overloads the bottle.',
  },
  {
    title: 'The Goal',
    body: 'Solve every bottle at its target. Only overload attempts crack the glass; the third breaks a normal bottle. Take your time — normal levels have no timer.',
  },
  {
    title: 'Controls',
    body: 'Drag a ball from the tray onto a bottle to drop it in, or tap it then tap the bottle. Use Undo below the tray to reverse a placement. Hint highlights one safe move. Free uses and coin prices appear on the buttons.',
  },
];

/**
 * Four-step onboarding flow explaining ball weights, bottle targets, the win
 * condition, and controls. Each step slides and fades in from the direction
 * you navigated, with an animated dot progress indicator and a gently
 * bobbing weight demo, with Back/Next/Skip navigation.
 */
export default function Tutorial() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const { playSound } = useAudio();
  const { triggerHaptic } = useHaptics();
  useMusic('menu');
  const tap = () => { playSound('buttonTap'); triggerHaptic('select'); };

  const exit = () => { playSound('back'); triggerHaptic('select'); router.canGoBack() ? router.back() : router.replace('/'); };

  const handleNext = () => {
    tap();
    if (isLast) {
      exit();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    tap();
    if (!isFirst) setStep((s) => s - 1);
  };

  return (
    <View style={styles.root}>
      <WoodlandBackdrop room dark />
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.scene}>
          <WoodHeader title="How to Play" onBack={exit} backLabel="Skip tutorial" />

          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <StepDot key={i} active={i === step} />
            ))}
          </View>

          <View style={styles.content}>
            <StepContent step={step}>
              <WoodPanel style={styles.panel}>
                <Text style={styles.title}>{STEPS[step].title}</Text>

                {step === 0 && (
                  <View style={styles.demoRow}>
                    <BobbingBall color="blue" weight={5} label="5kg" />
                    <BobbingBall color="cyan" weight={2} label="2kg" />
                  </View>
                )}

                <Text style={styles.body}>{STEPS[step].body}</Text>
              </WoodPanel>
            </StepContent>
          </View>

          <View style={styles.nav}>
            <WoodButton label="Back" variant="secondary" disabled={isFirst} onPress={handleBack} style={styles.navButton} />
            <WoodButton label={isLast ? 'Done' : 'Next'} variant="primary" onPress={handleNext} style={styles.navButton} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Slides and fades the current step's content in from the direction navigated. */
function StepContent({ step, children }: { step: number; children: React.ReactNode }) {
  const slideX = useSharedValue(0);
  const fade = useSharedValue(1);
  const prevStep = useRef(step);

  useEffect(() => {
    const dir = step > prevStep.current ? 1 : -1;
    prevStep.current = step;
    slideX.value = dir * 36;
    fade.value = 0;
    slideX.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    fade.value = withTiming(1, { duration: 320 });
  }, [step, slideX, fade]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: slideX.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

function StepDot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? 22 : 8);

  useEffect(() => {
    width.value = withTiming(active ? 22 : 8, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [active, width]);

  const style = useAnimatedStyle(() => ({
    width: width.value,
    backgroundColor: active ? WOODLAND.gold : 'rgba(214,190,160,.3)',
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

function BobbingBall({ color, weight, label }: { color: 'blue' | 'cyan'; weight: number; label: string }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [bob]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  return (
    <View style={styles.demoItem}>
      <Animated.View style={[styles.demoBallWrap, style]}>
        <Ball color={color} weight={weight} />
      </Animated.View>
      <Text style={styles.demoLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  scene: { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 22, paddingBottom: 18 },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  panel: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  title: {
    color: WOODLAND.cream,
    fontSize: 24,
    fontFamily: GAME_FONT,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: '#291305',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 2 },
  },
  body: {
    color: WOODLAND.muted,
    fontFamily: GAME_FONT,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  demoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginVertical: 4,
  },
  demoItem: {
    alignItems: 'center',
    gap: 8,
  },
  demoBallWrap: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoLabel: {
    color: WOODLAND.muted,
    fontFamily: GAME_FONT,
    fontSize: 12,
  },
  nav: {
    flexDirection: 'row',
    gap: 12,
  },
  navButton: {
    flex: 1,
  },
});
