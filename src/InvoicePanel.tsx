import { useState } from 'react';
import { downloadInvoice, invoiceDate, invoiceMoney, invoiceState, invoiceTotals, printInvoice, shareInvoice } from './invoice';
import { ngn, runAction, waLink } from './lib';
import { useBusiness } from './business';
import type { Sale } from './types';
import { btn2 } from './ui';
import { businessSocials } from '../shared/business.mjs';
export function InvoiceActions({ sale }: { sale: Sale }) {
  const { business, loading, error, refresh } = useBusiness();
  const [message, setMessage] = useState('');
  return <>{error && <p className="form-notice" role="alert">{error} <button type="button" onClick={() => void refresh()}>Retry business details</button></p>}<div className="invoice-actions"><button type="button" disabled={loading || !!error} className={btn2} onClick={() => downloadInvoice(sale, business)}>Download PDF</button><button type="button" disabled={loading || !!error} className={btn2} onClick={() => void runAction(async () => { const result = await shareInvoice(sale, business); setMessage(result === 'downloaded' ? 'Invoice PDF downloaded. Attach it to your customer’s message.' : ''); })}>Share invoice</button><button type="button" disabled={loading || !!error} className={btn2} onClick={() => printInvoice(sale, business)}>Print</button>{sale.customerPhone && <button type="button" disabled={loading || !!error} className={btn2} onClick={() => { downloadInvoice(sale, business); window.open(`${waLink(sale.customerPhone!)}?text=${encodeURIComponent(`Hello ${sale.customerName || ''}, here is your invoice ${sale.invoiceNo} from ${business.name || 'our perfume store'}. Total: ${ngn(sale.total)}.`)}`, '_blank', 'noopener,noreferrer'); setMessage('Invoice PDF downloaded. Attach it in the WhatsApp chat that opened.'); }}>WhatsApp</button>}</div>{message && <p className="entry-hint" role="status">{message}</p>}</>;

}
export function InvoiceDetails({ sale }: { sale: Sale }) {
  const { business } = useBusiness();
  const state = invoiceState(sale);
  return <article className="invoice-paper" aria-label={`Invoice ${sale.invoiceNo}`}>
    <header className="paper-header">
      <section className="invoice-business">{business.logo && <img src={business.logo} alt={`${business.name || 'Business'} logo`} />}<div><h3>{business.name || 'Perfume Manager'}</h3>{business.address && <p>{business.address}</p>}{business.phone && <p>Phone: {business.phone}</p>}{business.email && <p>{business.email}</p>}{businessSocials(business).map(line => <p key={line}>{line}</p>)}</div></section>
      <div className="paper-title"><span>SALES INVOICE</span><h2>Invoice</h2><span className={`paper-status paper-status-${state.tone}`}>{state.label}</span></div>
    </header>
    <section className="paper-parties"><div><span className="paper-label">BILL TO</span><h3>{sale.customerName || 'Walk-in customer'}</h3>{[sale.customerPhone, sale.customerEmail, sale.customerAddress].filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}</div><dl><div><dt>Invoice no.</dt><dd>{sale.invoiceNo}</dd></div><div><dt>Issued</dt><dd>{invoiceDate(sale.createdAt)}</dd></div><div><dt>Payment</dt><dd>{sale.method}</dd></div></dl></section>
    <div className="paper-table-wrap"><table className="paper-table"><thead><tr><th scope="col">Perfume</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead><tbody>{sale.items.map((item, index) => <tr key={index}><td><strong>{item.name}</strong>{item.size && <span>{item.size} ml</span>}{item.note && <span>{item.note}</span>}</td><td>{item.qty}</td><td>{invoiceMoney(item.price)}</td><td>{invoiceMoney(item.price * item.qty)}</td></tr>)}</tbody></table></div>
    <section className="paper-bottom"><div className="paper-payment"><span className="paper-label">PAYMENT DETAILS</span><strong>{sale.method}</strong><p>{sale.cancelled ? 'This invoice has been cancelled.' : state.balance === 0 ? 'Payment received. No balance remaining.' : `Outstanding balance: ${invoiceMoney(state.balance)}.`}</p>{(sale.refunded || 0) > 0 && <p>{invoiceMoney(sale.refunded || 0)} refunded. Retain this invoice for your records.</p>}</div><dl className="paper-totals">{invoiceTotals(sale).map(row => <div key={row.label} className={`paper-total-${row.kind}`}><dt>{row.label}</dt><dd>{invoiceMoney(row.amount)}</dd></div>)}</dl></section>
    {business.thanks && <p className="invoice-thanks">{business.thanks}</p>}
    <footer className="paper-footer"><span>{business.name || 'Perfume Manager'}</span><span>{sale.invoiceNo} · NGN</span></footer>
  </article>;
}
