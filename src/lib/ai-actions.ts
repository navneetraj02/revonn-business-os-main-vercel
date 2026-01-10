import { db as localDb } from '@/lib/database';
import { db as firestoreDb, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { InventoryItem, Invoice, Staff, Customer } from '@/types';

// --- Tool Definitions for Gemini ---

export const aiTools: any = [
    {
        functionDeclarations: [
            {
                name: "create_invoice",
                description: "Creates a new sales invoice/bill for a customer. Automatically creates customer if new.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        customerName: { type: "STRING", description: "Name of the customer" },
                        customerPhone: { type: "STRING", description: "Phone number of the customer" },
                        items: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    itemName: { type: "STRING" },
                                    quantity: { type: "NUMBER" },
                                    price: { type: "NUMBER", description: "Unit price if known, otherwise 0" }
                                },
                                required: ["itemName", "quantity"]
                            }
                        },
                        discount: { type: "NUMBER", description: "Discount amount in currency" }
                    },
                    required: ["customerName", "items"]
                }
            },
            {
                name: "add_inventory_item",
                description: "Adds a new product/item to the inventory stock.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING" },
                        category: { type: "STRING" },
                        price: { type: "NUMBER", description: "Selling price" },
                        costPrice: { type: "NUMBER", description: "Purchase cost" },
                        stock: { type: "NUMBER", description: "Initial quantity" },
                        lowStockThreshold: { type: "NUMBER" }
                    },
                    required: ["name", "price"]
                }
            },
            {
                name: "delete_inventory_item",
                description: "Deletes an item from inventory by name.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        itemName: { type: "STRING" }
                    },
                    required: ["itemName"]
                }
            },
            {
                name: "add_staff",
                description: "Register a new staff member.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING" },
                        role: { type: "STRING", description: "e.g., Sales, Manager, Helper" },
                        phone: { type: "STRING" },
                        salary: { type: "NUMBER" }
                    },
                    required: ["name", "role", "phone"]
                }
            }
        ]
    }
];

// --- Action Handlers ---

export class AIActionHandler {

    private async getUser(): Promise<{ uid: string }> {
        // 1. Check for Staff Session (Priority)
        const staffSessionStr = localStorage.getItem('revonn-staff-session');
        if (staffSessionStr) {
            try {
                const session = JSON.parse(staffSessionStr);
                if (session.ownerId) return { uid: session.ownerId };
            } catch (e) {
                console.warn("Invalid staff session");
            }
        }

        // 2. Fallback to Auth User
        const user = auth.currentUser;
        if (user) return { uid: user.uid };

        throw new Error("Authentication required. Please login.");
    }

