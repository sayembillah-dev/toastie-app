'use client';

import { Slider } from 'antd';
import { useRef, useState } from 'react';

import {
  AGENDA_BANNER_HEIGHT,
  AGENDA_BANNER_WIDTH,
  bannerImageCss,
  bannerOverflow,
} from '@/lib/club/banner';
import type { ClubBannerPos } from '@/lib/club/club-profile';

interface BannerImageFrameProps {
  src: string;
  pos: ClubBannerPos;
  onChange: (pos: ClubBannerPos) => void;
  disabled?: boolean;
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origin: ClubBannerPos;
  overflowX: number;
  overflowY: number;
}

/** Live preview of the printed agenda banner strip — same aspect as the PDF
 * (full A4 width × 96px) and the same background CSS, so the crop the admin
 * drags into place here is the crop that prints. Dragging pans the image
 * (like grabbing the picture itself); the slider zooms past the cover fit. */
export function BannerImageFrame({ src, pos, onChange, disabled }: BannerImageFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Without a known aspect the overflow math is undefined — the image just
    // renders `cover` and there is nothing meaningful to drag.
    if (disabled || !pos.aspect) return;
    const frame = frameRef.current;
    if (!frame) return;
    const { x: overflowX, y: overflowY } = bannerOverflow(
      frame.clientWidth,
      frame.clientHeight,
      pos,
    );
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: pos,
      overflowX,
      overflowY,
    };
    frame.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    // background-position p% aligns the p% point of the image with the p%
    // point of the frame, so moving the picture right by dx px *decreases*
    // the x percentage by dx/overflow — the percentage is an alignment, not
    // an offset.
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    onChange({
      ...pos,
      x: drag.overflowX > 0 ? clampPct(drag.origin.x - (dx / drag.overflowX) * 100) : pos.x,
      y: drag.overflowY > 0 ? clampPct(drag.origin.y - (dy / drag.overflowY) * 100) : pos.y,
    });
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={frameRef}
        role="img"
        aria-label="Agenda banner preview — drag to reposition the image"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative w-full touch-none overflow-hidden rounded-lg border border-line bg-fill select-none"
        style={{
          aspectRatio: `${AGENDA_BANNER_WIDTH} / ${AGENDA_BANNER_HEIGHT}`,
          cursor: disabled || !pos.aspect ? 'default' : dragging ? 'grabbing' : 'grab',
          ...bannerImageCss(src, pos),
        }}
      />
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-xs text-ink-muted">Zoom</span>
        <Slider
          className="flex-1"
          min={1}
          max={4}
          step={0.05}
          value={pos.zoom}
          disabled={disabled}
          onChange={(zoom) => onChange({ ...pos, zoom })}
          tooltip={{ formatter: (value) => `${Math.round((value ?? 1) * 100)}%` }}
        />
      </div>
    </div>
  );
}
