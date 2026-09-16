import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandAssetToggle } from '@/components/BrandAssetToggle';
import { BrandAssets } from '@/constants/BrandAssets';

interface Props {
  visible: boolean;
  onToggle: () => void;
}

/** Board show/hide — brand board-on / board-off assets. */
export function BoardVisibilityToggle({ visible, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <BrandAssetToggle
      active={visible}
      onSource={BrandAssets.toggles.board.on}
      offSource={BrandAssets.toggles.board.off}
      onPress={onToggle}
      testID="board-visibility-toggle"
      accessibilityLabel={visible ? t('a11y.boardHide') : t('a11y.boardShow')}
    />
  );
}