    private generateId(prefix: string): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 1. Create Invoice
    async createInvoice(args: { customerName: string, customerPhone?: string, items: any[], discount?: number }) {
        console.log("Creating Invoice via AI...", args);

        try {
            const user = await this.getUser();
            const userId = user.uid;

            // A. Handle Customer (Find or Create)
            let customerId = 'walk-in';
            const phone = args.customerPhone?.trim();
            const name = args.customerName?.trim();

            if (phone) {
                // 1. Try to find by phone (Primary check)
                const existingCustomer = await localDb.customers.getByPhone(phone);
                if (existingCustomer) {
                    customerId = existingCustomer.id;
                }
            }

            // If not found by phone, but we have a name, create new customer
            // (Only if we didn't find one above)
            if (customerId === 'walk-in' && name) {
                // Create New Customer
                const newCustomer: any = {
                    id: this.generateId('cust'),
                    user_id: userId,
                    name: name,
                    phone: phone || null,
                    total_purchases: 0,
                    total_dues: 0,
                    created_at: new Date().toISOString()
                };

                // Write to Local & Firestore
                await localDb.customers.add(newCustomer);
                await addDoc(collection(firestoreDb, 'customers'), {
                    ...newCustomer,
                    created_at: new Date().toISOString()
                });

                customerId = newCustomer.id;
                console.log("Created new customer:", newCustomer.name);
            }

            // B. Resolve Items & Deduct Stock
            let resolvedItems = [];
            let subtotal = 0;
            const allInventory = await localDb.inventory.getAll();

            for (const itemReq of args.items) {
                const inventoryItem = allInventory.find(i => i.name.toLowerCase() === itemReq.itemName.toLowerCase());

                let finalPrice = itemReq.price || 0;
                let itemId = 'unknown';

                if (inventoryItem) {
                    itemId = inventoryItem.id;
                    if (finalPrice === 0) finalPrice = inventoryItem.sellingPrice;

                    // Deduct Stock Local
                    if (inventoryItem.variants && inventoryItem.variants.length > 0) {
                        inventoryItem.variants[0].stock = Math.max(0, inventoryItem.variants[0].stock - itemReq.quantity);
                        await localDb.inventory.update(inventoryItem);

                        // Update Firestore Inventory
                        try {
                            const q = query(collection(firestoreDb, 'inventory'), where('id', '==', inventoryItem.id));
                            const querySnapshot = await getDocs(q);
                            querySnapshot.forEach(async (docSnap) => {
                                const currentData = docSnap.data();
                                const newSalesCount = (currentData.sales_count || 0) + itemReq.quantity;
                                await updateDoc(doc(firestoreDb, 'inventory', docSnap.id), {
                                    variants: inventoryItem.variants,
                                    quantity: inventoryItem.variants.reduce((sum: number, v: any) => sum + v.stock, 0),
                                    sales_count: newSalesCount,
                                    last_sold_at: new Date().toISOString()
                                });
                            });
                        } catch (e) {
                            console.error("Failed to update stock in Firestore", e);
                        }
                    }
                }

                const total = finalPrice * itemReq.quantity;
                subtotal += total;

                resolvedItems.push({
                    id: itemId,
                    name: itemReq.itemName, // Dashboard expects 'name' or 'item_name'?
                    quantity: itemReq.quantity,
                    price: finalPrice,
                    total: total
                });
            }

            // C. Calculate Totals
            const discount = args.discount || 0;
            const taxRate = 0;
            const taxAmount = (subtotal - discount) * taxRate;
            const grandTotal = (subtotal - discount) + taxAmount;

            // D. Create Invoice Record
            // IMPORTANT: Fields must match what Dashboard.tsx expects (snake_case)
            const newInvoice: any = {
                id: this.generateId('inv'),
                user_id: userId,
                customer_id: customerId || null,
                invoice_number: `INV-${Date.now().toString().slice(-6)}`,
                customer_name: args.customerName,
                customer_phone: args.customerPhone || null,
                items: resolvedItems,
                total: grandTotal, // Dashboard uses 'total'
                subtotal: subtotal,
                tax_amount: taxAmount,
                discount: discount,
                created_at: new Date().toISOString(),
                status: 'completed', // 'paid' or 'completed'
                payment_mode: 'cash',
                amount_paid: grandTotal,
                due_amount: 0
            };

            // 1. Write to Local DB (for AI context & sync)
            await localDb.invoices.add(newInvoice);

            // 2. Write to Firestore (for Dashboard)
            await addDoc(collection(firestoreDb, 'invoices'), {
                ...newInvoice,
                created_at: new Date().toISOString() // Ensure string format
            });

            // Update Customer Purchase History (Local)
            if (customerId !== 'walk-in') {
                const cust: any = await localDb.customers.get(customerId);
                if (cust) {
                    cust.total_purchases = (cust.total_purchases || 0) + grandTotal;
                    await localDb.customers.update(cust);
                }
            }

            return {
                success: true,
                message: `✅ Created Bill for ${args.customerName}. Amount: ₹${grandTotal}`,
                invoiceId: newInvoice.id
            };

        } catch (e: any) {
            console.error("AI Create Invoice Error:", e);
            return { success: false, message: `Failed to create bill: ${e.message}` };
        }
    }

