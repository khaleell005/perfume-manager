import { showToast } from '../Toast';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createSale } from '../api';
import Autocomplete from '../Autocomplete';
import { InvoiceActions } from '../InvoicePanel';
import { ngn, num, sum, useCol } from '../lib';
import type { Customer, PayStatus, Product, Sale, SaleItem } from '../types';
import { Card, Empty, Field, Modal, Page, Stat, btn, btn2, inp } from '../ui';

type Draft = { productId?: string; name: string; size: string; qty: string; price: string };
const emptyDraft = (): Draft => ({ name: '', size: '', qty: '1', price: '' });
const emptyCustomer = () => ({ cid: '', name: '', phone: '', email: '', address: '', discount: 0, delivery: 0, method: 'Cash', status: 'paid' as PayStatus, paid: 0 });

export default function Sales() {
  const sales = useCol<Sale>('sales');
  const products = useCol<Product>('products');
  const customers = useCol<Customer>('customers');
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [itemError, setItemError] = useState('');
  const [latest, setLatest] = useState<(Sale & { id: string }) | null>(null);
  useEffect(() => { if (params.get('new') === '1') setOpen(true); }, [params]);
  const inventory = products.data.filter(product => !product.archived);
  const live = sales.data.filter(sale => !sale.cancelled);
  const draftTotal = draft.name.trim() ? num(draft.qty) * num(draft.price) : 0;
  const subtotal = sum(items.map(item => item.qty * item.price)) + draftTotal;
  const total = Math.max(0, subtotal - customer.discount + customer.delivery);
  const closeSale = () => {
    setOpen(false); setItems([]); setDraft(emptyDraft()); setCustomer(emptyCustomer()); setItemError('');
    const next = new URLSearchParams(params); next.delete('new'); setParams(next, { replace: true });
  };
  const draftItem = (): SaleItem => {
    const size = Number(draft.size), qty = Number(draft.qty), price = Number(draft.price);
    if (!draft.name.trim() || !draft.size.trim() || !Number.isFinite(size) || size <= 0 || !Number.isInteger(qty) || qty <= 0 || !draft.price.trim() || !Number.isFinite(price) || price < 0) throw new Error('Enter a perfume name, size in ml, quantity, and selling price.');
    return { ...(draft.productId ? { productId: draft.productId } : {}), name: draft.name.trim(), size, qty, price };
  };
  const addAnother = () => {
    try { const item = draftItem(); setItems(current => [...current, item]); setDraft(emptyDraft()); setItemError(''); }
    catch (error) { setItemError((error as Error).message); }
  };
  const submit = async () => {
    if (!customer.name.trim()) throw new Error('Enter the customer’s name.');
    const allItems = draft.name.trim() ? [...items, draftItem()] : items;
    if (!allItems.length) throw new Error('Enter at least one perfume.');
    const sale = await createSale(allItems, customer);
    setLatest(sale); closeSale(); showToast('Sale recorded successfully');
    await Promise.all([sales.reload(), products.reload(), customers.reload()]);
  };
  const selectProduct = (id: string) => {
    const product = inventory.find(row => row.id === id)!;
    setDraft({ productId: id, name: product.name, size: String(product.size), qty: '1', price: String(product.price) }); setItemError('');
  };
  const selectCustomer = (id: string) => {
    const found = customers.data.find(row => row.id === id)!;
    setCustomer(current => ({ ...current, cid: id, name: found.name, phone: found.phone || '', email: found.email || '', address: found.address || '' }));
  };
  return <Page title="Sales" right={<button className={btn} onClick={() => setOpen(true)}>New sale</button>}>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3"><Stat label="Sales recorded" value={live.length} /><Stat label="Net payments received" value={ngn(sum(sales.data.map(sale => sale.paid - (sale.refunded || 0))))} /><Stat label="Awaiting payment" value={ngn(sum(live.map(sale => sale.total - sale.paid)))} /></div>
    {latest && <Card title={`Sale recorded · ${latest.invoiceNo}`} right={<span className="status-badge status-paid">Saved</span>}><p className="section-description">{latest.customerName} · {ngn(latest.total)}. Your customer details are saved for next time.</p><InvoiceActions sale={latest} /><Link className={btn2 + ' mt-4'} to={`/transactions?invoice=${latest.invoiceNo}`}>View transaction</Link></Card>}
    <Card title="Ready for your next sale?"><p className="section-description">Type the customer and perfume names. Choose a suggestion to fill in known details, or enter a new perfume manually.</p><button className={btn} onClick={() => setOpen(true)}>Record a sale</button><Link className={btn2 + ' ml-2'} to="/transactions">Transaction history</Link></Card>
    <Card title="Latest invoices" right={<Link to="/transactions">View all transactions</Link>}>{sales.data.length === 0 ? <Empty text="No sales recorded yet." /> : [...sales.data].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5).map(sale => <div key={sale.id} className="transaction-row"><div><strong>{sale.invoiceNo}</strong><p>{sale.customerName || 'Walk-in'} · {new Date(sale.createdAt).toLocaleDateString()}</p></div><span>{ngn(sale.total)}</span><Link className={btn2} to={`/transactions?invoice=${sale.invoiceNo}`}>View invoice</Link></div>)}</Card>
    {open && <Modal title="Record a sale" description="Type the names. We’ll help fill in the rest." onClose={closeSale} onSubmit={submit} submitLabel="Save sale & create invoice" footer={<span className="modal-total">Total <b>{ngn(total)}</b></span>}>
      <h3 className="entry-section-title">Customer details</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <Autocomplete label="Customer name" placeholder="Start typing a name…" required value={customer.name} onChange={name => setCustomer(current => ({ ...current, name, ...(current.cid ? { cid: '', phone: '', email: '', address: '' } : {}) }))} options={customers.data.map(row => ({ id: row.id, label: row.name, detail: [row.phone, row.email].filter(Boolean).join(' · ') }))} onSelect={selectCustomer} />
        <Field label="Phone (optional)"><input className={inp} type="tel" value={customer.phone} onChange={event => setCustomer({ ...customer, phone: event.target.value })} /></Field>
      </div>
      <details className="entry-more"><summary>Email & address (optional)</summary><div className="grid gap-3 md:grid-cols-2 mt-3"><Field label="Email"><input className={inp} type="email" value={customer.email} onChange={event => setCustomer({ ...customer, email: event.target.value })} /></Field><Field label="Address"><input className={inp} value={customer.address} onChange={event => setCustomer({ ...customer, address: event.target.value })} /></Field></div></details>
      <h3 className="entry-section-title">Perfumes</h3>
      {items.map((item, index) => <div className="sale-line" key={index}><div><strong>{item.name}</strong><p>{item.size} ml · {item.qty} × {ngn(item.price)}</p></div><b>{ngn(item.qty * item.price)}</b><button type="button" className={btn2} aria-label={`Remove ${item.name}`} onClick={() => setItems(current => current.filter((_, at) => at !== index))}>Remove</button></div>)}
      <Autocomplete label="Perfume name" placeholder="Search inventory or type a new perfume…" required={!items.length} value={draft.name} onChange={name => { setDraft(current => ({ ...current, name, ...(current.productId ? { productId: undefined, size: '', price: '' } : {}) })); setItemError(''); }} options={inventory.map(product => ({ id: product.id, label: product.name, detail: `${product.size} ml · ${ngn(product.price)} · ${product.quantity} in stock` }))} onSelect={selectProduct} />
      {draft.name && <p className="entry-hint">{draft.productId ? 'Linked to inventory. Stock is deducted when you save the sale.' : 'Manual perfume entry. This item won’t change inventory stock.'}</p>}
      <div className="grid gap-3 md:grid-cols-3 mt-3">
        <Field label="Size (ml)"><input className={inp} type="number" min="0.01" step="any" required={!items.length || !!draft.name.trim()} value={draft.size} onChange={event => setDraft({ ...draft, size: event.target.value, ...(draft.productId ? { productId: undefined } : {}) })} /></Field>
        <Field label="Quantity"><input className={inp} type="number" min="1" step="1" required={!items.length || !!draft.name.trim()} value={draft.qty} onChange={event => setDraft({ ...draft, qty: event.target.value })} /></Field>
        <Field label="Selling price (₦)"><input className={inp} type="number" min="0" step="0.01" required={!items.length || !!draft.name.trim()} value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} /></Field>
      </div>
      {itemError && <p className="form-notice mt-3" role="alert">{itemError}</p>}
      <button type="button" className={btn2 + ' mt-3'} onClick={addAnother}>Add another perfume</button>
      <h3 className="entry-section-title">Payment</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Payment method"><select className={inp} value={customer.method} onChange={event => setCustomer({ ...customer, method: event.target.value })}>{['Cash', 'Bank transfer', 'POS', 'Other'].map(method => <option key={method}>{method}</option>)}</select></Field>
        <Field label="Payment status"><select className={inp} value={customer.status} onChange={event => setCustomer({ ...customer, status: event.target.value as PayStatus })}><option value="paid">Paid</option><option value="partial">Partially paid</option><option value="unpaid">Unpaid</option></select></Field>
        {customer.status === 'partial' && <Field label="Amount paid (₦)"><input className={inp} type="number" min="0" step="0.01" max={total} value={customer.paid} onChange={event => setCustomer({ ...customer, paid: num(event.target.value) })} /></Field>}
      </div>
      <details className="entry-more"><summary>Discount & delivery (optional)</summary><div className="grid gap-3 md:grid-cols-2 mt-3"><Field label="Discount (₦)"><input className={inp} type="number" min="0" step="0.01" value={customer.discount} onChange={event => setCustomer({ ...customer, discount: num(event.target.value) })} /></Field><Field label="Delivery (₦)"><input className={inp} type="number" min="0" step="0.01" value={customer.delivery} onChange={event => setCustomer({ ...customer, delivery: num(event.target.value) })} /></Field></div></details>
    </Modal>}
  </Page>;
}
