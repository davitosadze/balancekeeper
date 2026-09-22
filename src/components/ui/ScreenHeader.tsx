import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useGameStore } from '@/store/gameStore';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { GlassPanel } from '../gameplay/GameplayHud';
import { GAME_FONT } from '../gameplay/assets';
import GameIcon from './GameIcon';
import { THEME } from './theme';
export const CoinBalance = memo(function CoinBalance({testID}:{testID?:string}) {
  const coins=useGameStore(state=>state.progress.coins),reduced=useReducedMotionPreference();
  const scale=useSharedValue(1),previous=useRef(coins);
  useEffect(()=>{if(previous.current!==coins&&!reduced)scale.value=withSequence(withTiming(.96,{duration:70}),withTiming(1,{duration:140}));previous.current=coins;return()=>cancelAnimation(scale);},[coins,reduced,scale]);
  const style=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));
  return <Animated.View accessibilityLabel={`${coins} coins`} style={[styles.balance,style]}><GameIcon name="coin" size={18}/><Text testID={testID} numberOfLines={1} adjustsFontSizeToFit style={styles.coins}>{coins.toLocaleString()}</Text></Animated.View>;
});
export default function ScreenHeader({title,onBack,coins=false,balanceTestID,backLabel='Back to main menu'}:{title:string;onBack:()=>void;coins?:boolean;balanceTestID?:string;backLabel?:string}) {
  return <GlassPanel style={styles.row}>
    <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={styles.back}><GameIcon name="back" color={THEME.cream}/></Pressable>
    <View style={styles.sign}><Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.title}>{title.toUpperCase()}</Text></View>
    {coins?<CoinBalance testID={balanceTestID}/>:<View style={{width:44}}/>}
  </GlassPanel>;
}
const styles=StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',minHeight:60,borderRadius:THEME.radius,paddingRight:10,gap:4},
  back:{width:44,height:48,alignItems:'center',justifyContent:'center'},
  sign:{flex:1,paddingVertical:10,alignItems:'center',borderTopWidth:1,borderBottomWidth:1,borderColor:'rgba(225,185,118,.22)'},
  title:{color:THEME.cream,fontFamily:GAME_FONT,fontSize:19,fontWeight:'700',letterSpacing:1.2},
  balance:{flexDirection:'row',alignItems:'center',gap:5,maxWidth:112,minHeight:44},
  coins:{color:THEME.gold,fontSize:14,fontFamily:GAME_FONT,fontWeight:'700',flexShrink:1,fontVariant:['tabular-nums']},
});
