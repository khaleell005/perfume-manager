import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useBusiness } from './business';
import { usePwa } from './pwa';
import { btn, btn2, Card, Icon } from './ui';

export function InstallSettings() {
  const { business } = useBusiness();
  const businessName = business.name || 'Perfume Manager';
  const { prompt, installed, install } = usePwa();
  const [error, setError] = useState('');
  return <Card title="Your workspace, one tap away"><div className="settings-action"><div><h3>{installed ? 'App installed' : `Install ${businessName}`}</h3><p>{installed ? 'You can open this workspace directly from your home screen or desktop.' : 'Give your workspace a home on your phone or desktop.'}</p></div>{prompt && !installed && <button className={btn} onClick={() => { setError(''); install().catch(() => setError('Installation could not start. Try the install option in your browser menu.')); }}><Icon name="download" size={16} />Install app</button>}{installed && <span className="status-badge status-paid"><Icon name="check" size={14} />Installed</span>}</div>{!installed && !prompt && <p className="section-description">On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen. On supported desktop or Android browsers, use the browser menu’s Install app or Add to Home Screen option when available.</p>}<p className="pwa-help">Your workspace server must be available to sign in, load records, and save changes.</p>{error && <p className="form-notice" role="status">{error}</p>}</Card>;
}

export function PwaStatus() {
  const { online } = usePwa();
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  const [error, setError] = useState('');
  if (!online) return <div className="connection-notice" role="status"><Icon name="offline" size={16} /><span>You’re offline. Reconnect to load or save workspace records.</span></div>;
  if (!needRefresh) return null;
  return <aside className="pwa-update" role="status"><div><strong>A fresh version is ready</strong><p>Save your work before reloading the app.</p>{error && <p>{error}</p>}</div><div className="modal-actions"><button className={btn2} onClick={() => setNeedRefresh(false)}>Later</button><button className={btn} onClick={() => {
    if (document.querySelector('dialog[open]')) { setError('Close your entry form before updating.'); return; }
    updateServiceWorker(true).catch(() => setError('Unable to update right now. Please try again.'));
  }}>Update app</button></div></aside>;
}
