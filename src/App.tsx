import { useEffect, useRef, useState, type FormEvent } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { onSessionChanged, createOwner, signIn, signOut, type User } from './auth';
import { Brand, BottleArt, Icon, btn, Field, inp } from './ui';
import { ThemeToggle } from './theme';
import { useBusiness } from './business';
import { businessSocials } from '../shared/business.mjs';
import { usePwa } from './pwa';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Transactions from './pages/Transactions';
import Notifications from './Notifications';
import Customers from './pages/Customers';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function Login({ setupRequired }: { setupRequired: boolean }) {
  const { business } = useBusiness();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMsg('');
    try { await (setupRequired ? createOwner(email, password) : signIn(email, password)); }
    catch (error) { setMsg((error as Error).message || 'Unable to sign in. Please try again.'); }
    finally { setBusy(false); }
  };
  const help = () => setMsg('Use the email and password chosen when this workspace was created. If you have forgotten them, ask the workspace owner to reset your password.');
  return (
    <div className="login-layout">
      <section className="login-story">
        <Brand light />
        <div className="story-content"><div className="eyebrow">MADE FOR YOUR EVERYDAY</div><h1>A beautiful business.<br /><em>Beautifully managed.</em></h1><p>A little more clarity. A little less busywork.<br />More room for the business you love.</p><BottleArt /></div>
        <div className="story-footer"><span>Inventory. Sales. People. Possibilities.</span><span>EST. FOR YOU <Icon name="sparkle" size={15} /></span></div>
      </section>
      <main className="login-main">
        <div className="login-theme"><ThemeToggle /></div>
        <div className="mobile-brand"><Brand /></div>
        <div className="login-form-wrap">
          <span className="login-welcome"><span /> YOUR BUSINESS, IN GOOD HANDS</span>
          <h2>{setupRequired ? 'Make it yours' : 'Welcome back'}<span>.</span></h2><p className="login-description">{setupRequired ? 'Create your owner account to start your workspace.' : 'A fresh start to a well-organized day.'}<br />{setupRequired ? 'Choose an email and a password of at least 8 characters.' : 'Sign in to your workspace.'}</p>
          <form onSubmit={login} className="login-form">
            <Field label="Email address"><input className={inp} type="email" autoComplete="username" placeholder="you@yourbusiness.com" value={email} required onChange={(e) => setEmail(e.target.value)} /></Field>
            <div><div className="password-label"><label htmlFor="login-password" className="field-label">Password</label>{!setupRequired && <button type="button" disabled={busy} onClick={help}>Need help?</button>}</div><div className="password-input"><input id="login-password" className={inp} type={visible ? 'text' : 'password'} autoComplete={setupRequired ? 'new-password' : 'current-password'} minLength={setupRequired ? 8 : undefined} placeholder={setupRequired ? 'Choose a strong password' : 'Enter your password'} value={password} required onChange={(e) => setPassword(e.target.value)} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon name={visible ? 'lock' : 'eye'} size={19} /></button></div></div>
            {msg && <p className="form-notice" role="status">{msg}</p>}
            <button className={btn + ' login-submit'} disabled={busy} type="submit"><span>{busy ? 'Opening your workspace…' : setupRequired ? 'Create your workspace' : 'Sign in to workspace'}</span>{busy ? <span className="spinner" /> : <Icon name="arrow" size={19} />}</button>
          </form>
          <p className="login-security"><Icon name="lock" size={14} /> A private space for your business.</p>
        </div>
        <footer className="login-footer">A little order makes room for great things.<span>{business.name || 'Perfume Manager'} © {new Date().getFullYear()}</span></footer>
      </main>
    </div>
  );
}

const nav = [
  { to: '/', label: 'Overview', icon: 'grid' },
  { to: '/products', label: 'Products & Inventory', icon: 'bottle' },
  { to: '/sales', label: 'Sales', icon: 'bag' },
  { to: '/transactions', label: 'Transactions', icon: 'wallet' },
  { to: '/customers', label: 'Customers', icon: 'users' },
  { to: '/expenses', label: 'Expenses', icon: 'wallet' },
  { to: '/reports', label: 'Reports', icon: 'chart' },
];

