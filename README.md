# Revonn Business OS

A comprehensive Business Operating System for managing inventory, billing, customers, and AI-powered insights.

## Features
- **Smart Inventory**: Track stock, variants, and low-stock alerts.
- **Fast Billing**: Create professional invoices (A4/Thermal) in seconds.
- **Customer CRM**: Manage customer history and pending dues.
- **AI Assistant**: Voice-controlled actions and business insights.
- **Payment Integration**: Seamless UPI and Card payments via PhonePe.
- **Staff Management**: Role-based access control.

## Deployment (Netlify)
1.  Connect this repository to Netlify.
2.  Set the environment variables in Netlify "Site configuration":
    *   `PHONEPE_MERCHANT_ID`
    *   `PHONEPE_SALT_KEY`
    *   `PHONEPE_SALT_INDEX` (default: 1)
    *   `PHONEPE_ENV` (set to `production`)
    *   `VITE_SUPABASE_URL`
    *   `VITE_SUPABASE_PUBLISHABLE_KEY`
3.  Deploy!

## Local Development
To run this project locally, execute the following commands in order:

```bash
npm install
npm run dev
# To run the local backend server for payments:
npm run server
```

## Technologies
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- PhonePe API (Netlify Functions)
