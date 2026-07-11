import type { ReactNode } from 'react';

type Variant = 'primary' | 'warning' | 'success';

interface AdminStatCardProps {
  value: number | string;
  label: string;
  variant: Variant;
  icon: ReactNode;
}

export function AdminStatCard({ value, label, variant, icon }: AdminStatCardProps) {
  return (
    <div className={`card admin-stat-card admin-stat-card--${variant} h-100`}>
      <div className="card-body">
        <div className="d-flex align-items-center gap-3">
          <div className={`admin-stat-card__icon admin-stat-card__icon--${variant}`} aria-hidden>
            {icon}
          </div>
          <div className="flex-grow-1 text-end">
            <h3 className="admin-stat-card__value mb-0">{value}</h3>
            <span className="admin-stat-card__label">{label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IconPencil() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconList() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

export function IconUsers() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
