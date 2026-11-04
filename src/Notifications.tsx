import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { listRecords } from './api';
import { ngn } from './lib';
import type { Product, Sale } from './types';
import { Icon, btn2 } from './ui';
interface AlertItem { id: string; title: string; detail: string; to: string; icon: string }

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const version = useRef(0);
  const id = useId();
  const { pathname, search } = useLocation();
  const refresh = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    try {
      const [products, sales] = await Promise.all([listRecords<Product>('products'), listRecords<Sale>('sales')]);
      if (current !== version.current) return;
      const stock: AlertItem[] = products.filter(product => !product.archived && product.tracked !== false && product.quantity <= product.threshold).sort((a, b) => a.quantity - b.quantity).map(product => ({ id: `stock-${product.id}`, title: product.quantity === 0 ? 'Out of stock' : 'Low stock', detail: `${product.name} · ${product.quantity} remaining`, to: `/products?search=${encodeURIComponent(product.name)}`, icon: 'bottle' }));
      const unpaid: AlertItem[] = sales.filter(sale => !sale.cancelled && sale.total > sale.paid).sort((a, b) => a.createdAt - b.createdAt).map(sale => ({ id: `payment-${sale.id}`, title: `Payment outstanding · ${sale.invoiceNo}`, detail: `${ngn(sale.total - sale.paid)} · ${sale.customerName || 'Walk-in customer'}`, to: `/transactions?invoice=${encodeURIComponent(sale.invoiceNo)}`, icon: 'bag' }));
      setAlerts([...stock, ...unpaid]); setError('');
    } catch { if (current === version.current) setError('Unable to load notifications. Please try again.'); }
    finally { if (current === version.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener('workspace-data-changed', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => { version.current++; window.removeEventListener('workspace-data-changed', refresh); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [refresh]);
  useEffect(() => { setOpen(false); }, [pathname, search]);
  useEffect(() => {
    if (!open) return;
    void refresh();
    panel.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, refresh]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <div className="notifications" ref={root} onKeyDown={event => { if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className="icon-button notification-trigger" title="Notifications" aria-label={`Notifications${!error && alerts.length ? `, ${alerts.length} alerts` : ''}`} aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={() => setOpen(value => !value)}><Icon name="bell" size={20} />{!error && alerts.length > 0 && <span className="notification-count" aria-hidden="true">{alerts.length > 99 ? '99+' : alerts.length}</span>}</button>
    {open && <div className="notification-panel" ref={panel} id={id} role="dialog" aria-label="Notifications" tabIndex={-1}>
      <header className="notification-heading"><div><h2>Notifications</h2><p>{loading ? 'Checking your workspace…' : error ? 'Please retry' : alerts.length ? `${alerts.length} ${alerts.length === 1 ? 'item needs' : 'items need'} attention` : 'Everything is looking good'}</p></div><button type="button" className="icon-button" aria-label="Close notifications" onClick={close}><Icon name="close" size={18} /></button></header>
      {error ? <div className="notification-empty" role="status"><p>{error}</p><button type="button" className={btn2} onClick={() => void refresh()}>Retry</button></div> : !alerts.length ? <div className="notification-empty" role="status"><Icon name={loading ? 'bell' : 'check'} size={28} /><p>{loading ? 'Loading notifications…' : 'You’re all caught up.'}</p>{!loading && <span>Stock and payment alerts will appear here.</span>}</div> : <ul className="notification-list">{alerts.map(alert => <li key={alert.id}><Link to={alert.to} onClick={() => setOpen(false)}><span className="notification-symbol"><Icon name={alert.icon} size={19} /></span><div><strong>{alert.title}</strong><p>{alert.detail}</p></div><Icon name="chevron" size={14} /></Link></li>)}</ul>}
    </div>}
  </div>;
}
