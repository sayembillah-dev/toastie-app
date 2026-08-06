'use client';

import { LockSimple } from '@phosphor-icons/react/dist/ssr';

import { getModuleLabel, type ModuleKey } from '@/lib/permissions/permissions';
import { usePermission } from '@/lib/permissions/use-permission';

interface ModuleAccessGateProps {
  module: ModuleKey;
  children: React.ReactNode;
}

/** Client-side read gate for a whole page — the module route's actual
 * authority is the server-side chokepoint in `local-db/handlers.ts`
 * (`assertModuleAccess`), this just keeps a member who can't read the
 * module from seeing its data flash by before every request 403s. */
export function ModuleAccessGate({ module, children }: ModuleAccessGateProps) {
  const { read, isLoading } = usePermission(module);

  if (isLoading) return null;

  if (!read) {
    return (
      <div className="flex h-full min-h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            aria-hidden
            className="mb-1 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <LockSimple size={18} weight="bold" />
          </span>
          <h2 className="text-lg font-semibold text-ink">Access restricted</h2>
          <p className="max-w-sm text-sm text-ink-soft">
            You don&rsquo;t have access to {getModuleLabel(module)}. Ask a Club Admin to grant it
            from the Club Admin dashboard.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
