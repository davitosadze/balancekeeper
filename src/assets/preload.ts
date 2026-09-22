import { Asset } from 'expo-asset';
import { Image, Platform, type ImageSourcePropType } from 'react-native';
import { getActiveGameplayAssets } from './cosmetics';

const pending = new Map<string, Promise<void>>();
// Keep decoded browser handles alive for the current skin/background only.
let activeKey = '';
let activeUris = new Set<string>();
const decoded = new Map<string, HTMLImageElement>();
export function preloadImage(source: ImageSourcePropType): Promise<void> {
  const uri = Asset.fromModule(source as number).uri;
  const cached = pending.get(uri);
  if (cached) return cached;
  const task = (async () => {
    if (Platform.OS === 'web') {
      const image = new globalThis.Image(); image.src = uri;
      await image.decode(); if(activeUris.has(uri)) decoded.set(uri, image);
    } else {
      await Image.prefetch(uri);
    }
  })().catch(error => { pending.delete(uri); throw error; });
  pending.set(uri,task);
  return task;
}
export function prepareGameplayAssets(backgroundId: string, bottleSkinId: string) {
  const key = `${backgroundId}:${bottleSkinId}`;
  if (key !== activeKey) {
    activeKey = key; decoded.clear(); pending.clear();
    activeUris = new Set(getActiveGameplayAssets(backgroundId,bottleSkinId).map(source => Asset.fromModule(source as number).uri));
  }
  return Promise.all(getActiveGameplayAssets(backgroundId,bottleSkinId).map(preloadImage));
}
