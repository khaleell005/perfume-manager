import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Biz, Sale } from './types';
import { businessSocials } from '../shared/business.mjs';

export const invoiceMoney = (amount: number, symbol = true) => `${symbol ? '₦' : 'NGN '}${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const invoiceDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });
export function invoiceState(sale: Sale) {
  const balance = sale.cancelled ? 0 : Math.max(0, sale.total - sale.paid);
  if ((sale.refunded || 0) > 0) return { label: sale.refunded! >= sale.paid ? 'Refunded' : 'Partly refunded', tone: 'refund', balance };
  if (sale.cancelled) return { label: 'Cancelled', tone: 'cancelled', balance };
  if (balance === 0) return { label: 'Paid in full', tone: 'paid', balance };
  return { label: sale.paid > 0 ? 'Partially paid' : 'Unpaid', tone: 'unpaid', balance };
}
export function invoiceTotals(sale: Sale) {
  return [
    { label: 'Subtotal', amount: sale.subtotal, kind: 'plain' },
    ...(sale.discount ? [{ label: 'Discount', amount: -sale.discount, kind: 'plain' }] : []),
    ...(sale.delivery ? [{ label: 'Delivery', amount: sale.delivery, kind: 'plain' }] : []),
    { label: 'Invoice total', amount: sale.total, kind: 'total' },
    { label: 'Payments received', amount: sale.paid, kind: 'plain' },
    ...((sale.refunded || 0) > 0 ? [{ label: 'Amount refunded', amount: sale.refunded!, kind: 'plain' }] : []),
    { label: 'Balance due', amount: invoiceState(sale).balance, kind: 'balance' },
  ];
}

// Standard PDF fonts use "NGN" because they do not include the Naira glyph.
export function buildInvoice(sale: Sale, business: Biz) {
  const pdf = new jsPDF({ compress: false });
  const width = 210, height = 297, margin = 18, right = width - margin, content = right - margin;
  const ink: [number, number, number] = [62, 49, 40];
  const muted: [number, number, number] = [137, 118, 99];
  const gold: [number, number, number] = [168, 132, 77];
  const line: [number, number, number] = [230, 221, 207];
  const cream: [number, number, number] = [248, 244, 236];
  const name = business.name || 'Perfume Manager';
  const state = invoiceState(sale);
  const paperBackground = () => { pdf.setFillColor(255, 253, 249).rect(0, 0, width, height, 'F'); };
  const rule = (y: number) => { pdf.setDrawColor(...line).setLineWidth(0.25).line(margin, y, right, y); };
  const label = (text: string, x: number, y: number) => { pdf.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...muted).text(text.toUpperCase(), x, y); };
  const continuation = () => {
    pdf.setFillColor(...gold).rect(0, 0, width, 2, 'F');
    pdf.setFont('times', 'normal').setFontSize(12).setTextColor(...ink).text(name, margin, 14, { maxWidth: 115 });
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted).text(sale.invoiceNo, right, 14, { align: 'right' });
    rule(20);
  };
  pdf.setProperties({ title: `${sale.invoiceNo} · ${name}`, subject: 'Sales invoice', author: name, creator: name });
  paperBackground();
  pdf.setFillColor(...gold).rect(0, 0, width, 3, 'F');
  let nameX = margin;
  if (business.logo) {
    let clipped = false;
    try {
      const image = pdf.getImageProperties(business.logo);
      const scale = Math.min(30 / image.width, 30 / image.height);
      pdf.saveGraphicsState(); clipped = true;
      pdf.circle(margin + 15, 31, 15, null).clip().discardPath();
      pdf.addImage(business.logo, image.fileType, margin + (30 - image.width * scale) / 2, 16 + (30 - image.height * scale) / 2, image.width * scale, image.height * scale);
      pdf.restoreGraphicsState(); clipped = false;
      nameX += 38;
    } catch { /* A legacy unreadable logo must not prevent invoice generation. */ }
    finally { if (clipped) pdf.restoreGraphicsState(); }
  }
  pdf.setFont('times', 'normal').setFontSize(20).setTextColor(...ink);
  const nameLines = pdf.splitTextToSize(name, 146 - nameX) as string[];
  pdf.text(nameLines, nameX, 24);
  const contactY = 26 + nameLines.length * 6;
  const contacts = [business.address, business.phone && `Phone: ${business.phone}`, business.email, ...businessSocials(business)].filter(Boolean) as string[];
  pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted);
  const contactLines = contacts.flatMap(text => pdf.splitTextToSize(text, 146 - nameX) as string[]);
  if (contactLines.length) pdf.text(contactLines, nameX, contactY, { lineHeightFactor: 1.5 });
  pdf.setFont('times', 'normal').setFontSize(27).setTextColor(...gold).text('Invoice', right, 25, { align: 'right' });
  pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted).text('SALES INVOICE', right, 33, { align: 'right' });
  const headerBottom = Math.max(55, contactY + contactLines.length * 4.25 + 8);
  rule(headerBottom);
  const billY = headerBottom + 11;
  label('Bill to', margin, billY);
  pdf.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...ink);
  const customerName = pdf.splitTextToSize(sale.customerName || 'Walk-in customer', 96) as string[];
  pdf.text(customerName, margin, billY + 8);
  pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...muted);
  const customerLines = [sale.customerPhone, sale.customerEmail, sale.customerAddress].filter(Boolean).flatMap(text => pdf.splitTextToSize(text!, 96) as string[]);
  const customerY = billY + 10 + customerName.length * 4.5;
  if (customerLines.length) pdf.text(customerLines, margin, customerY, { lineHeightFactor: 1.5 });
  const metaX = 130;
  for (const [index, [title, value]] of [['Invoice no.', sale.invoiceNo], ['Issued', invoiceDate(sale.createdAt)], ['Payment', sale.method]].entries()) {
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted).text(title, metaX, billY + index * 7);
    pdf.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...ink).text(value, right, billY + index * 7, { align: 'right', maxWidth: 40 });
  }
  pdf.setFillColor(...cream).roundedRect(metaX, billY + 19, right - metaX, 9, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...gold).text(state.label.toUpperCase(), metaX + (right - metaX) / 2, billY + 25, { align: 'center' });
  const tableY = Math.max(billY + 39, customerY + customerLines.length * 4.5 + 9);
  autoTable(pdf, {
    startY: tableY, theme: 'plain', margin: { left: margin, right: margin, top: 28, bottom: 23 }, tableWidth: content,
    head: [['PERFUME', 'QTY', 'UNIT PRICE', 'AMOUNT']],
    body: sale.items.map(item => [{ content: `${item.name}${item.size ? `\n${item.size} ml` : ''}${item.note ? `\n${item.note}` : ''}` }, item.qty, invoiceMoney(item.price, false), invoiceMoney(item.price * item.qty, false)]),
    styles: { font: 'helvetica', fontSize: 8.5, textColor: ink, cellPadding: 5, lineColor: line, lineWidth: { bottom: 0.2 }, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: cream, textColor: muted, fontSize: 7.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [253, 251, 247] },
    columnStyles: { 0: { cellWidth: 82 }, 1: { cellWidth: 16, halign: 'center' }, 2: { cellWidth: 38, halign: 'right' }, 3: { cellWidth: 38, halign: 'right', fontStyle: 'bold' } },
    willDrawPage(data) { if (data.pageNumber > 1) paperBackground(); },
    didDrawPage(data) { if (data.pageNumber > 1) continuation(); },
  });
  let y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 11;
  const totals = invoiceTotals(sale);
  const totalHeight = totals.reduce((sum, row) => sum + (row.kind === 'total' ? 13 : row.kind === 'balance' ? 11 : 8), 0);
  if (y + totalHeight > height - 34) { pdf.addPage(); paperBackground(); continuation(); y = 31; }
  label('Payment details', margin, y + 4);
  pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...ink).text(sale.method, margin, y + 12);
  pdf.setFontSize(8).setTextColor(...muted);
  const paymentNote = (sale.refunded || 0) > 0 ? `${invoiceMoney(sale.refunded || 0, false)} refunded. Retain this invoice for your records.` : sale.cancelled ? 'This invoice has been cancelled. No payment is due.' : state.balance === 0 ? 'Payment received. No balance remaining.' : `Outstanding balance: ${invoiceMoney(state.balance, false)}.`;
  const noteLines = pdf.splitTextToSize(paymentNote, 82) as string[];
  pdf.text(noteLines, margin, y + 19, { lineHeightFactor: 1.6 });
  const summaryX = 116, summaryWidth = right - summaryX;
  let summaryY = y;
  for (const row of totals) {
    const rowHeight = row.kind === 'total' ? 13 : row.kind === 'balance' ? 11 : 8;
    if (row.kind === 'total') { pdf.setFillColor(...cream).roundedRect(summaryX - 3, summaryY, summaryWidth + 6, rowHeight - 1, 2, 2, 'F'); }
    if (row.kind === 'balance') { pdf.setDrawColor(...line).line(summaryX, summaryY + 1, right, summaryY + 1); }
    const baseline = summaryY + (row.kind === 'plain' ? 5 : 8);
    pdf.setFont('helvetica', row.kind === 'plain' ? 'normal' : 'bold').setFontSize(row.kind === 'total' ? 9 : 8).setTextColor(...(row.kind === 'plain' ? muted : ink)).text(row.label, summaryX, baseline);
    pdf.setFont('helvetica', row.kind === 'plain' ? 'normal' : 'bold').setFontSize(row.kind === 'total' ? 10 : 8.5).setTextColor(...ink).text(invoiceMoney(row.amount, false), right, baseline, { align: 'right' });
    summaryY += rowHeight;
  }
  y = Math.max(summaryY, y + 20 + noteLines.length * 4.5) + 15;
  if (business.thanks) {
    pdf.setFont('times', 'italic').setFontSize(12).setTextColor(...gold);
    const thanks = pdf.splitTextToSize(business.thanks, content) as string[];
    for (const text of thanks) {
      if (y > height - 29) { pdf.addPage(); paperBackground(); continuation(); pdf.setFont('times', 'italic').setFontSize(12).setTextColor(...gold); y = 34; }
      pdf.text(text, width / 2, y, { align: 'center' }); y += 6;
    }
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); rule(height - 17);
    pdf.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...muted).text(`${name}  |  ${sale.invoiceNo}`, margin, height - 11, { maxWidth: 130 });
    pdf.text(`${page} / ${pages}`, right, height - 11, { align: 'right' });
  }
  return pdf;
}

const invoiceFilename = (sale: Sale) => {
  const safePart = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  return `${safePart(sale.customerName || '') || 'Walk-in customer'} - ${safePart(sale.invoiceNo)}.pdf`;
};
export const downloadInvoice = (sale: Sale, business: Biz) => buildInvoice(sale, business).save(invoiceFilename(sale));
export function printInvoice(sale: Sale, business: Biz) {
  const pdf = buildInvoice(sale, business); pdf.autoPrint(); window.open(pdf.output('bloburl') as unknown as string);
}
export async function shareInvoice(sale: Sale, business: Biz, options: { text?: string } = {}) {
  const pdf = buildInvoice(sale, business);
  const file = new File([pdf.output('blob')], invoiceFilename(sale), { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: sale.invoiceNo, text: options.text || `${business.name || 'Invoice'} · ${sale.invoiceNo}` }); return 'shared' as const; }
    catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelled' as const;
      if (!['NotAllowedError', 'NotSupportedError', 'TypeError'].includes((error as Error).name)) throw error;
    }
  }
  pdf.save(invoiceFilename(sale)); return 'downloaded' as const;
}
