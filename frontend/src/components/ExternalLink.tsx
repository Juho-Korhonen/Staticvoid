import type { ReactNode } from 'react';

/** Opens in a new tab; renders a plain anchor without href when `href` is null. */
export default function ExternalLink({ href, className, children }: { href: string | null; className?: string; children: ReactNode }) {
  return <a className={className} href={href ?? undefined} target="_blank" rel="noreferrer">{children}</a>;
}
