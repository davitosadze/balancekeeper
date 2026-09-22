import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming, withDelay } from 'react-native-reanimated';
import type { GameplayEffect } from '@/types/game';
import { EFFECT_TIMING, getComboFeedback } from '@/domain/bottleFeedback';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

/** Uses the existing HUD feedback row, so popups never cover bottles or move the scene. */
export default function GameplayBanner({ events, milestone, fallback }: { events: GameplayEffect[]; milestone: boolean; fallback: string }) {
  const [notice, setNotice] = useState({text:milestone ? 'MILESTONE' : '',revision:0});
  const message = notice.text;
  const sequence = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotionPreference(), progress = useSharedValue(1);
  useEffect(() => {
    const fresh = events.filter(e => e.sequence > sequence.current);
    if(events.length) sequence.current = events[events.length-1].sequence;
    let text: string | undefined;
    for(const event of fresh) {
      if(event.type === 'COMBO_CHANGED') { const combo = getComboFeedback(event.combo ?? 0); if(combo) text = `${combo.label}  x${combo.tier}`; else if(text === undefined) text = ''; }
      if(event.type === 'DROP_INVALID') text = event.reason === 'overload' ? 'TOO HEAVY' : event.reason === 'exact' ? 'EXACT FIT ONLY' : event.reason === 'locked' ? 'BOTTLE LOCKED' : 'TRY ANOTHER DROP';
    }
    if(text !== undefined) setNotice({text,revision:sequence.current});
  }, [events]);
  useEffect(() => {
    if(!message) return;
    if(timer.current) clearTimeout(timer.current);
    const duration = message === 'MILESTONE' ? EFFECT_TIMING.challenge : EFFECT_TIMING.popup;
    progress.value = reduced ? 1 : 0;
    if(!reduced) progress.value = withSequence(withTiming(1, {duration:110}), withDelay(duration-260, withTiming(0,{duration:150})));
    timer.current = setTimeout(() => setNotice(previous => ({...previous,text:''})), duration);
    return () => { if(timer.current) clearTimeout(timer.current); cancelAnimation(progress); };
  }, [notice, reduced, progress]);
  const style = useAnimatedStyle(() => ({ opacity: message ? progress.value : 1, transform: [{ scale: reduced || !message ? 1 : .94 + progress.value * .06 }] }));
  // `adjustsFontSizeToFit` makes the native layer run an iterative shrink-to-fit measurement
  // pass every time this text changes; longer combo strings ("BALANCE MASTER!") need more
  // iterations than short ones ("NICE!"), which is why bigger combos were the ones that hitched.
  // The banner row is always wide enough for the longest label at a fixed size, so drop it.
  return <Animated.View pointerEvents="none" style={style}><Text testID="gameplay-feedback" accessibilityLiveRegion="polite" numberOfLines={1} style={{color:message?'#ffe0a1':'#fff0d2',fontSize:message?13:12,fontWeight:'700',textAlign:'center',textShadowColor:'#4a301c',textShadowRadius:3,textShadowOffset:{width:0,height:1}}}>{message || fallback}</Text></Animated.View>;
}
