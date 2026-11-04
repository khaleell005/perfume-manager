import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../server/database.mjs';
import {seedDemo} from './seed-demo.mjs';
const now=Date.parse('2026-11-04T14:00:00Z');
const fixture=t=>{const store=openStore(':memory:');t.after(()=>store.close());return store;};

test('demo seed builds a balanced week of linked sales, stock history, customers, expenses and a confirmed refund',t=>{
 const store=fixture(t);const result=seedDemo(store,{now});
 assert.deepEqual(result.added,{products:8,customers:5,sales:10,expenses:6,refunds:1});
 assert.equal(result.business,'Perfume by Aysha');
 const business=store.get('settings','business');
 assert.equal(business.instagram,'perfume_by_aysha_demo');
 assert.equal(business.tiktok,'perfume_by_aysha_demo');
 assert.equal(business.whatsapp,'+1 202-555-0199');
 const products=store.list('products'),sales=store.list('sales');
 assert.equal(new Set(sales.map(sale=>sale.invoiceNo)).size,10);
 assert.equal(sales.filter(sale=>sale.status==='partial').length,3);
 assert.equal(sales.filter(sale=>sale.status==='unpaid').length,2);
 assert.ok(sales.some(sale=>sale.items.some(item=>!item.productId)));
 assert.ok(sales.some(sale=>sale.cancelled&&sale.refunded===sale.paid));
 assert.ok(sales.every(sale=>sale.demo&&store.get('customers',sale.customerId)?.demo));
 assert.ok(sales.every(sale=>sale.createdAt<=now&&sale.createdAt>=now-7*86400000));
 assert.equal(products.find(product=>product.name==='Love Struck').quantity,26);
 assert.equal(products.find(product=>product.name==='Soft Musk').quantity,11);
 assert.equal(products.find(product=>product.name==='Ocean Breeze').quantity,0);
 assert.ok(products.some(product=>product.quantity>0&&product.quantity<=product.threshold));
 assert.ok(store.list('stockMovements').some(movement=>movement.type==='refund'));
 assert.ok(store.list('expenses').every(expense=>/^2026-1[01]-\d{2}$/.test(expense.date)));
});

test('rerunning demo seeding never duplicates invoices, refunds or stock deductions and preserves edited demo records',t=>{
 const store=fixture(t);seedDemo(store,{now});
 const p=store.list('products')[0];store.update('products',p.id,{price:12345});
 const before=store.backup();const repeat=seedDemo(store,{now:now+86400000});
 assert.deepEqual(repeat.added,{products:0,customers:0,sales:0,expenses:0,refunds:0});
 assert.deepEqual(store.backup(),before);
});

test('demo seed preserves owner credentials, existing business details, records and the invoice sequence',t=>{
 const store=fixture(t);
 store.createOwner({email:'owner@example.test',password:'original-owner-password'});
 store.saveSettings({name:'Existing Studio',phone:'08012345678',instagram:'my_studio',tiktok:'my_studio_videos',whatsapp:'+2348012345678',threshold:8});
 const product=store.create('products',{name:'Real product',size:50,price:5000,quantity:3});
 const original=store.createSale({items:[{productId:product.id,qty:1,price:5000}],name:'Existing buyer',discount:0,delivery:0,paid:0,status:'paid',method:'Cash'});
 const originalSaved=store.get('sales',original.id);
 const result=seedDemo(store,{now});
 assert.equal(result.business,'Existing Studio');
 assert.equal(store.get('settings','business').phone,'08012345678');
 assert.equal(store.get('settings','business').instagram,'my_studio');
 assert.equal(store.get('settings','business').tiktok,'my_studio_videos');
 assert.equal(store.get('settings','business').whatsapp,'+2348012345678');
 assert.equal(store.authenticate('owner@example.test','original-owner-password').email,'owner@example.test');
 assert.deepEqual(store.get('sales',original.id),originalSaved);
 assert.equal(store.get('products',product.id).quantity,2);
 assert.equal(store.list('sales')[1].invoiceNo,'INV-00002');
});

test('an error during demo seeding rolls back all sample records, business settings and counters',t=>{
 const store=fixture(t);const createSale=store.createSale;
 let count=0;store.createSale=(...args)=>{if(++count===3)throw new Error('Simulated interruption');return createSale(...args);};
 assert.throws(()=>seedDemo(store,{now}),/Simulated interruption/);
 assert.equal(store.list('products').length,0);assert.equal(store.list('customers').length,0);
 assert.equal(store.list('sales').length,0);assert.equal(store.list('expenses').length,0);
 assert.equal(store.list('stockMovements').length,0);assert.equal(store.get('settings','business'),null);
 assert.equal(store.get('settings','counter'),null);
 store.createSale=createSale;assert.equal(seedDemo(store,{now}).totals.sales,10);
});
