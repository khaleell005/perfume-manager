import { showToast } from '../Toast';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { addPayment, cancelSale, initiateRefund } from '../api';
import { useBusiness } from '../business';
import { shareInvoice } from '../invoice';
import { InvoiceActions, InvoiceDetails } from '../InvoicePanel';
import { ngn, num, runAction, sum, useCol } from '../lib';
import type { Sale } from '../types';
import { Card, Empty, Field, Modal, Page, Stat, btn, btn2, inp } from '../ui';

export default function Transactions() {
  const sales = useCol<Sale>('sales');
  const [params] = useSearchParams();
  const invoice = params.get('invoice') || '';
  const [query, setQuery] = useState(invoice);
  useEffect(() => { setQuery(invoice); }, [invoice]);
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(30);
  const [selectedId, setSelectedId] = useState('');
  const { business, loading: businessLoading, error: businessError } = useBusiness();
  const [payment, setPayment] = useState<{ id: string; amount: string } | null>(null);
  const [refund, setRefund] = useState<{ id: string; requestId: string; amount: string; reason: string; returnStock: boolean; method: string; reference: string } | null>(null);
  const [detailError, setDetailError] = useState('');
  const selected = sales.data.find(sale => sale.id === selectedId);
  const paymentSale = sales.data.find(sale => sale.id === payment?.id);
  const refundSale = sales.data.find(sale => sale.id === refund?.id);
  const refundable = (sale: Sale) => Math.max(0, Math.round((sale.paid - (sale.refunded || 0)) * 100) / 100);
  const status = (sale: Sale) => (sale.refunded || 0) > 0 ? 'Refunded' : sale.cancelled ? 'Cancelled' : sale.status;
  const rows = [...sales.data].sort((a, b) => b.createdAt - a.createdAt).filter(sale => `${sale.invoiceNo} ${sale.customerName || ''} ${sale.customerPhone || ''} ${new Date(sale.createdAt).toLocaleDateString()}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'refunded' ? (sale.refunded || 0) > 0 : filter === 'cancelled' ? sale.cancelled : !sale.cancelled && sale.status === filter)));
  const refresh = async (id: string) => { await sales.reload(); setSelectedId(id); setDetailError(''); };
  return <Page title="Transactions" right={<Link className={btn} to="/sales?new=1">New sale</Link>}>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3"><Stat label="Invoices issued" value={sales.data.length} /><Stat label="Net payments received" value={ngn(sum(sales.data.map(sale => sale.paid - (sale.refunded || 0))))} /><Stat label="Total refunded" value={ngn(sum(sales.data.map(sale => sale.refunded || 0)))} /></div>
    <div className="filter-bar"><input className={inp + ' max-w-xs'} aria-label="Search transactions" placeholder="Invoice number, customer, phone or date…" value={query} onChange={event => { setQuery(event.target.value); setLimit(30); }} /><select className={inp + ' max-w-[12rem]'} aria-label="Filter transactions" value={filter} onChange={event => { setFilter(event.target.value); setLimit(30); }}><option value="all">All transactions</option><option value="paid">Paid</option><option value="partial">Partially paid</option><option value="unpaid">Unpaid</option><option value="refunded">Refunded</option><option value="cancelled">Cancelled</option></select></div>
    <Card title="Invoice history" right={<div className="collection-meta"><span>{rows.length}</span> invoices</div>}>{!rows.length ? <Empty text="No matching transactions." /> : rows.slice(0, limit).map(sale => <div key={sale.id} className="transaction-row"><div><strong>{sale.invoiceNo}</strong> <span className={`status-badge status-${sale.cancelled ? 'cancelled' : sale.status}`}>{status(sale)}</span><p>{sale.customerName || 'Walk-in'} · {new Date(sale.createdAt).toLocaleDateString()}</p></div><div><strong>{ngn(sale.total)}</strong><p>{(sale.refunded || 0) > 0 ? `${ngn(sale.refunded || 0)} refunded` : `Received ${ngn(sale.paid)}`}</p></div><div className="invoice-actions"><button className={btn2} onClick={() => { setSelectedId(sale.id); setDetailError(''); }}>View invoice</button><button className={btn2} disabled={businessLoading || !!businessError} onClick={() => void runAction(() => shareInvoice(sale, business))}>Share invoice</button></div></div>)}{rows.length > limit && <button className={btn2 + ' mt-4'} onClick={() => setLimit(limit + 30)}>Load more</button>}</Card>
    {selected && <Modal title={selected.invoiceNo} description="Invoice details, payments, and refund history." onClose={() => setSelectedId('')}>
      <InvoiceDetails sale={selected} /><InvoiceActions sale={selected} />
      <div className="invoice-actions mt-4">
        {!selected.cancelled && selected.paid < selected.total && <button type="button" className={btn2} onClick={() => { setPayment({ id: selected.id, amount: '' }); setSelectedId(''); }}>Add payment</button>}
        {refundable(selected) > 0 && <button type="button" className={btn2} onClick={() => { setRefund({ id: selected.id, requestId: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, amount: String(refundable(selected)), reason: 'Customer refund', returnStock: false, method: selected.method || 'Cash', reference: '' }); setSelectedId(''); }}>Initiate refund</button>}
        {!selected.cancelled && !selected.paid && <button type="button" className={btn2} onClick={async () => { if (!confirm('Cancel this unpaid sale and restore its stock?')) return; try { await cancelSale(selected.id); showToast('Sale cancelled successfully'); await refresh(selected.id); } catch (error) { setDetailError((error as Error).message); } }}>Cancel sale</button>}
      </div>
      {(selected.refunds || []).some(row => row.status === 'paid') && <section className="refund-history"><h3 className="entry-section-title">Refund history</h3>{selected.refunds!.filter(row => row.status === 'paid').map(row => <div className="refund-row" key={row.id}><strong>{ngn(row.amount)} refunded</strong><p>{row.reason} · {new Date(row.resolvedAt || row.createdAt).toLocaleDateString()}</p>{row.method && <p>{row.method}{row.reference ? ` · ${row.reference}` : ''}</p>}{row.returnStock && <p>Sale cancelled and items returned to stock.</p>}</div>)}</section>}
      {detailError && <p className="form-notice mt-4" role="alert">{detailError}</p>}
    </Modal>}
    {payment && paymentSale && <Modal compact title="Record payment" description={`${paymentSale.invoiceNo} · Balance ${ngn(paymentSale.total - paymentSale.paid)}`} onClose={() => setPayment(null)} onSubmit={async () => { await addPayment(payment.id, num(payment.amount)); showToast('Payment recorded successfully'); const id = payment.id; setPayment(null); await refresh(id); }} submitLabel="Save payment"><Field label="Amount received (₦)"><input className={inp} type="number" required min="0.01" step="0.01" max={paymentSale.total - paymentSale.paid} value={payment.amount} onChange={event => setPayment({ ...payment, amount: event.target.value })} /></Field></Modal>}
    {refund && refundSale && <Modal compact title="Confirm refund" description={`${refundSale.invoiceNo} · Refundable ${ngn(refundable(refundSale))}`} onClose={() => setRefund(null)} onSubmit={async () => { await initiateRefund(refund.id, { requestId: refund.requestId, amount: Number(refund.amount), reason: refund.reason, returnStock: refund.returnStock, method: refund.method, reference: refund.reference }); showToast('Refund confirmed successfully'); const id = refund.id; setRefund(null); await refresh(id); }} submitLabel="Confirm refund">
      <p className="section-description">Confirming deducts this amount from net sales and payments in reports immediately. This records the refund; money is returned through your payment method.</p><Field label="Refund amount (₦)"><input className={inp} type="number" required min="0.01" step="0.01" max={refundable(refundSale)} value={refund.amount} onChange={event => setRefund({ ...refund, amount: event.target.value, returnStock: false })} /></Field><div className="mt-4"><Field label="Reason"><textarea className={inp} required value={refund.reason} onChange={event => setRefund({ ...refund, reason: event.target.value })} /></Field></div>
      {!refundSale.cancelled && <label className="refund-checkbox"><input type="checkbox" checked={refund.returnStock} disabled={Number(refund.amount) !== refundable(refundSale)} onChange={event => setRefund({ ...refund, returnStock: event.target.checked })} /><span>Cancel this sale and return all items to stock now. Requires refunding the full remaining payment.</span></label>}
      <details className="entry-more"><summary>Refund method & reference</summary><div className="mt-3"><Field label="Refund method"><select className={inp} value={refund.method} onChange={event => setRefund({ ...refund, method: event.target.value })}>{['Cash', 'Bank transfer', 'POS', 'POS reversal', 'Other'].map(method => <option key={method}>{method}</option>)}</select></Field></div><div className="mt-3"><Field label="Payment reference (optional)"><input className={inp} value={refund.reference} onChange={event => setRefund({ ...refund, reference: event.target.value })} /></Field></div></details>
    </Modal>}
  </Page>;
}
