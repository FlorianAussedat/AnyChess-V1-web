export type AvatarPosition = { x: number; y: number };
export type AvatarRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export const CENTERED_AVATAR: AvatarPosition = { x: 0.5, y: 0.5 };

export function clampAvatarZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.min(3, Math.max(1, zoom)) : 1;
}

/** Integer source pixels are shared by the preview and every export backend. */
export function avatarCropRect(
  width: number,
  height: number,
  zoom = 1,
  position: AvatarPosition = CENTERED_AVATAR,
): AvatarRect {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const side = Math.max(1, Math.round(Math.min(w, h) / clampAvatarZoom(zoom)));
  const x = Number.isFinite(position.x) ? position.x : 0.5;
  const y = Number.isFinite(position.y) ? position.y : 0.5;
  return {
    x: Math.round(Math.max(0, Math.min(w - side, x * w - side / 2))),
    y: Math.round(Math.max(0, Math.min(h - side, y * h - side / 2))),
    width: side,
    height: side,
  };
}

export function clampAvatarPosition(
  width: number,
  height: number,
  zoom: number,
  position: AvatarPosition,
): AvatarPosition {
  const crop = avatarCropRect(width, height, zoom, position);
  return {
    x: (crop.x + crop.width / 2) / width,
    y: (crop.y + crop.height / 2) / height,
  };
}

/** Drag the image, not the frame: a rightward drag reveals pixels further left. */
export function panAvatarPosition(input: {
  width: number;
  height: number;
  zoom: number;
  frame: number;
  position: AvatarPosition;
  dx: number;
  dy: number;
}): AvatarPosition {
  const crop = avatarCropRect(
    input.width,
    input.height,
    input.zoom,
    input.position,
  );
  const scale = Math.max(1, input.frame) / crop.width;
  return clampAvatarPosition(input.width, input.height, input.zoom, {
    x: input.position.x - input.dx / scale / input.width,
    y: input.position.y - input.dy / scale / input.height,
  });
}

export function avatarCropPreview(
  width: number,
  height: number,
  frame: number,
  zoom: number,
  position: AvatarPosition = CENTERED_AVATAR,
) {
  const crop = avatarCropRect(width, height, zoom, position);
  const scale = frame / crop.width;
  return {
    crop,
    width: width * scale,
    height: height * scale,
    left: -crop.x * scale,
    top: -crop.y * scale,
  };
}
