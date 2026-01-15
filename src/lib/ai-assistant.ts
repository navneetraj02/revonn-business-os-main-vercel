/**
 * Revonn AI Assistant - "Einstein" Business Operator
 * Fully integrated with Firebase for read/write operations.
 */

import { auth, db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

// --- CONTEXT GATHERING (FIREBASE) ---

export async function getShopContext() {
  const user = auth.currentUser;
  // Fallback to local session if auth.currentUser is null (sometimes happens on refresh before auth sync)
  let userId = user?.uid;
  if (!userId) {
    const session = localStorage.getItem('revonn-staff-session');
    if (session) userId = JSON.parse(session).ownerId;
  }

  if (!userId) return "User not logged in. Cannot access business data.";

  // Fetch Inventory
  const invSnap = await getDocs(query(collection(db, 'inventory'), where('user_id', '==', userId)));
  const inventory = invSnap.docs.map(d => ({ name: d.data().name, stock: d.data().variants?.[0]?.stock || 0, price: d.data().sellingPrice }));

  // Fetch Today's Sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // WORKAROUND: Query only by user_id to avoid "missing composite index" error for now.
  // Then filter by date in memory.
  const invRef = collection(db, 'invoices');
  const allSalesSnap = await getDocs(query(invRef, where('user_id', '==', userId)));

  const todayDocs = allSalesSnap.docs.filter(d => d.data().created_at >= todayISO);

  const totalSales = todayDocs.reduce((sum, d) => sum + (d.data().grandTotal || 0), 0);
  const invoiceCount = todayDocs.length;

  const inventorySummary = inventory.map(i => `${i.name} (${i.stock} pcs) - ₹${i.price}`).join(', ');

  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
You are Revonn AI, an expert BUSINESS OPERATOR assistant ("Einstein" for business).
Your goal is to help the user manage their business efficiently using the provided data.

IMPORTANT CONSTRAINTS:
1. STRICTLY BUSINESS ONLY: You must ONLY answer questions related to business, sales, inventory, customers, profit, loss, and verified business strategies.
2. REJECT NON-BUSINESS QUERIES: If the user asks about biology, chemistry, entertainment, personal life, jokes, or any non-business topic, you MUST politely refuse. Say: "I am designed solely for business operations. Please ask me about your sales, inventory, or customers."
3. BE INTELLIGENT & DATA-DRIVEN: Use the sales and inventory data provided below to give accurate, insightful answers.
4. ACT PROFESSIONALLY: Maintain a professional, helpful, and concise tone.

Today is: ${dateStr}.
Current Business Status:
- Total Sales Today: ₹${totalSales}
- Invoices Generated: ${invoiceCount}
- Inventory Preview: ${inventorySummary.slice(0, 800)}...

Your Capabilities:
1. ANSWER queries about sales, stock, profit, customers.
2. PERFORM ACTIONS by returning a specific JSON structure.
   - You CAN create invoices (bills).
   - You CAN add inventory stock.
   - You CAN add new customers.

RESPONSE FORMAT:
You must ALWAYS return a JSON object with this structure:
{
  "response": "Text response to show the user",
  "action": {
    "type": "create_invoice" | "add_stock" | "add_customer" | "none",
    "data": { ...parameters }
  },
  "suggested_actions": ["Suggestion 1", "Suggestion 2"]
}

ACTIONS:
- If user wants to create a bill:
  action: { type: "create_invoice", data: { customerName: string, customerPhone?: string, items: [{ name: string, quantity: number, price?: number }] } }
  
- If user wants to add OR reduce stock (Single or Multiple):
  action: { type: "update_stock", data: { items: [{ name: string, quantity: number, price?: number }] } }
  OR (Legacy Single Item):
  action: { type: "update_stock", data: { name: string, quantity: number, price?: number } } 
  (Use negative quantity to reduce stock, e.g. -5. If price provided, update it.)

- If user wants to update item details (rename, price change):
  action: { type: "update_item", data: { name: string, newName?: string, newPrice?: number } }

- If user wants to delete an item:
  action: { type: "delete_item", data: { name: string } }

- If user wants to add customer:
  action: { type: "add_customer", data: { name: string, phone: string } }

RULES:
- Be helpful, concise, and professional.
- EXECUTE IMMEDIATELY: Do NOT ask for confirmation.
- Use Hindi-English mix if the user speaks Hindi/Hinglish.
- If quantity is missing, assume 1. BUT LOOK CAREFULLY. "Add Maggi 50" means quantity 50.
- **NAME ACCURACY**: Use the EXACT name the user says. Do NOT autocorrect "Maggi" to "Maggi Noodles" or "Laal Lehenga" to "Bala Lehenga".
- **NO ASSUMPTIONS**: Treat every unique name as a UNIQUE product. Do not assume "Red" is same as "Crimson". Do not map "X" to "Y".
- **PRICE**: If the user mentions a price (e.g. "at 20", "price 20"), YOU MUST INCLUDE IT in data.price. Do not ignore it.

EXAMPLES:
- User: "Add stock Maggi 50" -> action: { type: "update_stock", data: { name: "Maggi", quantity: 50, price: null } }
- User: "Add 10 Coke at 40" -> action: { type: "update_stock", data: { name: "Coke", quantity: 10, price: 40 } }        

- User: "Add 10 Coke at 40rs" -> action: { type: "update_stock", data: { name: "Coke", quantity: 10, price: 40 } }
- User: "Reduce Coke by 10" -> action: { type: "update_stock", data: { name: "Coke", quantity: -10 } }
- User: "Create bill for Rahul 2 Maggi" -> action: { type: "create_invoice", data: { customerName: "Rahul", items: [{ name: "Maggi", quantity: 2 }] } }
- User: "Delete item Old Shoes" -> action: { type: "delete_item", data: { name: "Old Shoes" } }
`;
}

// --- GROQ API CLIENT ---
import Groq from "groq-sdk";
import { GROQ_API_KEY } from './ai';

const groq = new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true });

// --- MAIN HANDLER ---

// Define Message type to avoid circular dependency or redefine locally
export interface SimpleMessage {
  role: 'user' | 'assistant';
  content: string;
}

// --- MULTIMODAL HANDLER (GROQ VISION) ---
export async function generateMultimodalResponse(message: string, imageBase64: string, previousMessages: SimpleMessage[] = []) {
  try {
    const systemPrompt = await getShopContext();

    if (!GROQ_API_KEY) {
      return { response: "AI Configuration Missing. Please check Groq API Key.", intent: 'error' };
    }

    // Convert previous messages to Groq format
    const history = previousMessages.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    }));

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt + `
          \nIMPORTANT FOR VISION:
          - You are analyzing an image provided by the user (e.g., a BILL, product photo, or handwritten note).
          - **CRITICAL INTENT CHECK**:
            1. If user says "Add stock", "Update inventory", "Purchase", "Restock" -> TREAT AS PURCHASE BILL. Use action: 'update_stock'.
            2. If user says "Create bill", "Make invoice", "Sell" -> TREAT AS SALES BILL. Use action: 'create_invoice'.
            3. If unsure, look at the image context. Supply bills = 'update_stock'. Customer invoices = 'create_invoice'.
          - EXTRACT all business-relevant data (Item Names, Quantities, Prices, Customer Name, Phone).
          - Be precise with numbers.
          - Construct the JSON 'action' strictly based on the image content and USER INTENT.
          `
        },
        ...history,
        {
          role: "user",
          content: [
            { type: "text", text: message },
            {
              type: "image_url",
              image_url: {
                url: imageBase64
              }
            }
          ] as any // Cast to any to avoid type issues if SDK types aren't fully updated for Vision
        }
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.1, // Low temp for precise data extraction
      max_tokens: 1024,
      response_format: { type: "json_object" }
    });

    const text = completion.choices[0]?.message?.content || "";
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("Failed to parse JSON from Vision model, returning raw text", e);
      return {
        response: text,
        action: null,
        intent: 'chat'
      };
    }

    // --- EXECUTE ACTIONS ---
    if (parsed.action && parsed.action.type !== 'none') {
      try {
        const result = await executeAction(parsed.action);
        // parsed.response += `\n[Status: ${result?.message || 'Done'}]`;
      } catch (err: any) {
        console.error("Action Failed", err);
        parsed.response += ` (Error executing action: ${err.message})`;
      }
    }

    return {
      response: parsed.response,
      action: parsed.action,
      intent: parsed.action?.type || 'chat'
    };

  } catch (error: any) {
    console.error("Multimodal Error:", error);
    throw error; // Re-throw to be handled by caller UI
  }
}

export async function generateAIResponse(message: string, previousMessages: SimpleMessage[] = []) {
  try {
    const systemPrompt = await getShopContext();

    // Safety check for empty key
    if (!GROQ_API_KEY) {
      console.error("Groq API Key is missing.");
      return { response: "AI Configuration Missing. Please check API Key.", intent: 'error' };
    }

    // Convert previous messages to Groq format (filtering out system/action clutter if needed)
    const history = previousMessages.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    }));

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt + "\nIMPORTANT: You are Einstein, a business operator. Do NOT perform any actions yet, just respond to the user query professionally."
        },
        ...history,
        {
          role: "user",
          content: message
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 1024,
      response_format: { type: "json_object" }
    });

    const text = completion.choices[0]?.message?.content || "";

    // Clean JSON (Groq usually returns clean JSON if forced, but safety first)
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      // Fallback for non-JSON responses
      // Check if it looks like a refusal or general chat
      return {
        response: text,
        action: null,
        intent: 'chat'
      };
    }

    // --- EXECUTE ACTIONS ---
    if (parsed.action && parsed.action.type !== 'none') {
      try {
        await executeAction(parsed.action);
        // Append success confirmation if action didn't return one
        // parsed.response += " [Action Completed Successfully]";
      } catch (err) {
        console.error("Action Failed", err);
        parsed.response += ` (Error: ${err.message || "Unknown error saving data"})`;
      }
    }

    return {
      response: parsed.response,
      action: parsed.action,
      intent: parsed.action?.type || 'chat'
    };

  } catch (error: any) {
    console.error("AI Assistant Error:", error);

    // Log detailed error for debugging
    if (error.status) console.error("Error Status:", error.status);
    if (error.statusText) console.error("Error Status Text:", error.statusText);

    // --- FALLBACK MODE ---
    // If the API fails (key issues, quota, network), we use a rule-based system
    // so the user still gets a helpful response based on their business data.
    console.warn("Switching to Local Fallback Mode due to API error.");
    return await getFallbackResponse(message);
  }
}

// --- FALLBACK LOGIC ---
async function getFallbackResponse(message: string) {
  const lowerMsg = message.toLowerCase();
  const context = await getShopContext();

  // Extract data from context string (parsing the text we generated earlier)
  // This is a quick way to reuse the data fetching logic without duplicating code
  const salesMatch = context.match(/Total Sales Today: ₹([\d.]+)/);
  const sales = salesMatch ? salesMatch[1] : "0";

  const invoiceMatch = context.match(/Invoices Generated: (\d+)/);
  const invoices = invoiceMatch ? invoiceMatch[1] : "0";

  let response = "I am currently running in offline mode. I can help with basic queries.";
  let action = null;

  // 1. Sales / Profit Queries
  if (lowerMsg.includes('sales') || lowerMsg.includes('sell') || lowerMsg.includes('income') || lowerMsg.includes('made today')) {
    response = `Based on today's records, you have made a total sales of ₹${sales} from ${invoices} invoices.`;
  }

  // 2. Inventory / Stock Queries
  else if (lowerMsg.includes('stock') || lowerMsg.includes('inventory') || lowerMsg.includes('have') || lowerMsg.includes('available')) {
    // Basic extraction - in a real app we'd query DB again effectively, but here we summarize
    const invSection = context.split("Inventory Preview:")[1].split("Your Capabilities:")[0];
    response = `Here is a quick summary of your stock:\n${invSection.trim()}`;
  }

  // 3. Customer Queries
  else if (lowerMsg.includes('customer') || lowerMsg.includes('who')) {
    response = "You can view your detailed customer list in the Customers tab. I can help add a new customer if you provide the name and phone number.";
  }

  // 4. Action: Add Customer
  else if (lowerMsg.includes('add customer') || lowerMsg.includes('create customer')) {
    // Simple parsing attempt: "Add customer John"
    const nameMatch = message.match(/customer\s+([A-Za-z\s]+)/i);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      action = {
        type: "add_customer",
        data: { name: name, phone: "" }
      };
      response = `I have added ${name} to your customer list.`;
    } else {
      response = "Sure, I can add a customer. Please say 'Add customer [Name]'.";
    }
  }

  // 5. Default Business Greeting
  else if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
    response = "Hello! I am Einstein, your business assistant. Ask me about your sales, inventory, or customers.";
  }

  else {
    response = "I am currently offline and can only answer basic queries about your Sales and Inventory. Please check your API Key configuration for full intelligence.";
  }

  return {
    response,
    action,
    intent: action ? action.type : 'chat'
  };
}

