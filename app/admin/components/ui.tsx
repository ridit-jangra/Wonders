/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import HcIcon, { type GlyphName } from "@hackclub/icons";
import SubmitButton from "@/app/dashboard/components/SubmitButton";
import type { ProjectHistoryEntry } from "@/lib/project-history";

export type { GlyphName };

export type Tone = "neutral" | "info" | "cyan" | "warning" | "yellow" | "success" | "danger" | "purple";

export type ButtonVariant = "primary" | "cream" | "outline" | "ghost" | "success" | "danger";

export type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "hc-btn",
  cream: "hc-btn hc-btn-cream",
  outline: "hc-btn hc-btn-outline",
  ghost: "hc-btn hc-btn-ghost",
  success: "hc-btn hc-btn-success",
  danger: "hc-btn hc-btn-danger",
};

const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "hc-btn-sm",
  md: "",
  lg: "hc-btn-lg",
};

const BUTTON_ICON_SIZE: Record<ButtonSize, number> = {
  sm: 18,
  md: 20,
  lg: 22,
};

export const STATUS_TONE: Record<string, Tone> = {
  building: "neutral",
  in_review: "warning",
  second_pass: "cyan",
  rejected: "danger",
  approved: "info",
  shipped: "success",
  fulfillment_started: "purple",
  fulfilled: "success",
};

export const STATUS_LABEL: Record<string, string> = {
  building: "Building",
  in_review: "First pass",
  second_pass: "Second pass",
  rejected: "Changes requested",
  approved: "Approved",
  shipped: "Shipped",
  fulfillment_started: "Fulfilling",
  fulfilled: "Fulfilled",
};

export const STATUS_GLYPH: Record<string, GlyphName> = {
  building: "code",
  in_review: "view",
  second_pass: "view-reload",
  rejected: "forbidden",
  approved: "checkmark",
  shipped: "send",
  fulfillment_started: "package",
  fulfilled: "check-circle",
};

export function Icon({
  glyph,
  size = 20,
  className = "",
}: {
  glyph: GlyphName;
  size?: number;
  className?: string;
}) {
  return <HcIcon glyph={glyph} size={size} className={className} aria-hidden />;
}

export function Badge({
  children,
  tone = "neutral",
  icon,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: GlyphName;
}) {
  return (
    <span className="hc-badge" data-tone={tone}>
      {icon && <Icon glyph={icon} size={16} />}
      {children}
    </span>
  );
}

export function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="hc-badge" data-variant="count">
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>
  );
}

export function Card({
  children,
  padding = "normal",
  className = "",
}: {
  children: ReactNode;
  padding?: "normal" | "compact" | "flush";
  className?: string;
}) {
  return (
    <div className={`hc-card ${className}`} data-density={padding}>
      {children}
    </div>
  );
}

export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="hc-card" data-variant="interactive" data-density="compact">
      {children}
    </Link>
  );
}

export function CardHeader({
  title,
  icon,
  count,
  action,
}: {
  title: ReactNode;
  icon?: GlyphName;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="hc-card-header">
      <h2 className="hc-heading flex items-center gap-2 text-base">
        {icon && <Icon glyph={icon} size={22} className="hc-muted" />}
        {title}
        {count !== undefined && <CountBadge>{count}</CountBadge>}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  count,
  description,
  actions,
}: {
  title: ReactNode;
  count?: number;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="hc-title flex flex-wrap items-center gap-3">
          {title}
          {count !== undefined && <CountBadge>{count}</CountBadge>}
        </h1>
        {description && <p className="hc-caption mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: GlyphName;
}) {
  return (
    <button className={`${BUTTON_VARIANT_CLASS[variant]} ${BUTTON_SIZE_CLASS[size]}`} {...props}>
      {icon && <Icon glyph={icon} size={BUTTON_ICON_SIZE[size]} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  external = false,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: GlyphName;
  external?: boolean;
  children: ReactNode;
}) {
  const className = `${BUTTON_VARIANT_CLASS[variant]} ${BUTTON_SIZE_CLASS[size]}`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {icon && <Icon glyph={icon} size={BUTTON_ICON_SIZE[size]} />}
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {icon && <Icon glyph={icon} size={BUTTON_ICON_SIZE[size]} />}
      {children}
    </Link>
  );
}

export function ActionButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  formAction,
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: GlyphName;
  disabled?: boolean;
  formAction?: (formData: FormData) => void;
}) {
  return (
    <SubmitButton
      pendingLabel={pendingLabel}
      className={`${BUTTON_VARIANT_CLASS[variant]} ${BUTTON_SIZE_CLASS[size]}`}
      disabled={disabled}
      formAction={formAction}
    >
      {icon && <Icon glyph={icon} size={BUTTON_ICON_SIZE[size]} />}
      {children}
    </SubmitButton>
  );
}

