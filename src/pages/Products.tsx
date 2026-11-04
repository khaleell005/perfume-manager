import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBusiness } from '../business';
import { changeStock as saveStockChange, createRecord, updateRecord } from '../api';
import { num, useCol, ngn, runAction } from '../lib';
import type { Product } from '../types';
import { Card, Empty, Field, Modal, Page, Stat, btn, btn2, inp } from '../ui';

const blank: Product = { name: '', category: '', description: '', size: 50, price: 0, cost: 0, tracked: true, quantity: 0, threshold: 5, available: true, archived: false, createdAt: 0, updatedAt: 0 };
type Row = Product & { id: string };

export default function Products() {
  const { business, loading: businessLoading } = useBusiness();
  const { data, reload } = useCol<Product>('products');
  const moves = useCol<{ name: string; change: number; type: string; at: number }>('stockMovements');
  const [form, setForm] = useState<Product | null>(null);
  const [editId, setEditId] = useState('');
  const [params] = useSearchParams();
  const search = params.get('search') || '';
  const [q, setQ] = useState(search);
  const [filter, setFilter] = useState('all');
  const [showArch, setShowArch] = useState(false);
  useEffect(() => { setQ(search); setFilter('all'); setShowArch(false); }, [search]);
  const [err, setErr] = useState('');
  const [stock, setStock] = useState<{ product: Row; mode: 'restock' | 'adjust' } | null>(null);
  const [stockAmount, setStockAmount] = useState('');

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || form.price < 0 || form.quantity < 0) return setErr('Enter a name and valid price/quantity.');
    const now = Date.now();
    const clean = { ...form, tracked: true, available: true, updatedAt: now };
    if (editId) await updateRecord('products', editId, clean);
    else await createRecord('products', { ...clean, createdAt: now });
    setForm(null); setEditId(''); setErr(''); reload();
  };

  const changeStock = async () => {
    if (!stock) return;
    const amount = Number(stockAmount);
    if (!stockAmount.trim() || !Number.isInteger(amount) || amount < (stock.mode === 'restock' ? 1 : 0)) throw new Error('Enter a valid whole-number quantity.');
    await saveStockChange(stock.product.id, stock.mode, amount);
    setStock(null);
    await Promise.all([reload(), moves.reload()]);
  };
  const openStock = (product: Row, mode: 'restock' | 'adjust') => {
    setStockAmount(mode === 'adjust' ? String(product.quantity) : '');
    setStock({ product, mode });
  };

  const archive = async (p: Row) => { await updateRecord('products', p.id, { archived: !p.archived, updatedAt: Date.now() }); reload(); };

  const rows = data.filter((p) => p.archived === showArch && p.name.toLowerCase().includes(q.toLowerCase()) &&
    (filter === 'all' || (filter === 'low' && p.quantity > 0 && p.quantity <= p.threshold) || (filter === 'out' && p.quantity === 0)));
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <Page title="Products & Inventory" right={<button className={btn} disabled={businessLoading} onClick={() => { setForm({ ...blank, threshold: business.threshold }); setEditId(''); setErr(''); }}>Add product</button>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3"><Stat label="Active products" value={data.filter((p) => !p.archived).length} /><Stat label="Units in stock" value={data.filter((p) => !p.archived).reduce((n, p) => n + p.quantity, 0)} /><Stat label="Needs attention" value={data.filter((p) => !p.archived && p.quantity <= p.threshold).length} warn /></div>
      {form && (
        <Modal title={editId ? 'Edit product' : 'Add product'} description="Keep the details of every bottle in one place." onClose={() => setForm(null)} onSubmit={save} error={err} submitLabel={editId ? 'Save changes' : 'Save product'}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Name"><input className={inp} required placeholder="e.g. Love Struck" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Category"><input className={inp} value={form.category} onChange={(e) => set('category', e.target.value)} /></Field>
            <Field label="Size (ml)"><input className={inp} type="number" min="0.01" step="any" required value={form.size} onChange={(e) => set('size', num(e.target.value))} /></Field>
            <Field label="Selling price (₦)"><input className={inp} type="number" min="0" step="any" value={form.price} onChange={(e) => set('price', num(e.target.value))} /></Field>
            <Field label="Quantity"><input className={inp} type="number" min="0" step="1" required value={form.quantity} onChange={(e) => set('quantity', num(e.target.value))} /></Field>
            <Field label="Low-stock threshold"><input className={inp} type="number" min="0" step="1" value={form.threshold} onChange={(e) => set('threshold', num(e.target.value))} /></Field>
          </div>
        </Modal>
      )}
      {stock && <Modal compact title={stock.mode === 'restock' ? 'Restock product' : 'Adjust stock'} description={`${stock.product.name} · ${stock.product.quantity} currently in stock`} onClose={() => setStock(null)} onSubmit={changeStock} submitLabel={stock.mode === 'restock' ? 'Save restock' : 'Save adjustment'}>
        <Field label={stock.mode === 'restock' ? 'Units to add' : 'Correct stock quantity'}><input className={inp} type="number" min={stock.mode === 'restock' ? 1 : 0} step="1" required value={stockAmount} onChange={(event) => setStockAmount(event.target.value)} /></Field>
      </Modal>}
      <div className="filter-bar">
        <input className={inp + ' max-w-xs'} aria-label="Search products" placeholder="Search your collection…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inp + ' max-w-[10rem]'} aria-label="Filter by stock status" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All stock levels</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
        <button className={btn2} onClick={() => setShowArch(!showArch)}>{showArch ? 'Show active' : 'Show archived'}</button>
      </div>
      <Card title={showArch ? 'Archived collection' : 'Your collection'} right={<div className="collection-meta"><span>{rows.length}</span> products</div>}>
        {rows.length === 0 ? <Empty text="No products found." /> : rows.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 py-3 text-sm">
            <div>
              <div className="font-medium">{p.name} <span className="text-stone-500">{p.size}ml</span></div>
              <div className="text-stone-500">{ngn(p.price)} · {p.quantity === 0 ? <b className="text-red-600">Out of stock</b> : <span className={p.quantity <= p.threshold ? 'text-red-600' : ''}>{p.quantity} in stock</span>}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              <button className={btn2} onClick={() => openStock(p, 'restock')}>Restock</button>
              <button className={btn2} onClick={() => openStock(p, 'adjust')}>Adjust</button>
              <button className={btn2} onClick={() => { setForm({ ...p }); setEditId(p.id); setErr(''); }}>Edit</button>
              <button className={btn2} onClick={() => void runAction(() => archive(p))}>{p.archived ? 'Restore' : 'Archive'}</button>
            </div>
          </div>
        ))}
      </Card>
      <Card title="Stock movement history">
        {moves.data.length === 0 ? <Empty text="No movements yet." /> : [...moves.data].sort((a, b) => b.at - a.at).slice(0, 30).map((m) => (
          <div key={m.at + m.name} className="flex justify-between border-b border-stone-100 py-1.5 text-sm"><span>{m.name} · {m.type}</span><span className={m.change < 0 ? 'text-red-600' : 'text-green-700'}>{m.change > 0 ? '+' : ''}{m.change}</span></div>
        ))}
      </Card>
    </Page>
  );
}
