'use client';

import type { Action, ResourceKey, Target } from '@toastly/access';
import { ConfigProvider, Tooltip } from 'antd';

import { useCan } from '@/lib/permissions/use-can';

/** One sentence, everywhere. A read-only user meets this on every affordance
 * they can see but not use, so it has to read the same each time. */
export const READ_ONLY_MESSAGE = 'You only have read permission';

interface ReadOnlyWhenProps {
  /** True when the enclosed affordance should be visible but dead. */
  readOnly: boolean;
  /** `inline` (default) sits in a button row; `block` fills the width, for a
   * form body or a card of fields. */
  display?: 'inline' | 'block';
  /** Layout classes for the wrapper, when one is needed to keep the children
   * laid out as they were before wrapping (e.g. `flex flex-col gap-4` over a
   * stack of fields). Only rendered in the read-only branch, so pass classes
   * that reproduce the parent's own layout and nothing more. */
  className?: string;
  children: React.ReactNode;
}

/** Greys out every antd control inside and explains why on hover.
 *
 * The permission stays the server's call — this is the affordance half, so a
 * read-only user sees the same screen everyone else does rather than a
 * different, emptier one, and gets told why the controls are dead instead of
 * discovering it through a 403.
 *
 * `ConfigProvider componentDisabled` does the greying: it reaches every antd
 * control in the subtree (including ones inside a Modal or Drawer, which are
 * portalled in the DOM but still children in the React tree), so a form body
 * needs one wrapper rather than a `disabled` on each field. Plain HTML
 * elements are outside its reach — gate those with the boolean directly.
 *
 * Wrap only the write affordances. Search boxes, filters, pagination and a
 * modal's Cancel button all have to keep working for someone who can read.
 *
 * Never wrap the trigger child of a Dropdown, Popconfirm, or Tooltip: those
 * clone their child to attach handlers, and this renders a component, not the
 * control. Put the fence around the Dropdown/Popconfirm instead — the disabled
 * trigger inside it then swallows the click on its own. */
export function ReadOnlyWhen({
  readOnly,
  display = 'inline',
  className,
  children,
}: ReadOnlyWhenProps) {
  if (!readOnly) return <>{children}</>;

  return (
    <Tooltip title={READ_ONLY_MESSAGE}>
      {/* A disabled control fires no mouse events of its own — the browser
       * hands them to the nearest enabled ancestor — so the tooltip hangs off
       * this wrapper rather than off the control itself. `cursor-not-allowed`
       * is repeated here for the gaps between controls. */}
      <div
        className={`${display === 'block' ? 'w-full' : 'inline-flex'} cursor-not-allowed ${className ?? ''}`}
      >
        <ConfigProvider componentDisabled>{children}</ConfigProvider>
      </div>
    </Tooltip>
  );
}

interface ReadOnlyProps extends Omit<ReadOnlyWhenProps, 'readOnly'> {
  resource: ResourceKey;
  /** The write the enclosed affordance performs. `update` covers the common
   * "edit this thing" case; pass `create`/`delete` where that is the actual
   * action, so the check matches what the API will enforce. */
  action?: Action;
  /** Passed straight to `can()` for anything not anchored to the active club
   * (an `own`-scoped row, a director drilling into another club). */
  target?: Target;
}

/** `ReadOnlyWhen` with the permission check built in — the common case. */
export function ReadOnly({ resource, action = 'update', target, ...rest }: ReadOnlyProps) {
  const readOnly = useReadOnly(resource, action, target);
  return <ReadOnlyWhen readOnly={readOnly} {...rest} />;
}

/** The same decision without the wrapper, for plain HTML controls, drag
 * handlers, and anything else `ConfigProvider` cannot reach. Pair it with
 * `READ_ONLY_MESSAGE` so the copy stays identical. */
export function useReadOnly(resource: ResourceKey, action: Action = 'update', target?: Target) {
  const { can } = useCan();
  return !can(action, resource, target);
}
