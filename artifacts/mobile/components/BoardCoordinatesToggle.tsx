import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandAssetToggle } from '@/components/BrandAssetToggle';
import { BrandAssets } from '@/constants/BrandAssets';

interface Props {
  visible: boolean;
  onToggle: () => void;
}

/** Coordinates show/hide — brand coords-on / coords-off assets. */
export function BoardCoordinatesToggle({ visible, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <BrandAssetToggle
      active={visible}
      onSource={BrandAssets.toggles.coordinates.on}
      offSource={BrandAssets.toggles.coordinates.off}
      onPress={onToggle}
      testID="board-coordinates-toggle"
      accessibilityLabel={visible ? t('a11y.coordsHide') : t('a11y.coordsShow')}
    />
  );
}
