import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, FlatList, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { WoodlandBackdrop, WoodHeader as ScreenHeader, WoodPanel as GlassPanel, WoodButton as Button } from '@/components/ui/Woodland';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { useGameStore } from '@/store/gameStore';
import { getShopItems, type CosmeticCategory, type CosmeticDefinition } from '@/domain/cosmetics/catalog';
import { resolveEquippedCosmetic } from '@/domain/cosmetics/inventory';
import CosmeticPreview from '@/components/shop/CosmeticPreview';
import { GAME_FONT } from '@/components/gameplay/assets';
import { useAudio } from '@/hooks/useAudio';
import { useHaptics } from '@/hooks/useHaptics';
import { useMusic } from '@/hooks/useMusic';
import type { DamageStage } from '@/types/game';

const CATEGORIES = [{id:'bottle',name:'Bottles'},{id:'weight',name:'Weights'},{id:'background',name:'Backgrounds'}] as const;
export default function Shop() {
  const router=useRouter(), window=useWindowDimensions();
  const { category: requestedCategory } = useLocalSearchParams<{ category?: string }>();
  const state=useGameStore(useShallow(({progress,hydrated,cosmeticBusy,utilityBusy,storageError,purchaseCosmetic,equipCosmetic,retrySave})=>({progress,hydrated,cosmeticBusy,utilityBusy,storageError,purchaseCosmetic,equipCosmetic,retrySave}))), {playSound}=useAudio(), {triggerHaptic}=useHaptics();
  const reduced=useReducedMotionPreference();
  const insets=useSafeAreaInsets();
  const cardWidth=(Math.min(window.width-insets.left-insets.right,440)-56)/2;
  const [category,setCategory]=useState<CosmeticCategory>(()=>CATEGORIES.find(tab=>tab.id===requestedCategory)?.id??'bottle');
  const [preview,setPreview]=useState<CosmeticDefinition|null>(null);
  const [stage,setStage]=useState<DamageStage>('pristine');
  const [notice,setNotice]=useState(''), [retrying,setRetrying]=useState(false);
  const mounted=useRef(true);
  const disabled=!state.hydrated||state.cosmeticBusy||state.utilityBusy||!!state.storageError;
  useMusic('menu');
  useFocusEffect(useCallback(()=>{playSound('shopOpen');},[playSound]));
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),2200);return()=>clearTimeout(timer);},[notice]);
  const close=()=>{setPreview(null);setStage('pristine');};
  const tap=()=>{playSound('buttonTap');triggerHaptic('select');};
  const back=()=>{playSound('back');triggerHaptic('select');};
  const select=()=>{playSound('itemSelect');triggerHaptic('select');};
  const owned=!!preview&&state.progress.ownedCosmetics.includes(preview.id);
  const equipped=!!preview&&resolveEquippedCosmetic(state.progress,preview.category)===preview.id;
  const shortfall=preview?Math.max(0,preview.price-state.progress.coins):0;
  const apply=async()=>{
    if(!preview||disabled||equipped||(!owned&&shortfall>0))return;
    const item=preview, wasOwned=owned;
    const result=await (wasOwned?state.equipCosmetic(item.id):state.purchaseCosmetic(item.id));
    if(!mounted.current)return;
    if(result.accepted){close();setNotice(`${item.name} equipped`);playSound(wasOwned?'itemSelect':'purchase');triggerHaptic('success');}
    else{playSound('purchaseFailed');triggerHaptic('error');if(!useGameStore.getState().storageError)setNotice(result.message??'Please try again.');}
  };
  const retry=async()=>{setRetrying(true);await state.retrySave();if(mounted.current){setRetrying(false);if(!useGameStore.getState().storageError){close();setNotice('Saved');}}};
  const saveError=state.storageError?<View style={styles.error}><Text style={styles.copy}>{state.storageError}</Text><Button label={retrying?'SAVING…':'RETRY SAVE'} disabled={retrying} onPress={()=>void retry()} /></View>:null;
  return <View style={styles.root}>
    <WoodlandBackdrop room dark />
    <SafeAreaView style={styles.safe} edges={['top','bottom','left','right']}>
      <View style={styles.scene}>
        <ScreenHeader title="Shop" coins balanceTestID="shop-coins" backLabel="Back from Shop" onBack={()=>{back();router.canGoBack()?router.back():router.replace('/');}}/>
        <Text style={styles.subtitle}>A little change. A whole new feeling.</Text>
        <View style={styles.tabs}>{CATEGORIES.map(tab=><Pressable key={tab.id} accessibilityRole="tab" aria-selected={category===tab.id} accessibilityState={{selected:category===tab.id}} onPress={()=>{tap();setCategory(tab.id);}} style={[styles.tab,category===tab.id&&styles.activeTab]}><Text style={[styles.tabText,category===tab.id&&styles.activeTabText]}>{tab.name}</Text></Pressable>)}</View>
        {!preview&&saveError}
        <FlatList key={category} data={getShopItems(category)} keyExtractor={item=>item.id} numColumns={2} initialNumToRender={4} maxToRenderPerBatch={2} windowSize={3} columnWrapperStyle={{gap:12}} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}
          renderItem={({item})=>{
            const isOwned=state.progress.ownedCosmetics.includes(item.id), active=resolveEquippedCosmetic(state.progress,category)===item.id;
            const label=active?'Equipped':isOwned?'Owned':`${item.price.toLocaleString()} coins`;
            return <Pressable key={item.id} testID={`shop-card-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.name}, ${label}`} disabled={!state.hydrated||state.cosmeticBusy} onPress={()=>{select();setStage('pristine');setPreview(item);}} style={[styles.cardWrap,{width:cardWidth}]}>
              <GlassPanel style={[styles.card,active&&styles.equippedCard]}><View style={styles.shelf}><CosmeticPreview item={item}/></View><Text style={styles.name}>{item.name}</Text><Text style={[styles.price,active&&styles.activePrice]}>{active?'✓ Equipped':isOwned?'Owned · Equip':`● ${item.price.toLocaleString()}`}</Text></GlassPanel>
            </Pressable>;
          }}/>
        <View pointerEvents="none" style={styles.notice}><Text accessibilityLiveRegion="polite" style={styles.noticeText}>{notice}</Text></View>
      </View>
    </SafeAreaView>
    <Modal transparent visible={!!preview} animationType={reduced?"none":"fade"} onRequestClose={close}>
      <View style={styles.backdrop}>
        <SafeAreaView style={{width:'100%',maxWidth:430,maxHeight:window.height-24}} edges={['top','bottom']}>
          <ScrollView contentContainerStyle={{padding:16}} bounces={false}>
            {preview&&<GlassPanel style={styles.dialog}>
              <Text accessibilityRole="header" style={styles.dialogTitle}>{preview.name}</Text>
              <CosmeticPreview item={preview} large stage={stage}/>
              {preview.category==='bottle'&&<View style={styles.damageTabs}>{([{id:'pristine',label:'Whole'},{id:'hairline',label:'Cracked'},{id:'broken',label:'Broken'}] as const).map(option=><Pressable key={option.id} accessibilityRole="button" accessibilityLabel={`Preview ${option.label.toLowerCase()} bottle`} accessibilityState={{selected:stage===option.id}} onPress={()=>setStage(option.id)} style={[styles.damageTab,stage===option.id&&styles.activeTab]}><Text style={styles.copy}>{option.label}</Text></Pressable>)}</View>}
              <Text style={styles.copy}>{equipped?'Your current style.':owned?'Owned · Equip for free':`${preview.price.toLocaleString()} coins`}</Text>
              {!owned&&shortfall>0&&<Text accessibilityLiveRegion="polite" style={styles.shortfall}>Need {shortfall.toLocaleString()} more coins</Text>}
              {saveError}
              <Button label={state.cosmeticBusy?'SAVING…':equipped?'EQUIPPED':owned?'EQUIP':'BUY'} accessibilityLabel={equipped?`${preview.name} equipped`:owned?`Equip ${preview.name}`:`Buy ${preview.name}`} disabled={disabled||equipped||(!owned&&shortfall>0)} onPress={()=>void apply()}/>
              <Button label={owned?'CLOSE':'CANCEL'} variant="secondary" onPress={()=>{tap();close();}}/>
            </GlassPanel>}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  root:{flex:1},safe:{flex:1},scene:{flex:1,width:'100%',maxWidth:440,alignSelf:'center',paddingHorizontal:22},
  header:{minHeight:60,borderRadius:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingRight:16},
  back:{width:48,height:52,alignItems:'center',justifyContent:'center'},backText:{fontSize:36,color:'#fff0d7'},
  title:{fontFamily:GAME_FONT,fontSize:21,fontWeight:'800',color:'#fff0d7',letterSpacing:2},coins:{fontFamily:GAME_FONT,fontSize:16,fontWeight:'700',color:'#ffdb82'},
  subtitle:{fontFamily:GAME_FONT,fontSize:12,color:'#dec6a2',textAlign:'center',marginBottom:8},
  tabs:{flexDirection:'row',gap:5,marginTop:8,marginBottom:18,backgroundColor:'rgba(34,22,14,.85)',borderWidth:1,borderColor:'#90663f',borderRadius:14,padding:5},
  tab:{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:10},activeTab:{backgroundColor:'#705032',borderWidth:1,borderColor:'#c29558'},
  tabText:{fontFamily:GAME_FONT,fontWeight:'600',fontSize:13,color:'#d9bfa0'},activeTabText:{color:'#ffe3a4'},
  grid:{gap:12,paddingBottom:24},cardWrap:{},
  card:{padding:10,gap:10,borderRadius:18},equippedCard:{borderColor:'#d8c977'},
  shelf:{borderRadius:12,backgroundColor:'rgba(20,14,8,.38)',borderBottomWidth:3,borderBottomColor:'#a37342',padding:4},
  name:{fontFamily:GAME_FONT,fontSize:14,fontWeight:'700',color:'#fff0d7',textAlign:'center'},price:{fontFamily:GAME_FONT,fontSize:13,fontWeight:'700',color:'#ffdf81',textAlign:'center',paddingVertical:8,borderRadius:9,backgroundColor:'rgba(25,15,7,.45)',overflow:'hidden'},activePrice:{color:'#e1f3bc',backgroundColor:'#3e612e'},
  notice:{minHeight:24,alignItems:'center'},noticeText:{fontFamily:GAME_FONT,fontSize:13,color:'#ffe2a6'},
  backdrop:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(20,13,8,.76)'},
  dialog:{borderRadius:24,padding:20,gap:16},dialogTitle:{fontFamily:GAME_FONT,fontSize:24,fontWeight:'700',color:'#fff0d7',textAlign:'center'},
  copy:{fontFamily:GAME_FONT,fontSize:13,color:'#ead5b7',textAlign:'center'},shortfall:{fontFamily:GAME_FONT,fontSize:13,color:'#f3be92',textAlign:'center'},
  damageTabs:{flexDirection:'row',gap:4},damageTab:{flex:1,alignItems:'center',justifyContent:'center',minHeight:40,borderRadius:12},error:{padding:10,gap:10},
});
