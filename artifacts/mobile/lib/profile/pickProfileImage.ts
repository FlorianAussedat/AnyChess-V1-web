/**
 * Profile photo / logo picker.
 * Reuses expo-document-picker (system picker, no photo-library permission).
 * expo-image-picker stays out of the Android manifest.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

export type PickedProfileImage = {
  uri: string;
  mime: string;
};

function pickOnWeb(): Promise<PickedProfileImage | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: PickedProfileImage | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif,image/*';
    input.multiple = false;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const uri = typeof reader.result === 'string' ? reader.result : '';
        if (!uri.startsWith('data:image/')) {
          finish(null);
          return;
        }
        finish({ uri, mime: file.type || 'image/png' });
      };
      reader.onerror = () => finish(null);
      reader.readAsDataURL(file);
    };
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 400);
    };
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

export async function pickProfileImage(): Promise<PickedProfileImage | null> {
  if (Platform.OS === 'web') return pickOnWeb();
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'image/png', 'image/jpeg', 'image/webp'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, mime: asset.mimeType || 'image/png' };
}
