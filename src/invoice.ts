import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Biz, Sale } from './types';

// Helvetica has no ₦ glyph, so PDFs use "NGN".
const money = (n: number) => 'NGN ' + n.toLocaleString('en-NG', { maximumFractionDigits: 2 });

export function buildInvoice(s: Sale, b: Biz) {
  const d = new jsPDF();
  const x = b.logo ? 42 : 14;
  if (b.logo) { try { d.addImage(b.logo, 'PNG', 14, 10, 22, 22); } catch { /* Ignore an unreadable legacy logo. */ } }
  d.setFontSize(16).setTextColor(0);
  const heading = d.splitTextToSize(b.name || 'Perfume Manager', 118 - (x - 14)) as string[];
  d.text(heading, x, 18);
  d.setFontSize(9).setTextColor(90);
  const contact = [b.address, b.phone && `Phone: ${b.phone}`, b.whatsapp && `WhatsApp: ${b.whatsapp}`, b.email, b.social].filter(Boolean) as string[];
  const contactLines = contact.flatMap(line => d.splitTextToSize(line, 118 - (x - 14)) as string[]);
  const contactY = 18 + heading.length * 6;
  if (contactLines.length) d.text(contactLines, x, contactY);
  d.setTextColor(0).setFontSize(12).text(`Invoice ${s.invoiceNo}`, 196, 18, { align: 'right' });
  d.setFontSize(9).text(new Date(s.createdAt).toLocaleDateString(), 196, 24, { align: 'right' });
  const billY = Math.max(44, contactY + contactLines.length * 4 + 10);
  const customer = [`Bill to: ${s.customerName || 'Walk-in customer'}`, ...[s.customerPhone, s.customerEmail, s.customerAddress].filter(Boolean)] as string[];
  const customerLines = customer.flatMap(line => d.splitTextToSize(line, 178) as string[]);
  d.text(customerLines, 14, billY);
  autoTable(d, {
    startY: billY + 4 + customerLines.length * 4,
    head: [['Item', 'Qty', 'Unit price', 'Total']],
    body: s.items.map((i) => [i.name + (i.size ? ` (${i.size}ml)` : '') + (i.note ? `\n${i.note}` : ''), i.qty, money(i.price), money(i.price * i.qty)]),
    headStyles: { fillColor: [107, 45, 92] },
  });
  let y = (d as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const rows: [string, number][] = [['Subtotal', s.subtotal], ['Discount', -s.discount], ['Delivery', s.delivery], ['Total', s.total], ['Paid', s.paid], ['Refunded', s.refunded || 0], ['Balance', s.cancelled ? 0 : Math.max(0, s.total - s.paid)]];
  if (y + rows.length * 6 + 32 > d.internal.pageSize.getHeight() - 14) { d.addPage(); y = 20; }
  rows.forEach(([k, v]) => { d.text(k, 140, y); d.text(money(v), 196, y, { align: 'right' }); y += 6; });
  d.text(`Payment: ${s.method} (${s.cancelled ? 'cancelled' : s.status})`, 14, y - 6);
  if (b.thanks) {
    d.setFontSize(10);
    const message = d.splitTextToSize(b.thanks, 170) as string[];
    if (y + 14 + message.length * 5 > d.internal.pageSize.getHeight() - 14) { d.addPage(); y = 10; }
    d.text(message, 105, y + 14, { align: 'center' });
  }
  return d;
}

export const downloadInvoice = (s: Sale, b: Biz) => buildInvoice(s, b).save(`${s.invoiceNo}.pdf`);

export function printInvoice(s: Sale, b: Biz) {
  const d = buildInvoice(s, b);
  d.autoPrint();
  window.open(d.output('bloburl') as unknown as string);
}

export async function shareInvoice(s: Sale, b: Biz) {
  const d = buildInvoice(s, b);
  const file = new File([d.output('blob')], `${s.invoiceNo}.pdf`, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: s.invoiceNo, text: `${b.name || 'Invoice'} · ${s.invoiceNo}` }); return 'shared' as const; }
    catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelled' as const;
      if (!['NotAllowedError', 'NotSupportedError', 'TypeError'].includes((error as Error).name)) throw error;
      // Some browsers expose sharing but cannot open a file share sheet in this context.
    }
  }
  d.save(`${s.invoiceNo}.pdf`);
  return 'downloaded' as const;
}
