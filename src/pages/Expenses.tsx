import { useState } from 'react';
import { createRecord, deleteExpense } from '../api';
import { ngn, num, sum, useCol, runAction } from '../lib';
import { CATEGORIES, type Expense } from '../types';
import { Card, Empty, Field, Modal, Page, Stat, btn, btn2, inp } from '../ui';

const today = () => new Date().toISOString().slice(0, 10);

export default function Expenses() {
  const { data, reload } = useCol<Expense>('expenses');
  const [f, setF] = useState<Expense>({ title: '', category: CATEGORIES[0], amount: 0, date: today(), description: '' });
  const [cat, setCat] = useState('');
  const [month, setMonth] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const add = async () => {
    if (!f.title.trim() || f.amount <= 0) return setErr('Enter a title and an amount above zero.');
    await createRecord('expenses', f);
    setF({ ...f, title: '', amount: 0, description: '' }); setErr(''); setOpen(false); reload();
  };
  const del = async (id: string) => { if (confirm('Delete this expense?')) { await deleteExpense(id); reload(); } };
  const rows = data.filter((e) => (!cat || e.category === cat) && (!month || e.date.startsWith(month))).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Page title="Expenses" right={<button className={btn} onClick={() => { setF({ title: '', category: CATEGORIES[0], amount: 0, date: today(), description: '' }); setErr(''); setOpen(true); }}>Add expense</button>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3"><Stat label="Total expenses" value={ngn(sum(data.map((e) => e.amount)))} /><Stat label="This month" value={ngn(sum(data.filter((e) => e.date.startsWith(today().slice(0, 7))).map((e) => e.amount)))} /><Stat label="Recorded expenses" value={data.length} /></div>
      {open && <Modal title="Record expense" description="Keep a clear record of what goes into your business." onClose={() => setOpen(false)} onSubmit={add} error={err} submitLabel="Save expense">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Title"><input className={inp} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Category"><select className={inp} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Amount (₦)"><input className={inp} type="number" required min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: num(e.target.value) })} /></Field>
          <Field label="Date"><input className={inp} type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <div className="mt-3"><Field label="Description (optional)"><input className={inp} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
      </Modal>}
      <div className="filter-bar">
        <select className={inp + ' max-w-xs'} aria-label="Filter expenses by category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <input className={inp + ' max-w-[11rem]'} aria-label="Filter expenses by month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <Card title="Expense history" right={<span className="collection-meta">Total: {ngn(sum(rows.map((e) => e.amount)))}</span>}>
        {rows.length === 0 ? <Empty text="No expenses recorded." /> : rows.map((e) => (
          <div key={e.id} className="flex items-center justify-between border-b border-stone-100 py-2 text-sm">
            <div><div className="font-medium">{e.title}</div><div className="text-stone-500">{e.category} · {e.date}</div></div>
            <div className="flex items-center gap-2"><span>{ngn(e.amount)}</span><button className={btn2} onClick={() => void runAction(() => del(e.id))}>Delete</button></div>
          </div>
        ))}
      </Card>
    </Page>
  );
}