export default function App() {
  const { business } = useBusiness();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [menu, setMenu] = useState(false);
  const [authError, setAuthError] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [dataError, setDataError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutPending = useRef(false);
  const { pathname } = useLocation();
  const { online } = usePwa();
  useEffect(() => onSessionChanged((session) => { setUser(session.user); setSetupRequired(session.setupRequired); setAuthError(''); }, () => setAuthError('Unable to reach your workspace. Check that the app server is running, then reload.')), []);
  useEffect(() => {
    const showError = (event: Event) => setDataError((event as CustomEvent<string>).detail);
    window.addEventListener('workspace-error', showError);
    return () => window.removeEventListener('workspace-error', showError);
  }, []);
  useEffect(() => { setMenu(false); }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const trigger = document.querySelector<HTMLButtonElement>('.topbar .mobile-menu');
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
      if (event.key !== 'Tab') return;
      const focusable = sidebar?.querySelectorAll<HTMLElement>('a, button');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      trigger?.focus();
    };
  }, [menu]);
  const logout = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setLoggingOut(true);
    try { await signOut(); setMenu(false); setDataError(''); }
    catch { setDataError('Sign out failed. Please try again.'); }
    finally { logoutPending.current = false; setLoggingOut(false); }
  };
  if (authError) return <div className="session-loading" role="alert"><Brand /><p>{online ? authError : 'You’re offline. Reconnect to open your workspace.'}</p></div>;
  if (user === undefined) return <div className="session-loading" role="status"><Brand /><span className="spinner" /><p>Opening your workspace…</p></div>;
  if (!user) return <Login setupRequired={setupRequired} />;
  const current = nav.find((item) => item.to === pathname)?.label || 'Settings';
  const link = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'nav-active' : ''}`;
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className={`sidebar ${menu ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand"><Brand /><button className="icon-button mobile-menu" onClick={() => setMenu(false)} aria-label="Close navigation"><Icon name="close" /></button></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav id="workspace-navigation" aria-label="Main navigation">{nav.map(({ to, label, icon }) => <NavLink key={to} to={to} end={to === '/'} className={link} onClick={() => setMenu(false)}><Icon name={icon} size={19} /><span>{label}</span><span className="nav-active-dot" /></NavLink>)}</nav>
        <div className="sidebar-note"><Icon name="sparkle" size={23} /><p>Small details.<br /><strong>Beautiful possibilities.</strong></p><span>Keep growing, one day at a time.</span></div>
        <div className="sidebar-bottom"><NavLink to="/settings" className={link} onClick={() => setMenu(false)}><Icon name="settings" size={19} />Settings</NavLink><button className="nav-link" disabled={loggingOut} onClick={logout}><Icon name="logout" size={19} />Sign out</button><div className="sidebar-version"><span className="sidebar-business-name">{business.name || 'Perfume Manager'}</span><span>V 1.0</span></div></div>
      </aside>
      {menu && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMenu(false)} />}
      <div className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu header-menu" aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name="menu" /></button>
          <div className="breadcrumbs"><span className="breadcrumb-root">Workspace</span><Icon name="chevron" size={13} /><strong>{current}</strong></div>
          <div className="topbar-right">
            <Notifications />
            <ThemeToggle />
            <span className="topbar-date"><Icon name="calendar" size={16} />{new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <NavLink to="/settings" className="account-chip" title={user.email || 'Account settings'}><span className="avatar">{(user.displayName || user.email || 'A').slice(0, 1).toUpperCase()}</span><span className="account-copy"><strong>{user.displayName || 'Business owner'}</strong><span>Administrator</span></span></NavLink>
            <button type="button" className="icon-button header-logout" aria-label={loggingOut ? 'Logging out' : 'Log out'} title="Log out" aria-busy={loggingOut} disabled={loggingOut} onClick={logout}><Icon name="logout" size={20} /></button>
          </div>
        </header>
        <main id="main-content" className="workspace-main">
          {dataError && <div className="form-notice workspace-notice" role="alert"><span>{dataError}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setDataError('')}><Icon name="close" size={16} /></button></div>}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="workspace-footer"><span>{businessSocials(business).join(' · ') || business.social || 'A little order. A lot of possibility.'}</span><span>{business.name || 'Perfume Manager'}</span></footer>
        </main>
      </div>
    </div>
  );
}
