import type { CSSProperties } from 'react';

import type { ClubBannerPos } from './club-profile';

/** The printed banner strip bleeds to the full 210mm page width (≈794px at
 * 96dpi) and stands 96px tall. The settings drag frame uses this same aspect
 * so the crop the admin sees is exactly the crop the PDF prints. */
export const AGENDA_BANNER_WIDTH = 794;
export const AGENDA_BANNER_HEIGHT = 96;
export const AGENDA_BANNER_ASPECT = AGENDA_BANNER_WIDTH / AGENDA_BANNER_HEIGHT;

/** Toastmasters International's official maroon — the strip colour when a
 * club has picked none. The agenda sheet imports this same constant so the
 * settings preview and the PDF never drift apart. */
export const DEFAULT_BANNER_COLOR = '#772432';

export const DEFAULT_BANNER_POS: ClubBannerPos = { x: 50, y: 50, zoom: 1 };

type BannerBackground = Pick<
  CSSProperties,
  'backgroundImage' | 'backgroundSize' | 'backgroundPosition' | 'backgroundRepeat'
>;

/** CSS that places a banner image inside the fixed strip — shared by the
 * settings drag frame and the printed agenda sheet so what the admin sees
 * is what prints. `pos.aspect` (stored at upload) lets the cover fit be
 * computed without loading the file; without it we fall back to plain
 * `cover` and hope the browser gets it right. */
export function bannerImageCss(url: string, pos: ClubBannerPos): BannerBackground {
  const zoom = Math.max(1, pos.zoom || 1);
  const size = pos.aspect
    ? pos.aspect >= AGENDA_BANNER_ASPECT
      ? `auto ${zoom * 100}%`
      : `${zoom * 100}% auto`
    : 'cover';
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: size,
    backgroundPosition: `${pos.x}% ${pos.y}%`,
    backgroundRepeat: 'no-repeat',
  };
}

/** Pixel overflow of the rendered image past the frame, per axis. The drag
 * handler divides pointer deltas by this to move in background-position
 * percentages; zero overflow means that axis cannot be dragged. */
export function bannerOverflow(
  frameW: number,
  frameH: number,
  pos: ClubBannerPos,
): { x: number; y: number } {
  if (!pos.aspect || frameW <= 0 || frameH <= 0) return { x: 0, y: 0 };
  const zoom = Math.max(1, pos.zoom || 1);
  const frameAspect = frameW / frameH;
  const renderedH = pos.aspect >= frameAspect ? frameH * zoom : (frameW * zoom) / pos.aspect;
  const renderedW = pos.aspect >= frameAspect ? frameH * zoom * pos.aspect : frameW * zoom;
  return { x: Math.max(0, renderedW - frameW), y: Math.max(0, renderedH - frameH) };
}
