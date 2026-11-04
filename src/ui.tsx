import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useBusiness } from './business';
import { createPortal } from 'react-dom';

export const inp = 'form-input';
export const btn = 'button button-primary';
export const btn2 = 'button button-secondary';

export function Modal({ title, description, children, onClose, onSubmit, submitLabel = 'Save', error, footer, compact = false }: {
  title: string; description?: string; children: ReactNode; onClose: () => void;
  onSubmit?: () => void | Promise<void>; submitLabel?: string; error?: string; footer?: ReactNode; compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const backdropPress = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const id = useId();
  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    element.querySelector<HTMLElement>('input:not([disabled]), select, textarea')?.focus();
    return () => { element.close(); document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus(); };
  }, []);
  const close = () => { if (!submitting.current) onClose(); };
  return createPortal(
    <dialog ref={dialog} className={`entry-modal ${compact ? 'modal-compact' : ''}`} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}
      onPointerDown={(event) => { backdropPress.current = event.target === event.currentTarget; }}
      onClick={(event) => { if (event.target === event.currentTarget && backdropPress.current) close(); }}>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true; setBusy(true); setFailure('');
        try { await onSubmit?.(); } catch (error) { setFailure((error as Error).message || 'Unable to save. Please try again.'); }
        finally { submitting.current = false; setBusy(false); }
      }}>
        <header className="modal-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h2 id={`${id}-title`}>{title}</h2>{description && <p id={`${id}-description`}>{description}</p>}</div><button className="icon-button" type="button" aria-label="Close dialog" disabled={busy} onClick={close}><Icon name="close" /></button></header>
        <div className="modal-body"><fieldset disabled={busy}>{children}</fieldset>{(failure || error) && <p className="form-notice mt-4" role="alert">{failure || error}</p>}</div>
        <footer className="modal-footer"><div className="modal-footer-detail">{footer}</div><div className="modal-actions">{onSubmit ? <><button className={btn2} type="button" onClick={close} disabled={busy}>Cancel</button><button className={btn} type="submit" disabled={busy}>{busy ? <><span className="spinner" />Saving…</> : submitLabel}</button></> : <button className={btn} type="button" onClick={close}>Close</button>}</div></footer>
      </form>
    </dialog>, document.body,
  );
}

const paths: Record<string, ReactNode> = {
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  moon: <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />,
  monitor: <><rect x="3" y="3" width="18" height="13" rx="2" /><path d="M12 16v5M8 21h8" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  offline: <><path d="m3 3 18 18M2 8a17 17 0 0 1 3-2M9 4a17 17 0 0 1 13 4M5 12a12 12 0 0 1 4-2M14 10a12 12 0 0 1 5 2M8.5 15.5a5 5 0 0 1 7 0M12 20h.01" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  bottle: <><path d="M9 3h6v4H9zM8 7h8v3l3 3v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7l3-3z" /><path d="M9 14h6v4H9z" /></>,
  bag: <><path d="M5 7h14l2 14H3L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5" /></>,
  wallet: <><path d="M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7" /><path d="M21 12h-6v5h6M17 14.5h.01" /></>,
  chart: <><path d="M4 3v18h17M8 16v-4M13 16V8M18 16V5" /></>,
  settings: <><path d="m9 3-1 3-3 1-2 3 2 2-1 4 3 2 3-1 2 4 3-1 1-3 4-1 1-4-3-2V6l-4-1-2-2Z" /><circle cx="12" cy="12" r="3" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  logout: <><path d="M9 4H4v16h5M9 12h12m-5-5 5 5-5 5" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
  sparkle: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" /></>,
  inbox: <><path d="M4 4h16l2 11v5H2v-5L4 4Z" /><path d="M2 15h6l2 3h4l2-3h6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
};

export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] || paths.sparkle}</svg>;
}

export function Brand({ light = false }: { light?: boolean }) {
  const { business } = useBusiness();
  const [brokenLogo, setBrokenLogo] = useState(false);
  useEffect(() => { setBrokenLogo(false); }, [business.logo]);
  return <div className={`brand-lockup ${light ? 'brand-light' : ''}`}><span className="brand-mark">{business.logo && !brokenLogo ? <img src={business.logo} alt="" onError={() => setBrokenLogo(true)} /> : <Icon name="bottle" size={25} />}</span><div><strong title={business.name || 'Perfume Manager'}>{business.name || 'Perfume Manager'}<span className="brand-dot">.</span></strong><span className="brand-caption">A little order. A lot of possibility.</span></div></div>;
}

export function BottleArt() {
  return <div className="bottle-art" aria-hidden="true"><div className="bottle-orbit orbit-one" /><div className="bottle-orbit orbit-two" /><div className="bottle-shadow" /><div className="perfume-cap" /><div className="perfume-neck" /><div className="perfume-bottle"><div className="perfume-liquid" /><div className="perfume-label"><span>THE EVERYDAY</span><b>Love Struck</b><i>of a beautiful business</i><span>EAU DE POSSIBILITÉ · 50 ML</span></div></div><span className="art-sparkle sparkle-one">✦</span><span className="art-sparkle sparkle-two">✧</span></div>;
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="field"><span className="field-label">{label}</span>{children}</label>
);
export const Card = ({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) => (
  <section className="panel">
    {(title || right) && <div className="panel-heading"><h2>{title}</h2>{right}</div>}
    {children}
  </section>
);
export const Stat = ({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) => (
  <div className={`stat-card ${warn ? 'stat-warning' : ''}`}>
    <div className="stat-label"><span>{label}</span><span className="stat-dot" /></div>
    <div className="stat-value">{value}</div>
  </div>
);
export const Empty = ({ text }: { text: string }) => <div className="empty-state"><span className="empty-icon"><Icon name="inbox" size={25} /></span><p>{text}</p><span>Your next chapter starts here.</span></div>;
const descriptions: Record<string, string> = {
  Dashboard: 'A clear view of your business, down to the last drop.',
  'Products & Inventory': 'Curate your collection. Keep every bottle accounted for.',
  Sales: 'Record a sale, remember your customer, and share their invoice.',
  Transactions: 'Every invoice, payment, and refund, together in one place.',
  Customers: 'Your customer directory, automatically built from recorded sales.',
  Expenses: 'Keep track of what goes into growing your business.',
  Reports: 'Find the patterns. Make your next move with confidence.',
  Settings: 'Make this workspace feel like your business.',
};
export const Page = ({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) => (
  <div className="page-content">
    <header className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>{title}</h1><p>{descriptions[title]}</p></div>{right && <div className="page-action">{right}</div>}</header>
    {children}
  </div>
);
