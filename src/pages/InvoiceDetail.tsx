import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Download,
  Share2,
  FileText,
  User,
  Phone,
  Calendar,
  IndianRupee,
  Package
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAppStore } from '@/store/app-store';
import { useLanguage } from '@/contexts/LanguageContext';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

interface InvoiceData {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: any[];
  subtotal: number;
  tax_amount: number;
  discount: number;
  total?: number;
  grandTotal?: number; // Compat
  payment_mode: string;
  amount_paid: number;
  due_amount: number;
  status: string;
  created_at: string;
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { shopSettings } = useAppStore();
  const { t, language } = useLanguage();
  const isHindi = language === 'hi';
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadInvoice(id);
    }
  }, [id]);

  const loadInvoice = async (invoiceId: string) => {
    try {
      const docRef = doc(db, 'invoices', invoiceId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const items = Array.isArray(data.items) ? data.items : [];
        setInvoice({ id: docSnap.id, ...data, items } as InvoiceData);
      } else {
        console.error('Invoice not found');
        setInvoice(null);
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      setInvoice(null);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = (): Blob | null => {
    if (!invoice) return null;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // Colors
    const primaryColor = [218, 165, 32]; // Gold
    const darkColor = [33, 33, 33];
    const grayColor = [128, 128, 128];

    let y = margin;

    // ===== HEADER: REVONN BRANDING =====
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('REVONN', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('AI-Powered Business OS', pageWidth / 2, 28, { align: 'center' });

    y = 45;

    // ===== STORE DETAILS =====
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(shopSettings.shopName || 'Your Store', pageWidth / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);

    if (shopSettings.address) {
      doc.text(shopSettings.address, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
    if (shopSettings.phone) {
      doc.text(`Phone: ${shopSettings.phone}`, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
    if (shopSettings.gstin) {
      doc.text(`GSTIN: ${shopSettings.gstin}`, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }

    y += 5;

    // ===== TAX INVOICE TITLE =====
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageWidth / 2, y + 7, { align: 'center' });
    y += 18;

    // ===== INVOICE DETAILS ROW =====
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('Invoice No:', margin, y);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.invoice_number, margin + 25, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    const dateText = `Date: ${new Date(invoice.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })}`;
    doc.text(dateText, pageWidth - margin - doc.getTextWidth(dateText), y);
    y += 12;

    // ===== CUSTOMER DETAILS =====
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, y - 3, contentWidth, 25, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.rect(margin, y - 3, contentWidth, 25, 'S');

    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('BILL TO:', margin + 5, y + 3);

    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(invoice.customer_name || 'Walk-in Customer', margin + 5, y + 11);

    if (invoice.customer_phone) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Phone: ${invoice.customer_phone}`, margin + 5, y + 18);
    }
    y += 30;

    // ===== ITEMS TABLE HEADER =====
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(margin, y, contentWidth, 10, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');

    const colWidths = {
      item: 70,
      size: 25,
      qty: 20,
      rate: 30,
      amount: 35
    };

    let colX = margin + 3;
    doc.text('Item', colX, y + 7);
    colX += colWidths.item;
    doc.text('Size', colX, y + 7);
    colX += colWidths.size;
    doc.text('Qty', colX, y + 7);
    colX += colWidths.qty;
    doc.text('Rate', colX, y + 7);
    colX += colWidths.rate;
    doc.text('Amount', colX, y + 7);
    y += 12;

    // ===== ITEMS TABLE BODY =====
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    items.forEach((item: any, index: number) => {
      const itemName = (item.itemName || item.name || 'Item').substring(0, 30);
      const size = item.size || '-';
      const qty = item.quantity || 1;
      const rate = item.unitPrice || item.price || 0;
      const amount = item.total || (qty * rate);

      // Alternate row background
      if (index % 2 === 0) {
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, y - 3, contentWidth, 8, 'F');
      }

      colX = margin + 3;
      doc.text(itemName, colX, y + 2);
      colX += colWidths.item;
      doc.text(size, colX, y + 2);
      colX += colWidths.size;
      doc.text(qty.toString(), colX, y + 2);
      colX += colWidths.qty;
      doc.text(formatNumber(rate), colX, y + 2);
      colX += colWidths.rate;
      doc.text(formatNumber(amount), colX, y + 2);
      y += 8;
    });

    y += 5;

    // ===== SEPARATOR LINE =====
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // ===== TOTALS SECTION =====
    const totalsX = pageWidth - margin - 80;

    // Subtotal
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalsX, y);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`₹${formatNumber(invoice.subtotal || invoice.total)}`, totalsX + 50, y);
    y += 7;

    // Discount
    if (invoice.discount > 0) {
      doc.setTextColor(46, 125, 50); // Green
      doc.text('Discount:', totalsX, y);
      doc.text(`-₹${formatNumber(invoice.discount)}`, totalsX + 50, y);
      y += 7;
    }

    // Tax
    if (invoice.tax_amount > 0) {
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text('GST:', totalsX, y);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text(`₹${formatNumber(invoice.tax_amount)}`, totalsX + 50, y);
      y += 7;
    }

    y += 3;

    // Grand Total Box
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(totalsX - 5, y - 5, 85, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('GRAND TOTAL:', totalsX, y + 4);
    doc.text(`₹${formatNumber(invoice.total || invoice.grandTotal || 0)}`, totalsX + 50, y + 4);
    y += 18;

    // ===== PAYMENT INFO =====
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const paymentY = y;
    doc.text(`Payment: ${(invoice.payment_mode || 'cash').toUpperCase()}`, margin, paymentY);

    if (invoice.amount_paid > 0) {
      doc.text(`Paid: ₹${formatNumber(invoice.amount_paid)}`, margin + 60, paymentY);
    }

    if (invoice.due_amount > 0) {
      doc.setTextColor(211, 47, 47); // Red
      doc.text(`Due: ₹${formatNumber(invoice.due_amount)}`, margin + 110, paymentY);
    }

    const statusText = `Status: ${(invoice.status || 'completed').toUpperCase()}`;
    doc.setTextColor(invoice.status === 'completed' ? 46 : 255, invoice.status === 'completed' ? 125 : 152, invoice.status === 'completed' ? 50 : 0);
    doc.text(statusText, pageWidth - margin - doc.getTextWidth(statusText), paymentY);

    y += 15;

    // ===== THANK YOU MESSAGE =====
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('Thank you for your business!', pageWidth / 2, y, { align: 'center' });

    // ===== FOOTER =====
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Powered by Revonn', pageWidth / 2, footerY, { align: 'center' });

    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('www.revonn.app | AI-Powered Business OS for Indian SMBs', pageWidth / 2, footerY + 5, { align: 'center' });

    return doc.output('blob');
  };

  const handleDownload = () => {
    const pdfBlob = generatePDF();
    if (pdfBlob && invoice) {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(isHindi ? 'इनवॉयस डाउनलोड हो गया!' : 'Invoice downloaded!');
    }
  };

  const handleShare = async () => {
    const pdfBlob = generatePDF();
    if (pdfBlob && invoice) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.invoice_number}`,
          text: `Invoice from ${shopSettings.shopName}\nTotal: ${formatCurrency(invoice.total)}`,
          files: [new File([pdfBlob], `${invoice.invoice_number}.pdf`, { type: 'application/pdf' })]
        });
      } catch (error) {
        handleDownload();
      }
    }
  };

  if (isLoading) {
    return (
      <AppLayout title={t('invoice')} hideNav>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout title={t('invoice')} hideNav>
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-foreground">{t('invoice_not_found')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isHindi ? 'यह इनवॉयस मौजूद नहीं है।' : 'This invoice may have been deleted or doesn\'t exist.'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-primary font-medium"
          >
            {t('back')}
          </button>
        </div>
      </AppLayout>
    );
  }

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <AppLayout title={t('invoice_details') || 'Invoice Details'} hideNav>
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-secondary"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{invoice.invoice_number}</h1>
              <p className="text-sm text-muted-foreground">
                {new Date(invoice.created_at).toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-secondary"
            >
              <Download className="w-5 h-5 text-muted-foreground" />
            </button>
            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-primary text-primary-foreground"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer Info Card */}
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-secondary">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {invoice.customer_name || t('walk_in_customer')}
              </p>
              {invoice.customer_phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {invoice.customer_phone}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-secondary/50 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('items')} ({items.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {items.map((item: any, index: number) => (
              <div key={item.id || index} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{item.itemName || item.name || 'Item'}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.size && `${t('size')}: ${item.size} • `}
                    {formatCurrency(item.unitPrice || item.price || 0)} × {item.quantity || 1}
                  </p>
                </div>
                <p className="font-semibold text-foreground">{formatCurrency(item.total || (item.quantity * (item.unitPrice || item.price || 0)))}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bill Summary */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
            <IndianRupee className="w-4 h-4" />
            {t('bill_summary')}
          </h3>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('subtotal')}</span>
            <span>{formatCurrency(invoice.subtotal || invoice.total || invoice.grandTotal || 0)}</span>
          </div>

          {invoice.discount > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>{t('discount')}</span>
              <span>-{formatCurrency(invoice.discount)}</span>
            </div>
          )}

          {invoice.tax_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST</span>
              <span>{formatCurrency(invoice.tax_amount)}</span>
            </div>
          )}

          <div className="pt-3 border-t border-border flex justify-between">
            <span className="text-lg font-bold text-foreground">{t('grand_total')}</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(invoice.total || invoice.grandTotal || 0)}</span>
          </div>

          <div className="flex justify-between text-sm pt-2">
            <span className="text-muted-foreground">{t('payment_mode')}</span>
            <span className="capitalize font-medium">{invoice.payment_mode || 'cash'}</span>
          </div>

          {invoice.amount_paid > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('amount_received')}</span>
              <span className="font-medium text-success">{formatCurrency(invoice.amount_paid)}</span>
            </div>
          )}

          {invoice.due_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('due')}</span>
              <span className="font-medium text-destructive">{formatCurrency(invoice.due_amount)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={`font-medium ${invoice.status === 'completed' ? 'text-success' : 'text-warning'}`}>
              {(invoice.status || 'completed').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 py-3 px-4 rounded-xl bg-secondary text-secondary-foreground font-medium flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t('download_pdf')}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 py-3 px-4 rounded-xl btn-gold font-medium flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            {t('share_whatsapp')}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
