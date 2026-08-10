'use client';

import { type HTMLMotionProps, motion, useReducedMotion } from 'motion/react';

/** Spring, not a duration curve. A tween has to finish before it can be
 * interrupted cleanly; a spring carries its current velocity into the next
 * gesture, so hover → tap → release mid-flight reads as one continuous motion
 * instead of three queued animations.
 *
 * `stiffness: 420` / `damping: 30` lands just shy of critical damping — it
 * settles in ~180ms with a trace of overshoot, which is what makes the press
 * feel physical rather than mechanical. The low `mass` keeps it from feeling
 * heavy at these tiny distances. */
const SPRING = { type: 'spring', stiffness: 420, damping: 30, mass: 0.6 } as const;

/** Scale up on hover, press down on tap. Kept small on purpose — 5% is enough
 * to register as feedback without shifting the layout around it. */
const HOVER_SCALE = 1.05;
const TAP_SCALE = 0.95;

interface MotionButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
}

/** A button that scales on hover and presses in on tap, on spring physics.
 *
 * `whileHover`/`whileTap` are gesture states rather than CSS transitions
 * because they cancel correctly: pointer-out mid-press returns from wherever
 * the scale actually is. They also cover touch and pen, where `:hover` and
 * `:active` are unreliable.
 *
 * `useReducedMotion` drops both gestures to identity rather than shortening
 * them — a scale animation is exactly what motion sensitivity is about, so the
 * honest answer is no movement at all. The focus ring and colour transitions
 * stay, so the button still reads as interactive.
 *
 * `scale` only ever animates transform and never layout, so a press costs no
 * reflow no matter what sits around it. */
export function MotionButton({ children, disabled, className = '', ...rest }: MotionButtonProps) {
  const shouldReduceMotion = useReducedMotion();

  /* A disabled button must not respond to either gesture. Motion still fires
   * hover on a disabled element (pointer events reach it unless CSS says
   * otherwise), so the states are dropped rather than relying on the DOM. */
  const isInert = disabled || shouldReduceMotion;

  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileHover={isInert ? undefined : { scale: HOVER_SCALE }}
      whileTap={isInert ? undefined : { scale: TAP_SCALE }}
      transition={SPRING}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
