import React from 'react';
import { Image, View } from 'react-native';
import { BottleVisual } from '../Tube';
import Ball from '../Ball';
import { getBackgroundThumbnail } from '@/assets/cosmetics';
import type { CosmeticDefinition } from '@/domain/cosmetics/catalog';
import type { DamageStage } from '@/types/game';

/** Explicit preview props never write equipped state. Uses the gameplay renderers. */
export default function CosmeticPreview({item,large=false,stage='pristine'}:{item:CosmeticDefinition;large?:boolean;stage?:DamageStage}) {
  const height=large?180:116;
  return <View pointerEvents="none" testID={`preview-${item.id}`} style={{height,width:'100%',alignItems:'center',justifyContent:'center',overflow:'hidden',borderRadius:14,backgroundColor:'rgba(23,17,12,.12)'}}>
    {item.category==='bottle' ? <BottleVisual skinId={item.id} stage={stage} width={large?65:40} height={large?174:108} natural thumbnail={!large} />
      : item.category==='weight' ? <Ball skinId={item.id} weight={5} color="green" size={large?126:84} />
      : <Image fadeDuration={0} source={getBackgroundThumbnail(item.id)} resizeMode="cover" style={{width:'100%',height:'100%'}} />}
  </View>;
}
