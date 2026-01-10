/**
 * Revonn AI Assistant - Smart Business Helper
 * Provides real data-driven responses from local database
 */

import { db, getDailySummary } from './database';
import type { InventoryItem, Customer, Invoice, Staff } from '@/types';

// Language detection
export function detectLanguage(text: string): 'hindi' | 'english' {
  // Check for Devanagari script
  const devanagariRegex = /[\u0900-\u097F]/;
  if (devanagariRegex.test(text)) return 'hindi';

  // Check for common Hinglish words
  const hinglishWords = ['hai', 'kya', 'kitna', 'kitni', 'aaj', 'kal', 'kaise', 'kaun', 'kahan', 'kyun', 'batao', 'dikhao', 'banao', 'bhi', 'mein', 'ka', 'ki', 'ke', 'se', 'ko', 'pe', 'par', 'nahi', 'haan', 'ji', 'abhi', 'wala', 'wali', 'sale', 'profit', 'bill', 'stock', 'item', 'customer', 'staff', 'udhaar', 'paisa', 'rupee', 'rupay'];
  const lowerText = text.toLowerCase();
  const hinglishCount = hinglishWords.filter(word => lowerText.includes(word)).length;

  if (hinglishCount >= 2) return 'hindi';
  return 'english';
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Intent detection
type Intent =
  | 'stock_check'
  | 'sales_today'
  | 'profit_today'
  | 'item_sales'
  | 'low_stock'
  | 'reorder'
  | 'create_bill'
  | 'customer_history'
  | 'customer_credit'
  | 'marketing_message'
  | 'gst_help'
  | 'staff_attendance'
  | 'staff_salary'
  | 'bom_help'
  | 'app_help'
  | 'greeting'
  | 'unknown';

function detectIntent(text: string): Intent {
  const lower = text.toLowerCase();

  // Greeting
  if (/^(hi|hello|hey|namaste|namaskar)/.test(lower)) return 'greeting';

  // Stock check for specific item
  if ((lower.includes('stock') || lower.includes('available') || lower.includes('hai kya') || lower.includes('sold out') || lower.includes('baki') || lower.includes('kitna')) &&
    (lower.includes('kurti') || lower.includes('saree') || lower.includes('shirt') || lower.includes('item') || /size|color|colour/.test(lower))) {
    return 'stock_check';
  }

  // Low stock / reorder
  if (lower.includes('low stock') || lower.includes('kam stock') || lower.includes('khatam')) return 'low_stock';
  if (lower.includes('reorder') || lower.includes('order karna') || lower.includes('mangwana')) return 'reorder';

  // Sales today
  if ((lower.includes('sales') || lower.includes('sale') || lower.includes('biki') || lower.includes('bikri')) &&
    (lower.includes('today') || lower.includes('aaj'))) return 'sales_today';

  // Profit
  if (lower.includes('profit') || lower.includes('munafa') || lower.includes('kamai') || lower.includes('p&l') || lower.includes('fayda')) return 'profit_today';

  // Item-wise sales
  if ((lower.includes('kitni') || lower.includes('kitna') || lower.includes('how many') || lower.includes('how much')) &&
    (lower.includes('biki') || lower.includes('sold') || lower.includes('sale'))) return 'item_sales';

  // Create bill - COMMENTED OUT TO LET GEMINI HANDLE IT
  // if (lower.includes('bill') || lower.includes('invoice') || lower.includes('billing')) {
  //   if (lower.includes('create') || lower.includes('banao') || lower.includes('bana') || lower.includes('make')) {
  //     return 'create_bill';
  //   }
  // }

  // Customer queries
  if (lower.includes('customer') || lower.includes('grahak')) {
    if (lower.includes('history') || lower.includes('purchase') || lower.includes('kharida')) return 'customer_history';
    if (lower.includes('credit') || lower.includes('udhaar') || lower.includes('outstanding') || lower.includes('baki')) return 'customer_credit';
  }
  if (lower.includes('udhaar') || lower.includes('outstanding') || lower.includes('baki paisa')) return 'customer_credit';

  // Marketing
  if (lower.includes('marketing') || lower.includes('message') || lower.includes('whatsapp') || lower.includes('broadcast') ||
    lower.includes('diwali') || lower.includes('offer') || lower.includes('discount message')) return 'marketing_message';

  // GST
  if (lower.includes('gst') || lower.includes('hsn') || lower.includes('tax')) return 'gst_help';

  // Staff
  if (lower.includes('staff') || lower.includes('employee') || lower.includes('karmchari')) {
    if (lower.includes('attendance') || lower.includes('haziri') || lower.includes('present') || lower.includes('aaj')) return 'staff_attendance';
    if (lower.includes('salary') || lower.includes('tankhwa') || lower.includes('vetan')) return 'staff_salary';
  }
  if (lower.includes('attendance') || lower.includes('haziri')) return 'staff_attendance';
  if (lower.includes('salary') || lower.includes('tankhwa')) return 'staff_salary';

  // BOM / Inventory upload
  if (lower.includes('bom') || lower.includes('upload') || lower.includes('import') || lower.includes('supplier bill')) return 'bom_help';

  // App help
  if (lower.includes('how to') || lower.includes('kaise') || lower.includes('help') || lower.includes('tutorial') || lower.includes('guide') || lower.includes('backup')) return 'app_help';

  return 'unknown';
}

// Extract item name from query
function extractItemName(text: string): string | null {
  const lower = text.toLowerCase();
  // Common item patterns
  const patterns = [
    /(?:is|kya|show|check|dikhao)\s+([a-z\s]+?)(?:\s+(?:size|color|in stock|stock|available|hai|baki))/i,
    /([a-z]+\s+(?:kurti|saree|shirt|jeans|top|dress|suit))/i,
    /(?:stock of|stock for)\s+([a-z\s]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  // Extract common product names
  const productWords = ['kurti', 'saree', 'shirt', 'jeans', 'top', 'dress', 'suit', 'pant', 'lehenga'];
  for (const word of productWords) {
    if (lower.includes(word)) {
      // Try to get color + product
      const colorMatch = lower.match(/(?:blue|red|green|black|white|pink|yellow|orange|purple)\s*\w*/);
      if (colorMatch) return colorMatch[0];
      return word;
    }
  }

  return null;
}

// Extract customer name from query
function extractCustomerName(text: string): string | null {
  const patterns = [
    /(?:for|of|ka|ki|ke)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /([A-Z][a-z]+)(?:'s|ka|ki|ke)\s+(?:history|purchase|credit|udhaar|outstanding)/i,
    /show\s+([A-Z][a-z]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

// Main AI response generator
export async function generateAIResponse(
  message: string
): Promise<{ response: string; action?: { type: string; data?: any }; intent: string }> {
  const lang = detectLanguage(message);
  const intent = detectIntent(message);

  try {
    let result;
    switch (intent) {
      case 'greeting':
        result = getGreetingResponse(lang);
        break;

      case 'sales_today':
        result = await getSalesTodayResponse(lang);
        break;

      case 'profit_today':
        result = await getProfitResponse(lang);
        break;

      case 'stock_check':
        result = await getStockCheckResponse(message, lang);
        break;

      case 'low_stock':
        result = await getLowStockResponse(lang);
        break;

      case 'reorder':
        result = await getReorderResponse(lang);
        break;

      case 'item_sales':
        result = await getItemSalesResponse(message, lang);
        break;

      case 'create_bill':
        result = getBillCreationResponse(message, lang);
        break;

      case 'customer_history':
        result = await getCustomerHistoryResponse(message, lang);
        break;

      case 'customer_credit':
        result = await getCustomerCreditResponse(message, lang);
        break;

      case 'marketing_message':
        result = getMarketingResponse(message, lang);
        break;

      case 'gst_help':
        result = getGSTHelpResponse(message, lang);
        break;

      case 'staff_attendance':
        result = await getStaffAttendanceResponse(lang);
        break;

      case 'staff_salary':
        result = await getStaffSalaryResponse(message, lang);
        break;

      case 'bom_help':
        result = getBOMHelpResponse(lang);
        break;

      case 'app_help':
        result = getAppHelpResponse(message, lang);
        break;

      default:
        result = getUnknownResponse(lang);
        break;
    }

    return { ...result, intent };
  } catch (error) {
    console.error('AI Assistant error:', error);
    return {
      response: lang === 'hindi'
        ? 'Maaf kijiye, kuch technical problem hui. Kripya dobara try karein.'
        : 'Sorry, something went wrong. Please try again.',
      intent: 'error'
    };
  }
}

// Response generators

function getGreetingResponse(lang: 'hindi' | 'english') {
  if (lang === 'hindi') {
    return {
      response: `Namaste! 🙏 Main aapka Revonn Assistant hoon. Main aapki madad kar sakta hoon:

• Stock check karna ("Blue kurti M size hai kya?")
• Sales report dekhna ("Aaj kitni sale hui?")
• Profit/P&L dekhna ("Aaj ka profit kitna?")
• Bill banana ("Ramesh ke liye 2 kurti ka bill banao")
• Customer history dekhna
• Marketing message banana
• Staff attendance aur salary

Kya jaanna chahenge?`
    };
  }
  return {
    response: `Hello! 👋 I'm your Revonn Assistant. I can help you with:

• Check stock levels ("Is blue kurti M in stock?")
• View sales reports ("How much sales today?")
• Check profit/P&L ("Show today's profit")
• Create bills ("Create bill for 2 kurtis for Ramesh")
• Customer purchase history
• Generate marketing messages
• Staff attendance & salary

What would you like to know?`
  };
}

async function getSalesTodayResponse(lang: 'hindi' | 'english') {
  const summary = await getDailySummary();
  const invoices = await db.invoices.getToday();

  // Get top selling item
  const itemSales: Record<string, number> = {};
  invoices.forEach(inv => {
    inv.items.forEach(item => {
      itemSales[item.itemName] = (itemSales[item.itemName] || 0) + item.quantity;
    });
  });
  const topItem = Object.entries(itemSales).sort((a, b) => b[1] - a[1])[0];

  if (lang === 'hindi') {
    return {
      response: `📊 **Aaj ki Sales Summary:**

• Total Sale: ${formatCurrency(summary.totalSales)}
• Items Sold: ${summary.totalItemsSold}
• Bills: ${summary.invoiceCount}
• Tax Collected: ${formatCurrency(summary.taxCollected)}
${topItem ? `• Top Seller: ${topItem[0]} (${topItem[1]} units)` : ''}

Kya item-wise detail dekhna chahenge?`,
      action: { type: 'show_report', data: { type: 'sales' } }
    };
  }

  return {
    response: `📊 **Today's Sales Summary:**

• Total Sales: ${formatCurrency(summary.totalSales)}
• Items Sold: ${summary.totalItemsSold}
• Invoices: ${summary.invoiceCount}
• Tax Collected: ${formatCurrency(summary.taxCollected)}
${topItem ? `• Top Seller: ${topItem[0]} (${topItem[1]} units)` : ''}

Want to see item-wise details?`,
    action: { type: 'show_report', data: { type: 'sales' } }
  };
}

async function getProfitResponse(lang: 'hindi' | 'english') {
  const summary = await getDailySummary();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySummary = await getDailySummary(yesterday);

  const comparison = summary.totalSales > 0 && yesterdaySummary.totalSales > 0
    ? ((summary.totalSales - yesterdaySummary.totalSales) / yesterdaySummary.totalSales * 100).toFixed(0)
    : null;

  if (lang === 'hindi') {
    return {
      response: `💰 **Aaj ka P&L Summary:**

• Revenue: ${formatCurrency(summary.totalSales)}
• Estimated COGS: ${formatCurrency(summary.totalSales * 0.6)}
• Gross Profit: ${formatCurrency(summary.grossProfit)}
• Expenses: ${formatCurrency(summary.totalExpenses)}
• Net Profit: ${formatCurrency(summary.grossProfit - summary.totalExpenses)}
${comparison ? `\n📈 Kal se ${comparison}% ${Number(comparison) >= 0 ? 'zyada' : 'kam'} sale` : ''}

Cash-in: ${formatCurrency(summary.totalCashIn)} | Cash-out: ${formatCurrency(summary.totalCashOut)}`,
      action: { type: 'show_report', data: { type: 'profit' } }
    };
  }

  return {
    response: `💰 **Today's P&L Summary:**

• Revenue: ${formatCurrency(summary.totalSales)}
• Estimated COGS: ${formatCurrency(summary.totalSales * 0.6)}
• Gross Profit: ${formatCurrency(summary.grossProfit)}
• Expenses: ${formatCurrency(summary.totalExpenses)}
• Net Profit: ${formatCurrency(summary.grossProfit - summary.totalExpenses)}
${comparison ? `\n📈 ${Number(comparison) >= 0 ? 'Up' : 'Down'} ${Math.abs(Number(comparison))}% vs yesterday` : ''}

Cash-in: ${formatCurrency(summary.totalCashIn)} | Cash-out: ${formatCurrency(summary.totalCashOut)}`,
    action: { type: 'show_report', data: { type: 'profit' } }
  };
}

async function getStockCheckResponse(message: string, lang: 'hindi' | 'english') {
  const itemName = extractItemName(message);
  const inventory = await db.inventory.getAll();

  if (!itemName || inventory.length === 0) {
    // Return general inventory summary
    const totalItems = inventory.length;
    const lowStock = inventory.filter(item => {
      const totalStock = item.variants.reduce((sum, v) => sum + v.stock, 0);
      return totalStock <= item.lowStockThreshold;
    });

    if (lang === 'hindi') {
      return {
        response: `📦 **Inventory Summary:**

• Total Items: ${totalItems}
• Low Stock Items: ${lowStock.length}

Specific item ke baare mein puchne ke liye item ka naam batayein, jaise "Blue kurti M size hai kya?"`,
        action: { type: 'check_stock' }
      };
    }
    return {
      response: `📦 **Inventory Summary:**

• Total Items: ${totalItems}
• Low Stock Items: ${lowStock.length}

To check specific item stock, ask something like "Is blue kurti size M in stock?"`,
      action: { type: 'check_stock' }
    };
  }

  // Search for matching item
  const matchedItems = inventory.filter(item =>
    item.name.toLowerCase().includes(itemName.toLowerCase())
  );

  if (matchedItems.length === 0) {
    if (lang === 'hindi') {
      return {
        response: `"${itemName}" inventory mein nahi mila. Kya aap exact naam check kar sakte hain?`,
        action: { type: 'check_stock' }
      };
    }
    return {
      response: `Could not find "${itemName}" in inventory. Please check the exact name.`,
      action: { type: 'check_stock' }
    };
  }

  const item = matchedItems[0];
  const totalStock = item.variants.reduce((sum, v) => sum + v.stock, 0);
  const variantDetails = item.variants.map(v =>
    `${v.size || ''}${v.color ? ' ' + v.color : ''}: ${v.stock} pcs`
  ).join('\n• ');

  if (lang === 'hindi') {
    return {
      response: `📦 **${item.name}**

• Total Stock: ${totalStock} pieces
• Price: ${formatCurrency(item.sellingPrice)}
${item.variants.length > 1 ? `\n**Size/Color wise:**\n• ${variantDetails}` : ''}
${totalStock <= item.lowStockThreshold ? '\n⚠️ Low stock! Reorder karein.' : ''}`,
      action: { type: 'check_stock', data: { itemId: item.id } }
    };
  }

  return {
    response: `📦 **${item.name}**

• Total Stock: ${totalStock} pieces
• Price: ${formatCurrency(item.sellingPrice)}
${item.variants.length > 1 ? `\n**By Size/Color:**\n• ${variantDetails}` : ''}
${totalStock <= item.lowStockThreshold ? '\n⚠️ Low stock! Consider reordering.' : ''}`,
    action: { type: 'check_stock', data: { itemId: item.id } }
  };
}

async function getLowStockResponse(lang: 'hindi' | 'english') {
  const lowStockItems = await db.inventory.getLowStock();

  if (lowStockItems.length === 0) {
    if (lang === 'hindi') {
      return { response: '✅ Sab items mein sufficient stock hai. Koi low stock item nahi hai.' };
    }
    return { response: '✅ All items have sufficient stock. No low stock alerts.' };
  }

  const itemList = lowStockItems.slice(0, 10).map((item, i) => {
    const totalStock = item.variants.reduce((sum, v) => sum + v.stock, 0);
    return `${i + 1}. ${item.name} - ${totalStock} left`;
  }).join('\n');

  if (lang === 'hindi') {
    return {
      response: `⚠️ **Low Stock Items (${lowStockItems.length}):**

${itemList}
${lowStockItems.length > 10 ? `\n...aur ${lowStockItems.length - 10} items` : ''}

Inhe jaldi reorder karein!`,
      action: { type: 'show_report', data: { type: 'low_stock' } }
    };
  }

  return {
    response: `⚠️ **Low Stock Items (${lowStockItems.length}):**

${itemList}
${lowStockItems.length > 10 ? `\n...and ${lowStockItems.length - 10} more` : ''}

Consider reordering these items soon!`,
    action: { type: 'show_report', data: { type: 'low_stock' } }
  };
}

async function getReorderResponse(lang: 'hindi' | 'english') {
  const lowStockItems = await db.inventory.getLowStock();
  const invoices = await db.invoices.getAll();

  // Calculate sales velocity for suggestions
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const recentInvoices = invoices.filter(inv => new Date(inv.createdAt) >= last30Days);

  const salesVelocity: Record<string, number> = {};
  recentInvoices.forEach(inv => {
    inv.items.forEach(item => {
      salesVelocity[item.itemId] = (salesVelocity[item.itemId] || 0) + item.quantity;
    });
  });

  const suggestions = lowStockItems.slice(0, 5).map((item, i) => {
    const monthlySales = salesVelocity[item.id] || 0;
    const suggestedQty = Math.max(Math.ceil(monthlySales * 1.5), 10);
    const totalStock = item.variants.reduce((sum, v) => sum + v.stock, 0);
    return `${i + 1}. ${item.name} - ${totalStock} left (suggest: ${suggestedQty} pcs)`;
  }).join('\n');

  if (suggestions.length === 0) {
    if (lang === 'hindi') {
      return { response: '✅ Abhi kisi item ko reorder karne ki zaroorat nahi hai.' };
    }
    return { response: '✅ No items need reordering at this time.' };
  }

  if (lang === 'hindi') {
    return {
      response: `📋 **Reorder Suggestions:**

${suggestions}

(Suggestion sales velocity ke basis par hai)`,
      action: { type: 'show_report', data: { type: 'reorder' } }
    };
  }

  return {
    response: `📋 **Reorder Suggestions:**

${suggestions}

(Suggestions based on sales velocity)`,
    action: { type: 'show_report', data: { type: 'reorder' } }
  };
}

async function getItemSalesResponse(message: string, lang: 'hindi' | 'english') {
  const itemName = extractItemName(message);
  const invoices = await db.invoices.getToday();

  const itemSales: Record<string, { qty: number; revenue: number }> = {};
  invoices.forEach(inv => {
    inv.items.forEach(item => {
      if (!itemSales[item.itemName]) {
        itemSales[item.itemName] = { qty: 0, revenue: 0 };
      }
      itemSales[item.itemName].qty += item.quantity;
      itemSales[item.itemName].revenue += item.total;
    });
  });

  if (itemName) {
    const matchedItem = Object.entries(itemSales).find(([name]) =>
      name.toLowerCase().includes(itemName.toLowerCase())
    );

    if (matchedItem) {
      const [name, data] = matchedItem;
      if (lang === 'hindi') {
        return {
          response: `📊 **${name} - Aaj ki Sale:**

• Units Sold: ${data.qty}
• Revenue: ${formatCurrency(data.revenue)}`
        };
      }
      return {
        response: `📊 **${name} - Today's Sales:**

• Units Sold: ${data.qty}
• Revenue: ${formatCurrency(data.revenue)}`
      };
    }
  }

  // Show top 5 items
  const topItems = Object.entries(itemSales)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5)
    .map(([name, data], i) => `${i + 1}. ${name} - ${data.qty} pcs (${formatCurrency(data.revenue)})`)
    .join('\n');

  if (!topItems) {
    if (lang === 'hindi') {
      return { response: 'Aaj abhi tak koi sale nahi hui.' };
    }
    return { response: 'No sales recorded today yet.' };
  }

  if (lang === 'hindi') {
    return {
      response: `📊 **Aaj ke Top Selling Items:**

${topItems}`
    };
  }

  return {
    response: `📊 **Today's Top Selling Items:**

${topItems}`
  };
}

function getBillCreationResponse(message: string, lang: 'hindi' | 'english') {
  // Parse bill details from message
  const qtyMatch = message.match(/(\d+)/);
  const customerName = extractCustomerName(message);

  if (lang === 'hindi') {
    return {
      response: `🧾 Bill create karne ke liye Billing page pe jayein.

${customerName ? `Customer: ${customerName}` : ''}
${qtyMatch ? `Quantity detected: ${qtyMatch[1]}` : ''}

Main aapko billing screen pe le jaata hoon...`,
      action: { type: 'create_bill', data: { customerName, qty: qtyMatch?.[1] } }
    };
  }

  return {
    response: `🧾 Let me help you create a bill.

${customerName ? `Customer: ${customerName}` : ''}
${qtyMatch ? `Quantity detected: ${qtyMatch[1]}` : ''}

Taking you to the billing screen...`,
    action: { type: 'create_bill', data: { customerName, qty: qtyMatch?.[1] } }
  };
}

async function getCustomerHistoryResponse(message: string, lang: 'hindi' | 'english') {
  const customerName = extractCustomerName(message);
  const customers = await db.customers.getAll();

  if (!customerName) {
    if (lang === 'hindi') {
      return {
        response: `Customer ka naam batayein, jaise "Ramesh ki purchase history dikhao"`,
        action: { type: 'customer_history' }
      };
    }
    return {
      response: `Please specify the customer name, like "Show Ramesh purchase history"`,
      action: { type: 'customer_history' }
    };
  }

  const customer = customers.find(c =>
    c.name.toLowerCase().includes(customerName.toLowerCase())
  );

  if (!customer) {
    if (lang === 'hindi') {
      return { response: `"${customerName}" naam ka customer nahi mila.` };
    }
    return { response: `Could not find customer "${customerName}".` };
  }

  const invoices = await db.invoices.getAll();
  const customerInvoices = invoices.filter(inv => inv.customerId === customer.id).slice(0, 5);

  const history = customerInvoices.map(inv =>
    `• ${new Date(inv.createdAt).toLocaleDateString('en-IN')} - ${formatCurrency(inv.grandTotal)}`
  ).join('\n');

  if (lang === 'hindi') {
    return {
      response: `👤 **${customer.name}**
📞 ${customer.phone}
${customer.tags.length > 0 ? `🏷️ ${customer.tags.join(', ')}` : ''}

**Recent Purchases:**
${history || 'Koi purchase history nahi hai'}

Outstanding: ${formatCurrency(customer.outstandingCredit)}`,
      action: { type: 'customer_history', data: { customerId: customer.id } }
    };
  }

  return {
    response: `👤 **${customer.name}**
📞 ${customer.phone}
${customer.tags.length > 0 ? `🏷️ ${customer.tags.join(', ')}` : ''}

**Recent Purchases:**
${history || 'No purchase history'}

Outstanding: ${formatCurrency(customer.outstandingCredit)}`,
    action: { type: 'customer_history', data: { customerId: customer.id } }
  };
}

async function getCustomerCreditResponse(message: string, lang: 'hindi' | 'english') {
  const customerName = extractCustomerName(message);
  const customers = await db.customers.getAll();

  if (customerName) {
    const customer = customers.find(c =>
      c.name.toLowerCase().includes(customerName.toLowerCase())
    );

    if (customer) {
      if (lang === 'hindi') {
        return {
          response: `💳 **${customer.name} ka Udhaar:**

Outstanding Amount: ${formatCurrency(customer.outstandingCredit)}
${customer.outstandingCredit > 0 ? '\n⚠️ Payment reminder bhejein?' : '✅ Koi baki nahi hai'}`,
          action: { type: 'customer_credit', data: { customerId: customer.id } }
        };
      }
      return {
        response: `💳 **${customer.name}'s Credit:**

Outstanding Amount: ${formatCurrency(customer.outstandingCredit)}
${customer.outstandingCredit > 0 ? '\n⚠️ Send payment reminder?' : '✅ No outstanding dues'}`,
        action: { type: 'customer_credit', data: { customerId: customer.id } }
      };
    }
  }

  // Show all customers with credit
  const creditCustomers = customers.filter(c => c.outstandingCredit > 0);
  const totalCredit = creditCustomers.reduce((sum, c) => sum + c.outstandingCredit, 0);

  const list = creditCustomers.slice(0, 5).map(c =>
    `• ${c.name}: ${formatCurrency(c.outstandingCredit)}`
  ).join('\n');

  if (lang === 'hindi') {
    return {
      response: `💳 **Outstanding Credit Summary:**

Total Udhaar: ${formatCurrency(totalCredit)}
Customers: ${creditCustomers.length}

${list || 'Kisi ka bhi udhaar nahi hai'}`,
      action: { type: 'customer_credit' }
    };
  }

  return {
    response: `💳 **Outstanding Credit Summary:**

Total Credit: ${formatCurrency(totalCredit)}
Customers: ${creditCustomers.length}

${list || 'No outstanding credit'}`,
    action: { type: 'customer_credit' }
  };
}

function getMarketingResponse(message: string, lang: 'hindi' | 'english') {
  const lower = message.toLowerCase();
  let occasion = 'sale';
  if (lower.includes('diwali')) occasion = 'Diwali';
  else if (lower.includes('holi')) occasion = 'Holi';
  else if (lower.includes('new arrival') || lower.includes('naya')) occasion = 'New Arrivals';
  else if (lower.includes('clearance') || lower.includes('sale')) occasion = 'Clearance Sale';

  const templates = {
    hindi: [
      `🎉 *${occasion} Special!* 🎉\n\nAapke pasandida store par dhamakedar offers! Flat 20% OFF on all items.\n\n📍 Visit us today!\n🛍️ Limited stock, jaldi aayein!`,
      `✨ *${occasion} Dhamaka* ✨\n\nNaye collection aa gaye hain! Special prices sirf aapke liye.\n\nWhatsApp karein ya store visit karein! 🎊`,
      `🌟 *Exclusive ${occasion} Offer!* 🌟\n\nBuy 2 Get 1 FREE!\nSirf is weekend tak.\n\n📞 Call karein ya visit karein!`
    ],
    english: [
      `🎉 *${occasion} Special!* 🎉\n\nAmazing offers at your favorite store! Flat 20% OFF on all items.\n\n📍 Visit us today!\n🛍️ Limited stock, hurry!`,
      `✨ *${occasion} Sale* ✨\n\nNew collection just arrived! Special prices just for you.\n\nWhatsApp us or visit store! 🎊`,
      `🌟 *Exclusive ${occasion} Offer!* 🌟\n\nBuy 2 Get 1 FREE!\nThis weekend only.\n\n📞 Call or visit us!`
    ]
  };

  const messages = lang === 'hindi' ? templates.hindi : templates.english;
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  if (lang === 'hindi') {
    return {
      response: `📱 **Marketing Message:**

${randomMessage}

Is message ko copy karein aur WhatsApp broadcast mein use karein!`,
      action: { type: 'generate_message', data: { message: randomMessage } }
    };
  }

  return {
    response: `📱 **Marketing Message:**

${randomMessage}

Copy this message and use it for WhatsApp broadcast!`,
    action: { type: 'generate_message', data: { message: randomMessage } }
  };
}

function getGSTHelpResponse(message: string, lang: 'hindi' | 'english') {
  const hsnMatch = message.match(/hsn\s*(\d+)/i);

  // Common HSN codes and rates
  const hsnRates: Record<string, { rate: number; category: string }> = {
    '6204': { rate: 12, category: 'Women\'s garments' },
    '6205': { rate: 12, category: 'Men\'s shirts' },
    '6206': { rate: 12, category: 'Women\'s blouses' },
    '6203': { rate: 12, category: 'Men\'s suits' },
    '6104': { rate: 12, category: 'Women\'s knitted garments' },
    '6109': { rate: 5, category: 'T-shirts (below ₹1000)' },
  };

  if (hsnMatch) {
    const hsn = hsnMatch[1];
    const info = hsnRates[hsn];

    if (info) {
      if (lang === 'hindi') {
        return {
          response: `📋 **HSN ${hsn} - GST Info:**

Category: ${info.category}
Standard GST Rate: ${info.rate}%

⚠️ Note: Actual rate depend kar sakta hai item ki value par. Legal compliance ke liye CA se verify karein.`
        };
      }
      return {
        response: `📋 **HSN ${hsn} - GST Info:**

Category: ${info.category}
Standard GST Rate: ${info.rate}%

⚠️ Note: Actual rate may vary based on item value. Verify with CA for legal compliance.`
      };
    }
  }

  if (lang === 'hindi') {
    return {
      response: `📋 **GST Quick Guide:**

Common Textile Rates:
• Items below ₹1000: 5% GST
• Items above ₹1000: 12% GST

HSN Codes:
• 6204 - Women's garments
• 6205 - Men's shirts  
• 6109 - T-shirts

Specific HSN ke liye puchein: "HSN 6204 pe kitna GST hai?"

⚠️ Legal advice ke liye CA se baat karein.`
    };
  }

  return {
    response: `📋 **GST Quick Guide:**

Common Textile Rates:
• Items below ₹1000: 5% GST
• Items above ₹1000: 12% GST

HSN Codes:
• 6204 - Women's garments
• 6205 - Men's shirts
• 6109 - T-shirts

Ask about specific HSN: "What's GST for HSN 6204?"

⚠️ Consult CA for legal advice.`
  };
}

async function getStaffAttendanceResponse(lang: 'hindi' | 'english') {
  const staff = await db.staff.getAll();

  if (staff.length === 0) {
    if (lang === 'hindi') {
      return { response: '👥 Abhi koi staff add nahi hai. Settings > Staff mein staff add karein.' };
    }
    return { response: '👥 No staff added yet. Add staff in Settings > Staff.' };
  }

  // Mock attendance (in real app, fetch from attendance table)
  const attendance = staff.map(s => ({
    name: s.name,
    status: Math.random() > 0.2 ? 'present' : 'absent'
  }));

  const present = attendance.filter(a => a.status === 'present').length;
  const list = attendance.map(a =>
    `• ${a.name}: ${a.status === 'present' ? '✅ Present' : '❌ Absent'}`
  ).join('\n');

  if (lang === 'hindi') {
    return {
      response: `👥 **Aaj ki Staff Attendance:**

Present: ${present}/${staff.length}

${list}`
    };
  }

  return {
    response: `👥 **Today's Staff Attendance:**

Present: ${present}/${staff.length}

${list}`
  };
}

async function getStaffSalaryResponse(message: string, lang: 'hindi' | 'english') {
  const staff = await db.staff.getAll();

  if (staff.length === 0) {
    if (lang === 'hindi') {
      return { response: '👥 Abhi koi staff add nahi hai.' };
    }
    return { response: '👥 No staff added yet.' };
  }

  const salaryList = staff.map(s =>
    `• ${s.name}: ${formatCurrency(s.baseSalary)} (${s.salaryType})`
  ).join('\n');

  const totalSalary = staff.reduce((sum, s) => sum + s.baseSalary, 0);

  if (lang === 'hindi') {
    return {
      response: `💰 **Staff Salary:**

${salaryList}

Total Monthly: ${formatCurrency(totalSalary)}`
    };
  }

  return {
    response: `💰 **Staff Salary:**

${salaryList}

Total Monthly: ${formatCurrency(totalSalary)}`
  };
}

function getBOMHelpResponse(lang: 'hindi' | 'english') {
  if (lang === 'hindi') {
    return {
      response: `📦 **BOM Upload Kaise Karein:**

1. **Menu** se "BOM Upload" pe jayein
2. **CSV/Excel file** upload karein ya **photo** lein
3. System automatically items parse karega
4. **Review & Confirm** karein
5. Items inventory mein add ho jayenge!

Supported formats: CSV, XLS, XLSX, Image, PDF

Kya aap BOM upload page pe jaana chahenge?`,
      action: { type: 'navigate', data: { path: '/bom-upload' } }
    };
  }

  return {
    response: `📦 **How to Upload BOM:**

1. Go to **BOM Upload** from menu
2. Upload **CSV/Excel file** or take **photo**
3. System will automatically parse items
4. **Review & Confirm** the mapping
5. Items will be added to inventory!

Supported formats: CSV, XLS, XLSX, Image, PDF

Would you like to go to BOM upload page?`,
    action: { type: 'navigate', data: { path: '/bom-upload' } }
  };
}

function getAppHelpResponse(message: string, lang: 'hindi' | 'english') {
  const lower = message.toLowerCase();

  if (lower.includes('bill') || lower.includes('invoice')) {
    if (lang === 'hindi') {
      return {
        response: `🧾 **Bill Kaise Banayein:**

1. Bottom menu se **Billing** pe click karein
2. **Customer** select karein (optional)
3. **Add Items** button se items add karein
4. Quantity aur discount set karein
5. **Save & Share** pe click karein

Bill automatically PDF ban jayega aur WhatsApp se share kar sakte hain!`
      };
    }
    return {
      response: `🧾 **How to Create Bill:**

1. Click **Billing** from bottom menu
2. Select **Customer** (optional)
3. Use **Add Items** to add products
4. Set quantity and discount
5. Click **Save & Share**

Bill will be auto-generated as PDF and can be shared via WhatsApp!`
    };
  }

  if (lower.includes('backup')) {
    if (lang === 'hindi') {
      return {
        response: `💾 **Backup Kaise Karein:**

1. **Settings** mein jayein
2. **Data Backup** section mein
3. **Export Backup** pe click karein
4. JSON file download ho jayegi

**Restore:** Same section mein "Import Backup" se restore karein.`
      };
    }
    return {
      response: `💾 **How to Backup:**

1. Go to **Settings**
2. Find **Data Backup** section
3. Click **Export Backup**
4. JSON file will download

**Restore:** Use "Import Backup" in same section.`
    };
  }

  // General help
  if (lang === 'hindi') {
    return {
      response: `📖 **Revonn App Guide:**

• **Dashboard**: Sales summary aur alerts
• **Billing**: Bills banayein aur share karein
• **Inventory**: Stock manage karein
• **Customers**: Customer CRM
• **Reports**: Detailed reports aur P&L
• **Settings**: App settings aur backup

Specific help ke liye puchein:
- "Bill kaise banaye?"
- "Backup kaise karun?"
- "BOM upload kaise hota hai?"`
    };
  }

  return {
    response: `📖 **Revonn App Guide:**

• **Dashboard**: Sales summary & alerts
• **Billing**: Create & share invoices
• **Inventory**: Manage stock
• **Customers**: Customer CRM
• **Reports**: Detailed reports & P&L
• **Settings**: App settings & backup

Ask for specific help:
- "How to create bill?"
- "How to backup?"
- "How to upload BOM?"`
  };
}

function getUnknownResponse(lang: 'hindi' | 'english') {
  if (lang === 'hindi') {
    return {
      response: `Maaf kijiye, samajh nahi aaya. Kya aap stock, sales ya bill ke baare mein pooch rahe hain?

Main aapki madad kar sakta hoon:
• "Aaj kitni sale hui?"
• "Blue kurti M size hai kya?"
• "Low stock items dikhao"
• "Ramesh ka udhaar kitna hai?"
• "Marketing message banao"`
    };
  }

  return {
    response: `Sorry, I didn't understand. Are you asking about stock, sales, or billing?

I can help you with:
• "How much sales today?"
• "Is blue kurti M in stock?"
• "Show low stock items"
• "What's Ramesh's outstanding?"
• "Create marketing message"`
  };
}




export async function getShopContext(): Promise<string> {
  try {
    const summary = await getDailySummary();
    const lowStockItems = await db.inventory.getLowStock();
    const customers = await db.customers.getAll();
    const staff = await db.staff.getAll();

    // Format succinct context
    return `
CURRENT SHOP STATUS (${new Date().toLocaleString()}):
- Today's Sales: ₹${summary.totalSales} (Items: ${summary.totalItemsSold})
- Cash In Hand: ₹${summary.totalCashIn - summary.totalCashOut}
- Low Stock Alerts: ${lowStockItems.length} items (${lowStockItems.map(i => i.name).slice(0, 3).join(', ')}...)
- Total Customers: ${customers.length}
- Active Staff: ${staff.length}
    `.trim();
  } catch (e) {
    console.error("Error fetching context:", e);
    return "";
  }
}
