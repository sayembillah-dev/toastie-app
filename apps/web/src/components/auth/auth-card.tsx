import type { ReactNode } from 'react';

interface AuthCardProps {
  /** Phosphor icon rendered in the badge above the title — omitted entirely
   * (rather than left blank) when a state has no natural icon. */
  icon?: React.ComponentType<{ size?: number; weight?: 'bold' | 'fill'; className?: string }>;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

/** The glass card every `AuthShell` screen centers — sign in, sign up, and
 * both invite steps all share this same badge/title/subtitle/body/footer
 * rhythm so the four surfaces read as one flow rather than four one-offs. */
export function AuthCard({ icon: Icon, title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="rounded-3xl border border-white/50 bg-gradient-to-b from-white/95 to-white/85 p-8 shadow-[0_24px_60px_-20px_rgba(11,42,76,0.45)] backdrop-blur-xl">
      {Icon ? (
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-ink text-white">
          <Icon size={22} weight="bold" />
        </div>
      ) : null}

      <h1 className="text-center text-xl font-semibold text-ink">{title}</h1>
      {subtitle ? <div className="mt-1.5 text-center text-sm text-ink-soft">{subtitle}</div> : null}

      {children ? <div className="mt-6">{children}</div> : null}

      {footer ? <div className="mt-5 text-center text-xs text-ink-muted">{footer}</div> : null}
    </div>
  );
}
