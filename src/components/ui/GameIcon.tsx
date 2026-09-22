import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from './theme';
export type IconName = 'back'|'coin'|'lock'|'crown'|'sound'|'music'|'volume'|'haptics'|'motion'|'replay';
export default function GameIcon({name,size=22,color=THEME.gold}:{name:IconName;size?:number;color?:string}) {
  if(name==='coin')return <LinearGradient colors={['#ffe5a0','#cb9235']} style={{width:size,height:size,borderRadius:size/2,borderWidth:1,borderColor:color,alignItems:'center',justifyContent:'center'}}><View style={{width:size*.65,height:size*.65,borderWidth:1,borderRadius:size,borderColor:'#ad7526'}}/></LinearGradient>;
  if(name==='lock')return <View style={{width:size,height:size,alignItems:'center',justifyContent:'flex-end'}}><View style={{width:size*.55,height:size*.44,borderWidth:2,borderBottomWidth:0,borderColor:color,borderTopLeftRadius:8,borderTopRightRadius:8}}/><View style={{width:size*.78,height:size*.53,borderRadius:3,backgroundColor:color}}/></View>;
  if(name==='back')return <View style={{width:size*.45,height:size*.45,borderLeftWidth:2,borderBottomWidth:2,borderColor:color,transform:[{rotate:'45deg'}]}}/>;
  if(name==='volume'){const w=Math.max(2,size*.09);return <View style={{width:size,height:size}}>
    <View style={{position:'absolute',left:size*.04,top:size*.34,width:size*.2,height:size*.32,borderRadius:2,backgroundColor:color}}/>
    <View style={{position:'absolute',left:size*.24,top:size*.12,width:0,height:0,borderTopWidth:size*.38,borderBottomWidth:size*.38,borderRightWidth:size*.34,borderTopColor:'transparent',borderBottomColor:'transparent',borderRightColor:color}}/>
    {[.4,.74].map(d=><View key={d} style={{position:'absolute',left:size*(.5-d/2),top:size*(.5-d/2),width:size*d,height:size*d,borderRadius:size,borderWidth:w,borderColor:'transparent',borderRightColor:color}}/>)}
  </View>;}
  const mark={crown:'♛',sound:'♪',music:'♫',haptics:'≋',motion:'◌',replay:'↶'}[name];
  return <Text style={{color,fontSize:size,lineHeight:size*1.15,fontWeight:'700'}}>{mark}</Text>;
}
