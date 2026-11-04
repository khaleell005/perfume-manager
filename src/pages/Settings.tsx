import { useEffect, useState } from 'react';
import { getBackup } from '../api';
import { useBusiness } from '../business';
import { changePassword } from '../auth';
import { ThemeSettings } from '../theme';
import { InstallSettings } from '../PwaControls';
import { emptyBiz, num, runAction } from '../lib';
import type { Biz } from '../types';
import { Card, Field, Page, btn, btn2, inp } from '../ui';

function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(1, 240 / Math.max(image.width, image.height));
        canvas.width = image.width * ratio; canvas.height = image.height * ratio;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Unable to process this logo. Try another image.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) { reject(error); }
      finally { URL.revokeObjectURL(url); }
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to read this logo. Choose a valid image.')); };
    image.src = url;
  });
}

export default function Settings() {
  const { business, loading, save: saveBusiness } = useBusiness();
  const [b, setB] = useState<Biz>(emptyBiz);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  useEffect(() => { if (!dirty) setB(business); }, [business, dirty]);
  const edit = (next: Biz) => { setB(next); setDirty(true); setMsg(''); };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { const saved = await saveBusiness(b); setB(saved); setDirty(false); setMsg('Saved everywhere.'); }
    finally { setSaving(false); }
  };
  const backup = async () => {
    const out = await getBackup();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const text = (k: keyof Biz, label: string, placeholder?: string) => <Field label={label}><input className={inp} placeholder={placeholder} value={String(b[k])} onChange={(e) => edit({ ...b, [k]: e.target.value })} /></Field>;
  return (
    <Page title="Settings">
      <Card title="Appearance"><p className="section-description">Choose a look for your workspace. Your preference is saved on this device.</p><ThemeSettings /></Card>
      <InstallSettings />
      <Card title="Business information">
        <p className="section-description">The details that make your business yours. Saving updates your workspace branding, invoice previews, PDFs, printing, and sharing.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {text('name', 'Business name')}{text('phone', 'Phone number')}{text('email', 'Business email')}{text('address', 'Address')}
          <Field label="Default low-stock threshold"><input className={inp} type="number" min="0" step="1" value={b.threshold} onChange={(e) => edit({ ...b, threshold: num(e.target.value) })} /></Field>
          <Field label="Currency"><input className={inp} value="Nigerian Naira (NGN)" disabled /></Field>
        </div>
        <h3 className="text-sm font-medium mt-5">Social accounts</h3>
        <p className="section-description mt-2">Add the accounts customers can reach you on. Filled details appear on your invoices.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {text('instagram', 'Instagram username', '@yourbusiness')}{text('tiktok', 'TikTok username', '@yourbusiness')}{text('whatsapp', 'WhatsApp number', '+234…')}
        </div>
        <div className="mt-3"><Field label="Invoice thank-you message"><input className={inp} value={b.thanks} onChange={(e) => edit({ ...b, thanks: e.target.value })} /></Field></div>
        <div className="mt-3 flex items-center gap-3">
          {b.logo && <img src={b.logo} alt="Logo" className="h-14 w-14 rounded object-contain" />}
          {b.logo && <button type="button" className={btn2} onClick={() => edit({ ...b, logo: '' })}>Remove logo</button>}
          <Field label="Business logo"><input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void runAction(async () => { const logo = await shrink(file); setB(current => ({ ...current, logo })); setDirty(true); setMsg(''); }); }} /></Field>
        </div>
        <div className="mt-3 flex items-center gap-3"><button className={btn} disabled={loading || saving} onClick={() => void runAction(save)}>{saving ? 'Saving…' : 'Save settings'}</button><span className="text-sm text-green-700">{msg}</span></div>
      </Card>
      <Card title="Account & data">
        <form onSubmit={async (event) => {
          event.preventDefault();
          if (changing) return;
          setChanging(true); setPasswordMessage('');
          try { await changePassword(currentPassword, password); setCurrentPassword(''); setPassword(''); setPasswordMessage('Password updated.'); }
          catch (error) { setPasswordMessage((error as Error).message); }
          finally { setChanging(false); }
        }}>
          <h3 className="text-sm font-medium">Change your password</h3>
          <p className="section-description mt-2">Choose a strong password to keep your workspace private.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Current password"><input className={inp} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></Field>
            <Field label="New password"><input className={inp} type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="At least 8 characters" /></Field>
          </div>
          {passwordMessage && <p role="status" className="form-notice mt-3">{passwordMessage}</p>}
          <button className={btn2 + ' mt-4 mb-4'} type="submit" disabled={changing}>{changing ? 'Updating…' : 'Update password'}</button>
        </form>
        <div className="settings-action"><div><h3>A copy for safekeeping</h3><p>Export all your business records as a JSON backup.</p></div><button className={btn2} onClick={() => void runAction(backup)}>Download backup</button></div>
        {msg && <p role="status" className="mt-4 text-sm text-green-700">{msg}</p>}
      </Card>
    </Page>
  );
}