// --- ACTION EXECUTOR (FIREBASE) ---

async function executeAction(action: { type: string, data: any }) {
  const user = auth.currentUser;
  let userId = user?.uid;
  if (!userId) {
    const session = localStorage.getItem('revonn-staff-session');
    if (session) {
      try {
        userId = JSON.parse(session).ownerId;
      } catch (e) {
        console.error("Error parsing staff session", e);
      }
    }
  }
  if (!userId) throw new Error("No authenticated user");

  switch (action.type) {
    // ... (System Prompt Update part - handled in next tool call to keep chunks manageable)

    case 'create_invoice':
      // 1. Find/Create Customer (Smart Lookup by Phone OR Name)
      let customerId = 'walk-in';
      let customerName = action.data.customerName || "Walk-in";
      let customerPhone = action.data.customerPhone || "";

      // PERF: Fetch customers for this user (in-memory filter)
      const custQ = query(collection(db, 'customers'), where('user_id', '==', userId));
      const custSnap = await getDocs(custQ);

      let foundDoc;

      // Priority 1: Search by Phone (if provided)
      if (customerPhone) {
        foundDoc = custSnap.docs.find(d => d.data().phone === customerPhone);
      }

      // Priority 2: Search by Name (if no phone match)
      if (!foundDoc && action.data.customerName && action.data.customerName.toLowerCase() !== 'walk-in') {
        foundDoc = custSnap.docs.find(d => d.data().name.toLowerCase() === action.data.customerName.toLowerCase());
      }

      if (foundDoc) {
        // Update existing customer details if new info provided
        customerId = foundDoc.id;
        customerName = foundDoc.data().name; // Keep existing name unless explicit update requested (not implemented for simplicity)

        // If we found by name but have a new phone, update it
        if (!foundDoc.data().phone && customerPhone) {
          await updateDoc(doc(db, 'customers', customerId), { phone: customerPhone });
        }
      } else if (action.data.customerName && action.data.customerName.toLowerCase() !== 'walk-in') {
        // Create NEW customer
        const newCust = await addDoc(collection(db, 'customers'), {
          name: action.data.customerName,
          phone: customerPhone,
          user_id: userId,
          created_at: new Date().toISOString(),
          total_purchases: 0,
          total_dues: 0,
          tags: [],
          outstandingCredit: 0
        });
        customerId = newCust.id;
        customerName = action.data.customerName;
      }

      // 2. Process Items & Deduct Stock
      const invoiceItems = [];
      let total = 0;
      const invSnap = await getDocs(query(collection(db, 'inventory'), where('user_id', '==', userId)));
      const inventory = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const itemRequest of action.data.items || []) {
        const targetName = (itemRequest.name || '').toLowerCase().trim();
        if (!targetName) continue;
        const targetNameSingular = targetName.endsWith('s') ? targetName.slice(0, -1) : targetName;

        // Robust Matching Logic: Priority 1 - Exact, Priority 2 - Fuzzy
        let product = inventory.find((i: any) => i.name.toLowerCase() === targetName);

        if (!product) {
          const candidates = inventory.filter((i: any) => {
            const dbName = i.name.toLowerCase();
            return dbName.includes(targetName) ||
              targetName.includes(dbName) ||
              dbName.includes(targetNameSingular);
          });

          if (candidates.length === 1) {
            product = candidates[0];
          } else if (candidates.length > 1) {
            // Ambiguity strategy: Pick startMatch
            const startMatch = candidates.find((i: any) => i.name.toLowerCase().startsWith(targetName));
            if (startMatch) product = startMatch;
          }
        }

        // Debug Log
        console.log(`AI Matching: "${targetName}" -> Found: ${product ? (product as any).name : 'NULL'}`);

        let finalPrice = 0;
        let finalItemId = null;
        let finalItemName = itemRequest.name;

        if (product) {
          finalItemId = (product as any).id;
          finalItemName = (product as any).name; // Use DB name for consistency

          // Robust Price Lookup: Check price (legacy), sellingPrice (new), or variant price
          const variantPrice = (product as any).variants?.[0]?.price;
          const rawDbPrice = (product as any).sellingPrice || (product as any).price || variantPrice || 0;
          const dbPrice = Number(rawDbPrice) || 0;

          // Priority: User Specified > DB Price
          finalPrice = itemRequest.price ? Number(itemRequest.price) : dbPrice;

          // DEDUCT STOCK
          const variants = (product as any).variants || [];
          // Safety: default to normalized structure if empty
          const currentVariant = variants.length > 0 ? variants[0] : { size: 'Std', color: 'Any', stock: 0 };
          const currentStock = Number(currentVariant.stock) || 0;
          const newStock = Math.max(0, currentStock - (Number(itemRequest.quantity) || 1));

          // Construct SAFE variant update
          const updatedVariant = { ...currentVariant, stock: newStock };
          const updatedVariants = variants.length > 0 ? [updatedVariant, ...variants.slice(1)] : [updatedVariant];

          await updateDoc(doc(db, 'inventory', finalItemId), {
            variants: updatedVariants,
            quantity: newStock, // SYNC ROOT QUANTITY for UI compatibility
            sales_count: (Number((product as any).sales_count) || 0) + (Number(itemRequest.quantity) || 1),
            last_sold_at: new Date().toISOString()
          });
        } else {
          // Item not found in inventory
          console.warn(`Product not found for: ${itemRequest.name}`);
          finalPrice = Number(itemRequest.price) || 0;
        }

        const qty = Number(itemRequest.quantity) || 1;
        const lineTotal = finalPrice * qty;

        invoiceItems.push({
          itemId: finalItemId, // Can be null if ad-hoc item
          itemName: finalItemName,
          quantity: qty,
          unitPrice: finalPrice, // Important for UI to display rate
          price: finalPrice,     // Backwards compat
          total: lineTotal
        });
        total += lineTotal;
      }

      if (invoiceItems.length > 0) {
        await addDoc(collection(db, 'invoices'), {
          invoice_number: `INV-${Date.now().toString().substr(-6)}`,
          customerId,
          customer_name: customerName,
          customer_phone: customerPhone, // Save phone on invoice too
          items: invoiceItems,
          grandTotal: total,
          total: total, // COMPATIBILITY FIX
          totalTax: 0,
          status: 'completed',
          payment_mode: 'cash',
          created_at: new Date().toISOString(),
          user_id: userId
        });

        // Update Customer Stats (Purchases)
        if (customerId !== 'walk-in') {
          const custRef = doc(db, 'customers', customerId);
          const custDoc = await getDoc(custRef); // Fetch fresh to update safely
          if (custDoc.exists()) {
            const currentTotal = custDoc.data().total_purchases || 0;
            await updateDoc(custRef, {
              total_purchases: currentTotal + total,
              last_purchase_at: new Date().toISOString()
            });
          }
        }
      }
      break;

    case 'update_stock': // Replaces add_stock for unified +/- handling
    case 'add_stock':    // Keep for backward compatibility
      const invQ2 = query(collection(db, 'inventory'), where('user_id', '==', userId));
      const allInv2 = await getDocs(invQ2);

      // Normalize to array: Support both single item (legacy) and bulk items (new standard)
      const stockItemsToProcess = action.data.items || (action.data.name ? [action.data] : []);

      console.log("Processing Stock Update:", stockItemsToProcess);
      let processedCount = 0;

      for (const item of stockItemsToProcess) {
        let found2 = false;

        // Robust match: Priority 1 - Exact Match, Priority 2 - Fuzzy
        const targetStockName = (item.name || '').toLowerCase().trim();
        if (!targetStockName) {
          console.warn("Update Stock skipped: No item name provided for an item");
          continue;
        }

        // 1. Exact Match
        let targetStockItem = allInv2.docs.find(d => d.data().name.toLowerCase() === targetStockName);

        // 2. Singular/Plural Match
        if (!targetStockItem) {
          const targetSingular = targetStockName.endsWith('s') ? targetStockName.slice(0, -1) : targetStockName;
          const targetPlural = targetStockName + 's';
          targetStockItem = allInv2.docs.find(d => {
            const dbName = d.data().name.toLowerCase();
            return dbName === targetSingular || dbName === targetPlural;
          });
        }

        // 3. Substring / Token Match (If still not found)
        if (!targetStockItem && targetStockName.length > 3) {
          // A. Check if DB name matches target (e.g. DB "Maggi Noodles" matches Input "Maggi")
          targetStockItem = allInv2.docs.find(d => {
            const dbName = d.data().name.toLowerCase();
            return dbName.includes(targetStockName) || targetStockName.includes(dbName);
          });
        }

        if (targetStockItem) {
          // Update existing
          const currentVariant = targetStockItem.data().variants?.[0] || { size: 'Std', color: 'Any', price: targetStockItem.data().sellingPrice || 0 };
          const currentStock = Number(currentVariant.stock) || 0;
          const change = Number(item.quantity) || 0;
          const newStock = Math.max(0, currentStock + change);

          const updates: any = {
            variants: [{ ...currentVariant, stock: newStock }],
            quantity: newStock, // Sync root
            last_updated_at: new Date().toISOString()
          };

          // IF PRICE PROVIDED, UPDATE IT (Sync Root Price too)
          if (item.price) {
            const newPrice = Number(item.price);
            updates.sellingPrice = newPrice;
            updates.price = newPrice;
            updates.variants[0].price = newPrice;
          }

          await updateDoc(doc(db, 'inventory', targetStockItem.id), updates);
          toast.success(`Updated stock for ${targetStockItem.data().name}: ${currentStock} -> ${newStock}`);
          found2 = true;
        }

        if (!found2 && (Number(item.quantity) || 0) > 0) {
          // Create new ONLY if adding stock
          await addDoc(collection(db, 'inventory'), {
            name: item.name,
            category: 'General',
            sellingPrice: item.price || 0,
            price: item.price || 0, // SYNC ROOT PRICE
            costPrice: 0,
            variants: [{ size: 'Std', color: 'Any', stock: Number(item.quantity) || 0, price: item.price || 0 }],
            quantity: Number(item.quantity) || 0,
            lowStockThreshold: 5,
            user_id: userId,
            sales_count: 0,
            created_at: new Date().toISOString()
          });
          toast.success(`Added new item: ${item.name}`);
        }
        processedCount++;
      }

      if (processedCount === 0) {
        toast.info("No valid items found to update.");
      }
      break;

    case 'update_item':
      const updateQ = query(collection(db, 'inventory'), where('user_id', '==', userId));
      const updateSnap = await getDocs(updateQ);
      const updateTargetName = (action.data.name || '').toLowerCase().trim();
      if (!updateTargetName) break;

      let itemToUpdate = updateSnap.docs.find(d => d.data().name.toLowerCase() === updateTargetName);
      if (!itemToUpdate) {
        // Try singular/plural fallback
        const s = updateTargetName.endsWith('s') ? updateTargetName.slice(0, -1) : updateTargetName + 's';
        itemToUpdate = updateSnap.docs.find(d => d.data().name.toLowerCase() === s);
      }

      if (itemToUpdate) {
        const updates: any = { last_updated_at: new Date().toISOString() };
        if (action.data.newName) updates.name = action.data.newName;
        if (action.data.newPrice) {
          const newP = Number(action.data.newPrice);
          updates.sellingPrice = newP;
          updates.price = newP; // SYNC ROOT PRICE
          // Also update variant price
          const variants = itemToUpdate.data().variants || [];
          if (variants.length > 0) {
            updates.variants = [{ ...variants[0], price: newP }, ...variants.slice(1)];
          }
        }
        await updateDoc(doc(db, 'inventory', itemToUpdate.id), updates);
      }
      break;

    case 'delete_item':
      // DELETE Logic
      const delQ = query(collection(db, 'inventory'), where('user_id', '==', userId));
      const delSnap = await getDocs(delQ);
      const delTargetName = (action.data.name || '').toLowerCase().trim();

      if (!delTargetName) break;

      let itemToDelete = delSnap.docs.find(d => d.data().name.toLowerCase() === delTargetName);
      if (!itemToDelete) {
        // Try singular/plural fallback
        const s = delTargetName.endsWith('s') ? delTargetName.slice(0, -1) : delTargetName + 's';
        itemToDelete = delSnap.docs.find(d => d.data().name.toLowerCase() === s);
      }

      if (itemToDelete) {
        // deleteDoc is needed from firestore import, likely need to add it to imports if not there
        // Checking imports... 'deleteDoc' might be missing.
        // Assuming I'll fix imports in next step if needed, but for now using strict rule to add it.
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'inventory', itemToDelete.id));
      }
      break;

    case 'add_customer':
      await addDoc(collection(db, 'customers'), {
        name: action.data.name,
        phone: action.data.phone || '',
        user_id: userId,
        created_at: new Date().toISOString(),
        total_purchases: 0,
        total_dues: 0,
        tags: [],
        outstandingCredit: 0
      });
      break;
  }
}
