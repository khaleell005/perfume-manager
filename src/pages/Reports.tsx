import { useState } from 'react';
import { downloadCsv, ngn, sum, useCol } from '../lib';
import type { Expense, Product, Sale } from '../types';
import { Card, Empty, Field, Page, Stat, btn2, inp } from '../ui';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Reports() {
  const { data: sales } = useCol<Sale>('sales');
  const { data: exp } = useCol<Expense>('expenses');
  const { data: prods } = useCol<Product>('products');
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const preset = (days: number) => { setFrom(iso(new Date(Date.now() - (days - 1) * 864e5))); setTo(iso(new Date())); };
  const a = new Date(from).getTime(), b = new Date(to).getTime() + 864e5;
  const s = sales.filter((x) => !x.cancelled && x.createdAt >= a && x.createdAt < b);
  const e = exp.filter((x) => x.date >= from && x.date <= to);
  const revenue = sum(s.map((x) => x.total - (x.refunded || 0)));
  const allInRange = sales.filter((x) => x.createdAt >= a && x.createdAt < b);
  const byCat: Record<string, number> = {};
  e.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const tally: Record<string, number> = {};
  s.forEach((x) => x.items.forEach((i) => { tally[i.name] = (tally[i.name] || 0) + i.qty; }));
  const tracked = prods.filter((p) => !p.archived && p.tracked);
  return (
    <Page title="Reports">
      <div className="filter-bar report-range">
        <Field label="From"><input className={inp + ' max-w-[11rem]'} type="date" value={from} onChange={(x) => setFrom(x.target.value)} /></Field>
        <Field label="To"><input className={inp + ' max-w-[11rem]'} type="date" value={to} onChange={(x) => setTo(x.target.value)} /></Field>
        <button className={btn2} onClick={() => preset(1)}>Today</button>
        <button className={btn2} onClick={() => preset(7)}>7 days</button>
        <button className={btn2} onClick={() => preset(30)}>30 days</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Net sales value" value={ngn(revenue)} />
        <Stat label="Payments received" value={ngn(sum(allInRange.map((x) => x.paid - (x.refunded || 0))))} />
        <Stat label="Outstanding balance" value={ngn(sum(s.map((x) => x.total - x.paid)))} />
        <Stat label="Transactions" value={s.length} />
        <Stat label="Expenses" value={ngn(sum(e.map((x) => x.amount)))} />
        <Stat label="Estimated net profit" value={ngn(revenue - sum(e.map((x) => x.amount)))} />
      </div>
      <p className="text-xs text-stone-500">Net sales account for completed refunds on the selected sales. Profit is an estimate: ingredients are recorded as expenses.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Expenses by category">{Object.keys(byCat).length === 0 ? <Empty text="No expenses in range." /> : Object.entries(byCat).map(([k, v]) => <div key={k} className="flex justify-between border-b border-stone-100 py-1.5 text-sm"><span>{k}</span><span>{ngn(v)}</span></div>)}</Card>
        <Card title="Best-selling products">{Object.keys(tally).length === 0 ? <Empty text="No sales in range." /> : Object.entries(tally).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => <div key={k} className="flex justify-between border-b border-stone-100 py-1.5 text-sm"><span>{k}</span><span>{v}</span></div>)}</Card>
        <Card title="Inventory">
          <div className="text-sm">Low stock: {tracked.filter((p) => p.quantity > 0 && p.quantity <= p.threshold).length} · Out of stock: {tracked.filter((p) => p.quantity === 0).length}</div>
        </Card>
        <Card title="Take your numbers with you">
          <p className="section-description">Download a CSV of your full sales, expenses, or inventory records.</p>
          <div className="flex flex-wrap gap-2">
            <button className={btn2} onClick={() => downloadCsv('sales', [['Invoice', 'Date', 'Customer', 'Total', 'Paid', 'Refunded', 'Status', 'Method'], ...sales.map((x) => [x.invoiceNo, new Date(x.createdAt).toISOString().slice(0, 10), x.customerName || '', x.total, x.paid, x.refunded || 0, x.cancelled ? 'cancelled' : x.status, x.method])])}>Sales</button>
            <button className={btn2} onClick={() => downloadCsv('expenses', [['Title', 'Category', 'Amount', 'Date'], ...exp.map((x) => [x.title, x.category, x.amount, x.date])])}>Expenses</button>
            <button className={btn2} onClick={() => downloadCsv('inventory', [['Name', 'Size', 'Price', 'Quantity', 'Threshold'], ...prods.map((p) => [p.name, p.size, p.price, p.tracked ? p.quantity : 'n/a', p.threshold])])}>Inventory</button>
          </div>
        </Card>
      </div>
    </Page>
  );
}
