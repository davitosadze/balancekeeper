import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
import Button from '@/components/ui/Button';
import { UI_COLORS, FONTS } from '@/utils/constants';

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
    body: 'Each bottle shows "current / target" on its base plaque. Drop balls in until the total weighs exactly the target — no more, no less.',
  },
  {
    title: 'The Goal',
    body: 'Empty the shared tray into the bottles so every bottle balances at exactly its target weight before you run out of moves.',
  },
  {
    title: 'Controls',
    body: 'Drag a ball from the tray onto a bottle to drop it in, or tap it then tap the bottle. Use Undo to take back your last move.',
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

  const finish = () => router.push('/');

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) setStep((s) => s - 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Pressable onPress={finish} style={styles.skip} accessibilityRole="button">
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.dotsRow}>
        {STEPS.map((_, i) => (
          <StepDot key={i} active={i === step} />
        ))}
      </View>

      <View style={styles.content}>
        <StepContent step={step}>
          <Text style={styles.title}>{STEPS[step].title}</Text>

          {step === 0 && (
            <View style={styles.demoRow}>
              <BobbingBall color="blue" weight={5} label="5kg" />
              <BobbingBall color="cyan" weight={2} label="2kg" />
            </View>
          )}

          <Text style={styles.body}>{STEPS[step].body}</Text>
        </StepContent>
      </View>

      <View style={styles.nav}>
        <Button label="Back" variant="secondary" disabled={isFirst} onPress={handleBack} style={styles.navButton} />
        <Button label={isLast ? 'Done' : 'Next'} variant="primary" onPress={handleNext} style={styles.navButton} />
      </View>
    </SafeAreaView>
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
    backgroundColor: active ? UI_COLORS.selected : '#334155',
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
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
    padding: 24,
  },
  skip: {
    alignSelf: 'flex-end',
  },
  skipText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: UI_COLORS.text,
    fontSize: 26,
    fontFamily: FONTS.displayBold,
  },
  body: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  demoRow: {
    flexDirection: 'row',
    gap: 32,
    marginVertical: 8,
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
    color: '#94a3b8',
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