export function TextLink({
  href,
  children,
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  className?: string;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={`hc-link ${className}`}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={`hc-link ${className}`}>
      {children}
    </Link>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="hc-mono">{children}</span>;
}

export function Muted({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`hc-muted ${className}`}>{children}</span>;
}

export function Quote({ children }: { children: ReactNode }) {
  return <blockquote className="hc-quote">{children}</blockquote>;
}

export function Callout({
  children,
  tone = "warning",
  icon,
}: {
  children: ReactNode;
  tone?: "warning" | "danger" | "info" | "success" | "neutral";
  icon?: GlyphName;
}) {
  return (
    <div className="hc-callout flex items-start gap-2" data-tone={tone}>
      {icon && <Icon glyph={icon} size={22} className="shrink-0" />}
      <div className="min-w-0 pt-px">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  icon = "relaxed",
}: {
  title: ReactNode;
  children?: ReactNode;
  icon?: GlyphName;
}) {
  return (
    <div className="hc-empty">
      <span className="hc-empty-icon">
        <Icon glyph={icon} size={32} />
      </span>
      <p className="hc-empty-title">{title}</p>
      {children && <p className="hc-empty-body">{children}</p>}
    </div>
  );
}

export function Avatar({ src, size = 32 }: { src: string | null | undefined; size?: number }) {
  if (!src) {
    return (
      <span
        className="hc-avatar hc-muted inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Icon glyph="person" size={Math.round(size * 0.7)} />
      </span>
    );
  }

  return <img src={src} alt="" width={size} height={size} className="hc-avatar" />;
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="hc-stat-grid">{children}</dl>;
}

export function Stat({
  label,
  value,
  icon,
  tone,
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: GlyphName;
  tone?: Tone;
  href: string;
}) {
  return (
    <CardLink href={href}>
      <div className="hc-stat flex flex-col gap-3" data-tone={tone}>
        <dt className="hc-eyebrow flex items-center gap-1">
          {icon && <Icon glyph={icon} size={18} />}
          {label}
        </dt>
        <dd className="hc-stat-value m-0">{value}</dd>
      </div>
    </CardLink>
  );
}

export function Table({ headers, children }: { headers: ReactNode[]; children: ReactNode }) {
  return (
    <div className="hc-table-wrap">
      <table className="hc-table">
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({
  colSpan,
  title,
  children,
  icon,
}: {
  colSpan: number;
  title: ReactNode;
  children?: ReactNode;
  icon?: GlyphName;
}) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState title={title} icon={icon}>
          {children}
        </EmptyState>
      </td>
    </tr>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`hc-label ${className}`}>
      {label}
      {hint && <span className="hc-label-hint">{hint}</span>}
      {children}
    </label>
  );
}

export function Input({ className = "", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={`hc-input ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={`hc-textarea ${className}`} {...props} />;
}

export function FilterBar({
  q,
  placeholder,
  children,
}: {
  q?: string;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <form className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-60 flex-1">
        <Icon
          glyph="search"
          size={20}
          className="hc-muted pointer-events-none absolute top-1/2 left-2 -translate-y-1/2"
        />
        <Input name="q" type="search" defaultValue={q} placeholder={placeholder} className="hc-input-search" />
      </div>
      {children}
      <Button type="submit" variant="outline">
        Filter
      </Button>
    </form>
  );
}

export function DescriptionList({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="hc-dl">
      {items.map(([label, value], i) => (
        <div key={i} className="contents">
          <dt>{label}</dt>
          <dd>{value ? value : <Muted>—</Muted>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HistoryTimeline({
  entries,
  linkProjects = false,
}: {
  entries: ProjectHistoryEntry[];
  linkProjects?: boolean;
}) {
  if (entries.length === 0) {
    return <EmptyState title="No history yet" icon="history" />;
  }

  return (
    <ol className="hc-timeline">
      {entries.map((entry) => (
        <li key={entry.id}>
          <div className="flex flex-wrap items-center gap-2">
            {entry.from_status ? <StatusBadge status={entry.from_status} /> : <Badge>New</Badge>}
            <Muted>→</Muted>
            <StatusBadge status={entry.to_status} />
            {linkProjects && (
              <TextLink href={`/admin/review/${entry.project_id}`} className="hc-muted">
                wonder #{entry.project_id}
              </TextLink>
            )}
          </div>
          <p className="hc-caption mt-1 text-xs">
            <Mono>{new Date(entry.created_at).toLocaleString()}</Mono> · by{" "}
            <Mono>{entry.reviewed_by}</Mono>
          </p>
          {entry.reviewer_note && <p className="mt-1">&ldquo;{entry.reviewer_note}&rdquo;</p>}
          {entry.reward && (
            <p className="mt-1">
              <Badge tone="purple" icon="bag">
                {entry.reward}
              </Badge>
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="mt-4 flex items-center justify-between gap-4">
      <span className="hc-caption text-sm">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <ButtonLink href={hrefFor(page - 1)} variant="outline" size="sm">
            Previous
          </ButtonLink>
        )}
        {page < totalPages && (
          <ButtonLink href={hrefFor(page + 1)} variant="outline" size="sm">
            Next
          </ButtonLink>
        )}
      </div>
    </nav>
  );
}
