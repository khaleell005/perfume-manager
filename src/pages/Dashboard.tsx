import { Link } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ngn, sum, useCol } from '../lib';
import type { Expense, Product, Sale } from '../types';
import { Card, Empty, Icon, Page, Stat, btn, btn2 } from '../ui';

export default function Dashboard({ name }: { name: string }) {
  const { data: sales } = useCol<Sale>('sales');
  const { data: exp } = useCol<Expense>('expenses');
  const { data: prods } = useCol<Product>('products');
  const live = sales.filter((s) => !s.cancelled);
  const t0 = new Date().setHours(0, 0, 0, 0);
  const revenue = sum(live.map((s) => s.total - (s.refunded || 0)));
  const expenses = sum(exp.map((e) => e.amount));
  const active = prods.filter((p) => !p.archived);
  const low = active.filter((p) => p.tracked && p.quantity <= p.threshold);
  const chart = Array.from({ length: 7 }, (_, i) => {
    const d = t0 - (6 - i) * 864e5;
    return { day: new Date(d).toLocaleDateString('en', { weekday: 'short' }), total: sum(live.filter((s) => s.createdAt >= d && s.createdAt < d + 864e5).map((s) => s.total - (s.refunded || 0))) };
  });
  const tally: Record<string, number> = {};
  live.forEach((s) => s.items.forEach((i) => { tally[i.name] = (tally[i.name] || 0) + i.qty; }));
  const best = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const owed = sum(live.map((s) => s.total - s.paid));
  return (
    <Page title="Dashboard">
      <section className="dashboard-banner"><div><div className="eyebrow">A MOMENT TO TAKE STOCK</div><h2>{name.trim() ? `Welcome, ${name.trim()}.` : 'Welcome back.'}</h2><p>Every sale, every bottle, every little milestone.<br />Here’s how things are coming together.</p></div><Icon name="bottle" /></section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Total revenue" value={ngn(revenue)} />
        <Stat label="Today's sales" value={ngn(sum(live.filter((s) => s.createdAt >= t0).map((s) => s.total - (s.refunded || 0))))} />
        <Stat label="Total expenses" value={ngn(expenses)} />
        <Stat label="Estimated net profit" value={ngn(revenue - expenses)} />
        <Stat label="Products" value={active.length} />
        <Stat label="Low stock" value={low.length} warn={low.length > 0} />
      </div>
      <div className="dashboard-quick-actions">
        <Link className={btn} to="/sales?new=1"><Icon name="plus" size={15} />Record sale</Link>
        <Link className={btn2} to="/products"><Icon name="bottle" size={15} />Manage products</Link>
        <Link className={btn2} to="/expenses"><Icon name="wallet" size={15} />Add expense</Link>
      </div>
      <Card title="Sales performance" right={<span className="chart-meta">LAST 7 DAYS</span>}>
        <div className="h-60"><ResponsiveContainer><BarChart data={chart} margin={{ top: 10, right: 5, bottom: 0, left: 0 }}><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--chart-label)' }} dy={8} /><YAxis width={52} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--chart-label)' }} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : String(v)} /><Tooltip cursor={{ fill: 'var(--chart-cursor)' }} contentStyle={{ border: '1px solid var(--chart-line)', background: 'var(--ui-surface)', color: 'var(--ui-text)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [ngn(Number(v)), 'Sales']} /><Bar dataKey="total" fill="#876276" radius={[5, 5, 0, 0]} maxBarSize={35} /></BarChart></ResponsiveContainer></div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Recent sales" right={<Link to="/transactions">View all <Icon name="arrow" size={13} /></Link>}>
          {live.length === 0 ? <Empty text="No sales yet." /> : [...live].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5).map((s) => (
            <div key={s.id} className="flex justify-between border-b border-stone-100 py-2 text-sm"><span>{s.invoiceNo} · {s.customerName || 'Walk-in'}</span><span>{ngn(s.total)}</span></div>
          ))}
        </Card>
        <Card title="Best sellers">
          {best.length === 0 ? <Empty text="Nothing yet." /> : best.map(([n, q]) => <div key={n} className="flex justify-between border-b border-stone-100 py-2 text-sm"><span>{n}</span><span>{q} sold</span></div>)}
        </Card>
        <Card title="A little heads-up">
          {low.length === 0 && owed <= 0 && <Empty text="Everything is looking good." />}
          {low.map((p) => <div key={p.id} className="py-1 text-sm text-red-600">{p.quantity === 0 ? 'Out of stock' : 'Low stock'}: {p.name} ({p.quantity} left)</div>)}
          {owed > 0 && <div className="py-1 text-sm text-amber-700">Outstanding customer payments: {ngn(owed)}</div>}
        </Card>
      </div>
    </Page>
  );
}
