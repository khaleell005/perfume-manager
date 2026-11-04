import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui';

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent('workspace-success', { detail: message }));
}

export function Toaster() {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const sequence = useRef(0);
  useEffect(() => {
    popup.current?.setAttribute('popover', 'manual');
    const show = (event: Event) => {
      clearTimeout(timer.current);
      setToast({ message: (event as CustomEvent<string>).detail, id: ++sequence.current });
      timer.current = setTimeout(() => setToast(null), 2000);
    };
    window.addEventListener('workspace-success', show);
    return () => { window.removeEventListener('workspace-success', show); clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (toast) popup.current?.showPopover?.();
    else popup.current?.hidePopover?.();
  }, [toast]);
  return <div ref={popup} className={`success-toast${toast ? ' toast-visible' : ''}`} role="status" aria-live="polite" aria-atomic="true">
    <span className="toast-symbol" aria-hidden="true"><span className="toast-check"><Icon name="check" size={14} /></span></span>
    <div className="toast-copy"><strong>Success</strong><p>{toast?.message}</p></div>
    <button className="toast-dismiss" type="button" aria-label="Dismiss notification" onClick={() => { clearTimeout(timer.current); setToast(null); }}><Icon name="close" size={18} /></button>
  </div>;
}