    // 2. Add or Update Inventory
    async addInventoryItem(args: { name: string, category?: string, price: number, costPrice?: number, stock?: number, lowStockThreshold?: number }) {
        try {
            const user = await this.getUser();

            // Check if item exists (Upsert Logic)
            const allItems = await localDb.inventory.getAll();
            const existingItem = allItems.find(i => i.name.toLowerCase() === args.name.toLowerCase());

            if (existingItem) {
                console.log(`Updating existing item: ${existingItem.name}`);

                // Update Price/Cost if provided
                if (args.price) existingItem.sellingPrice = args.price;
                if (args.costPrice) existingItem.purchasePrice = args.costPrice;

                // Add Stock
                const stockToAdd = args.stock || 0;
                if (stockToAdd > 0) {
                    if (existingItem.variants && existingItem.variants.length > 0) {
                        existingItem.variants[0].stock += stockToAdd;
                    } else {
                        // Fix structure if missing
                        existingItem.variants = [{
                            id: this.generateId('var'),
                            stock: stockToAdd,
                            size: 'Standard'
                        }];
                    }
                    // Update flat quantity field for dashboard (cast to any as it's not in Type)
                    (existingItem as any).quantity = ((existingItem as any).quantity || 0) + stockToAdd;
                }

                // Update Local
                await localDb.inventory.update(existingItem);

                // Update Firestore
                try {
                    const q = query(collection(firestoreDb, 'inventory'), where('id', '==', existingItem.id));
                    const querySnapshot = await getDocs(q);
                    querySnapshot.forEach(async (docSnap) => {
                        await updateDoc(doc(firestoreDb, 'inventory', docSnap.id), {
                            sellingPrice: existingItem.sellingPrice,
                            purchasePrice: existingItem.purchasePrice, // Sync purchasePrice
                            costPrice: (existingItem as any).costPrice, // Sync legacy/ai field if needed
                            variants: existingItem.variants,
                            quantity: (existingItem as any).quantity
                        });
                    });
                } catch (fsError) {
                    console.error("Firestore update failed", fsError);
                }

                return { success: true, message: `✅ Updated "${existingItem.name}". New Stock: ${(existingItem as any).quantity}` };
            }

            // Create New Item
            const newItem: any = {
                id: this.generateId('item'),
                user_id: user.uid,
                name: args.name,
                category: args.category || 'General',
                sellingPrice: args.price,
                costPrice: args.costPrice || 0,
                quantity: args.stock || 0, // Legacy/Dashboard field
                variants: [
                    {
                        id: this.generateId('var'),
                        stock: args.stock || 0,
                        size: 'Standard',
                        color: '',
                        sku: ''
                    }
                ],
                min_quantity: args.lowStockThreshold || 5,
                sales_count: 0,
                created_at: new Date().toISOString()
            };

            await localDb.inventory.add(newItem);
            await addDoc(collection(firestoreDb, 'inventory'), newItem);

            return { success: true, message: `✅ Added "${args.name}" to inventory.` };
        } catch (e: any) {
            return { success: false, message: `Failed to add item: ${e.message}` };
        }
    }

    // 3. Delete Inventory
    async deleteInventoryItem(args: { itemName: string }) {
        try {
            // Local delete only for now, safer
            const allItems = await localDb.inventory.getAll();
            const targets = allItems.filter(i => i.name.toLowerCase() === args.itemName.toLowerCase());

            if (targets.length === 0) {
                return { success: false, message: `Item "${args.itemName}" not found.` };
            }

            for (const item of targets) {
                // Delete from Local DB
                await localDb.inventory.delete(item.id);

                // Delete from Firestore
                try {
                    const q = query(collection(firestoreDb, 'inventory'), where('id', '==', item.id));
                    const querySnapshot = await getDocs(q);
                    querySnapshot.forEach(async (docSnap) => {
                        await deleteDoc(doc(firestoreDb, 'inventory', docSnap.id));
                    });
                } catch (fsError) {
                    console.error("Error deleting from Firestore:", fsError);
                    // Contribute to success but warn
                }
            }
            return { success: true, message: `🗑️ Deleted ${targets.length} item(s) named "${args.itemName}".` };
        } catch (e: any) {
            return { success: false, message: `Failed to delete item: ${e.message}` };
        }
    }

    // 4. Add Staff
    async addStaff(args: { name: string, role: string, phone: string, salary?: number }) {
        try {
            const user = await this.getUser();
            const newStaff: any = {
                id: this.generateId('staff'),
                user_id: user.uid,
                name: args.name,
                role: args.role,
                phone: args.phone,
                salary: args.salary || 0,
                created_at: new Date().toISOString()
            };

            await localDb.staff.add(newStaff);
            await addDoc(collection(firestoreDb, 'staff'), newStaff);

            return { success: true, message: `✅ Staff member ${args.name} added.` };
        } catch (e: any) {
            return { success: false, message: `Failed to add staff: ${e.message}` };
        }
    }


    // Generic Execute
    async executeToolCall(functionName: string, args: any) {
        console.log(`Executing AI Action: ${functionName}`, args);
        try {
            switch (functionName) {
                case 'create_invoice': return await this.createInvoice(args);
                case 'add_inventory_item': return await this.addInventoryItem(args);
                case 'delete_inventory_item': return await this.deleteInventoryItem(args);
                case 'add_staff': return await this.addStaff(args);
                default: return { success: false, message: "Unknown function" };
            }
        } catch (e: any) {
            console.error("Action Failed:", e);
            return { success: false, message: `Action failed: ${e.message}` };
        }
    }
}

export const aiActions = new AIActionHandler();
