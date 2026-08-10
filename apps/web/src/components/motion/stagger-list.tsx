'use client';

import { motion, useReducedMotion, type Variants } from 'motion/react';
import { Children, useState } from 'react';

/** Gap between consecutive items, in seconds. 60ms is the window where the
 * sequence still reads as one wave — push past ~100ms and the tail of a long
 * list feels like it is loading rather than arriving. */
const DEFAULT_STAGGER = 0.06;

/** How much of the list has to be on screen before the sequence starts. A
 * small fraction, so the run begins as the list crosses the fold rather than
 * after the reader is already looking at it. */
const VIEWPORT_AMOUNT = 0.15;

/** Travel of each item, in px. Small — the sequence carries the eye, the
 * distance doesn't need to. */
const ITEM_RISE = 12;

/** Tween rather than spring: every item runs the same curve, so the cadence
 * set by `staggerChildren` stays even. A spring's settle time varies with the
 * distance it is given and would blur the rhythm. */
function itemVariants(shouldReduceMotion: boolean): Variants {
  return {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : ITEM_RISE },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: shouldReduceMotion ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] },
    },
  };
}

interface StaggerItemProps {
  children: React.ReactNode;
  /** Match the element the surrounding markup expects — `li` inside a list,
   * `div` inside a grid of cards. */
  as?: 'li' | 'div';
  className?: string;
}

/** A single animated item, for markup that already owns its item element (a
 * row component that returns its own `<li>`, say). Inside a `StaggerList` with
 * `wrap={false}` it picks up its position in the sequence from the parent —
 * these variants only describe the two states, the cadence comes from above. */
export function StaggerItem({ children, as = 'li', className = '' }: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();
  const variants = itemVariants(!!shouldReduceMotion);

  return as === 'div' ? (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  ) : (
    <motion.li className={className} variants={variants}>
      {children}
    </motion.li>
  );
}

interface StaggerListProps {
  /** With `wrap` (the default) each direct child is put inside its own
   * animated item element and takes its place in the sequence from source
   * order; keys on the children are preserved. With `wrap={false}` the
   * children are rendered untouched and are expected to be `StaggerItem`s. */
  children: React.ReactNode;
  /** Container element. `ul` for a collection of things (the usual case),
   * `div` where a list would be semantically wrong or the parent already
   * provides one. Items follow: `li` inside `ul`, `div` inside `div`. */
  as?: 'ul' | 'div';
  wrap?: boolean;
  /** Seconds between items. */
  stagger?: number;
  /** Delay before the first item, in seconds. Useful when the list follows a
   * heading that animates in ahead of it. */
  delay?: number;
  /** Replay the sequence every time the list re-enters the viewport. Off by
   * default — re-animating on every scroll-by is noise, not feedback. */
  repeat?: boolean;
  className?: string;
  itemClassName?: string;
}

/** A collection whose items fade and rise in sequence when it scrolls into
 * view.
 *
 * The stagger is orchestrated by the container, not by the items: the parent
 * owns `initial`/`whileInView` and the children declare only their variants,
 * so Motion propagates the state down and applies `staggerChildren` as a delay
 * per index. Items therefore fire in source order at a fixed cadence — the
 * alternative (a `whileInView` on every item) sequences by scroll position
 * instead, which gives a ragged cascade on a grid and nothing at all for items
 * already on screen.
 *
 * The sequence is a one-shot. Once it has run, `initial` flips to `false`, so
 * items that mount later — a filtered search result, a page of infinite
 * scroll, a row added by a mutation — appear immediately instead of fading in
 * again. Without that latch, every keystroke in a search box would re-animate
 * the whole result set, which is the single most common way this pattern turns
 * from polish into lag. Existing items are untouched by the flip.
 *
 * The trade-off of container orchestration: the trigger is the *collection's*
 * visibility, so one taller than the viewport runs its whole sequence —
 * including the part below the fold — once `VIEWPORT_AMOUNT` of it is showing.
 * For a long list, either raise `stagger` so the tail is still arriving as the
 * reader gets there, or split it into sections that each own a `StaggerList`.
 *
 * Note that the pre-animation state is what the server renders: items ship as
 * `opacity: 0` and are revealed on hydration. That is the standard behaviour
 * for scroll-triggered motion, but it does mean the collection is invisible if
 * the bundle never executes — don't wrap anything load-bearing (an error
 * state, a sign-in prompt) in it. */
export function StaggerList({
  children,
  as = 'ul',
  wrap = true,
  stagger = DEFAULT_STAGGER,
  delay = 0,
  repeat = false,
  className = '',
  itemClassName = '',
}: StaggerListProps) {
  const shouldReduceMotion = useReducedMotion();
  const [hasRun, setHasRun] = useState(false);

  /* Reduced motion keeps the fade but drops the travel and the cadence: the
   * collection appears at once, which is the point — a sequence is movement,
   * and movement is what the preference is asking us not to do. */
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: shouldReduceMotion
        ? { staggerChildren: 0, delayChildren: 0 }
        : { staggerChildren: stagger, delayChildren: delay },
    },
  };

  const containerProps = {
    className,
    variants: containerVariants,
    /* `false` short-circuits the enter animation for anything mounting from
     * here on, without disturbing what is already on screen. */
    initial: hasRun && !repeat ? false : 'hidden',
    whileInView: 'visible',
    viewport: { once: !repeat, amount: VIEWPORT_AMOUNT },
    onAnimationComplete: () => setHasRun(true),
  };

  const itemAs = as === 'div' ? 'div' : 'li';
  const content = wrap
    ? Children.map(children, (child) => (
        <StaggerItem as={itemAs} className={itemClassName}>
          {child}
        </StaggerItem>
      ))
    : children;

  return as === 'div' ? (
    <motion.div {...containerProps}>{content}</motion.div>
  ) : (
    <motion.ul {...containerProps}>{content}</motion.ul>
  );
}
