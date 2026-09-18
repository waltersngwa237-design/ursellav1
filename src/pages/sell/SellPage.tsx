import React, { useState, useEffect, useMemo } from 'react';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { ProductService } from '../../services/product.service.ts';
import { SalesService } from '../../services/sales.service.ts';
import { CustomerService } from '../../services/customer.service.ts';
import { Card } from '../../components/common/Card.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { ReceiptModal } from '../../components/sales/ReceiptModal.tsx';
import { SaleDetailModal } from '../../components/sales/SaleDetailModal.tsx';
import {
  CURRENCY_MAP,
  type ProductWithCategory,
  type ProductCategory,
  type CustomerWithSummary,
  type CartItem,
  type SaleWithDetails,
  type PaymentMethodType,
  type PaymentStatusType,
} from '../../types/index.ts';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  CheckCircle2,
  Clock,
  Receipt,
  Tag,
  AlertCircle,
  History,
  X,
  Printer,
  Lock,
  QrCode,
} from 'lucide-react';
import { PDFAndPrintService } from '../../services/pdf.service.ts';
import { HardwarePrinterService } from '../../services/hardware-printer.service.ts';
import { HardwareSettingsModal } from '../../components/hardware/HardwareSettingsModal.tsx';
import { RegisterCloseoutModal } from '../../components/reports/RegisterCloseoutModal.tsx';
import { BarcodeScannerModal } from '../../components/scanner/BarcodeScannerModal.tsx';
import { IndexedDBService } from '../../services/indexed-db.service.ts';
import { calculateCartTotals, calculateChangeDue, roundToDecimals } from '../../utils/currency-math.ts';
import { verifyManagerPin, getMaxAllowedDiscount } from '../../utils/rbac.ts';

export const SellPage: React.FC = () => {
  const { activeBusiness, currency, effectiveRole } = useBusiness();
  const { language, t } = useLanguage();
  const isFr = language === 'fr';
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [isRegisterCloseoutOpen, setIsRegisterCloseoutOpen] = useState(false);

  // Discount RBAC & Manager Override
  const [isManagerDiscountApprovalOpen, setIsManagerDiscountApprovalOpen] = useState(false);
  const [managerDiscountPin, setManagerDiscountPin] = useState('');
  const [managerDiscountError, setManagerDiscountError] = useState<string | null>(null);
  const [isDiscountOverrideApproved, setIsDiscountOverrideApproved] = useState(false);

  // Products & Categories
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [customers, setCustomers] = useState<CustomerWithSummary[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Filters for POS Catalog
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Processing & Modals
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<SaleWithDetails | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // New Customer Inline Modal
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [creatingCust, setCreatingCust] = useState(false);

  // Sales History Tab State
  const [salesHistory, setSalesHistory] = useState<SaleWithDetails[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<PaymentStatusType | 'all'>('all');
  const [selectedHistorySale, setSelectedHistorySale] = useState<SaleWithDetails | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Load Data
  const loadData = async () => {
    if (!activeBusiness?.id) return;
    setLoadingCatalog(true);
    try {
      const [prods, cats, custs] = await Promise.all([
        ProductService.getProducts(activeBusiness.id, { isActive: true }),
        ProductService.getCategories(activeBusiness.id),
        CustomerService.getCustomers(activeBusiness.id, { isActive: true }),
      ]);
      setProducts(prods);
      setCategories(cats);
      setCustomers(custs);

      // Async index to IndexedDB for instant sub-millisecond barcode & text searches
      IndexedDBService.cacheProducts(
        activeBusiness.id,
        prods.map((p) => ({
          id: p.id,
          business_id: activeBusiness.id,
          name: p.name,
          sku: p.sku,
          selling_price: p.selling_price,
          cost_price: p.cost_price,
          stock_quantity: p.stock_quantity,
          category_id: p.category_id,
          category_name: p.category?.name,
          updated_at: p.updated_at,
        }))
      );
      IndexedDBService.cacheCustomers(
        activeBusiness.id,
        custs.map((c) => ({
          id: c.id,
          business_id: activeBusiness.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          outstanding_balance: c.outstanding_balance,
          updated_at: c.updated_at,
        }))
      );
    } catch (err) {
      console.error('Failed to load POS data:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const loadSalesHistory = async () => {
    if (!activeBusiness?.id) return;
    setHistoryLoading(true);
    try {
      const sales = await SalesService.getSales(activeBusiness.id, {
        paymentStatus: historyStatusFilter,
        search: historySearch,
        limit: 100,
      });
      setSalesHistory(sales);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadSalesHistory();
    }
  }, [activeTab, activeBusiness?.id, historyStatusFilter, historySearch]);

  // Keyboard shortcut: F2 toggles the Barcode/QR scanner modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setIsScannerOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered Products for Catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory =
        selectedCategory === 'all' || p.category_id === selectedCategory;

      return matchSearch && matchCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Cart Calculations with Floating-Point Precision Guard
  const cartTotals = useMemo(() => {
    return calculateCartTotals(
      cart.map((i) => ({
        id: i.product.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount || 0,
      })),
      0, // Tax handled at line/sale level
      Number(discountAmount) || 0,
      2
    );
  }, [cart, discountAmount]);

  const cartSubtotal = cartTotals.subtotal;
  const cartTotal = cartTotals.total;

  // Auto set amount paid to total if empty or user clicks exact
  const effectiveAmountPaid = useMemo(() => {
    if (amountPaidInput === '') {
      return cartTotal;
    }
    return roundToDecimals(Number(amountPaidInput) || 0, 2);
  }, [amountPaidInput, cartTotal]);

  const changeCalculation = useMemo(() => {
    return calculateChangeDue(cartTotal, effectiveAmountPaid, 2);
  }, [cartTotal, effectiveAmountPaid]);

  const changeDue = changeCalculation.change;
  const balanceDue = changeCalculation.remainingDue;

  // Cart Handlers
  const addToCart = (product: ProductWithCategory) => {
    const isService = product.product_type === 'service';
    if (!isService && product.stock_quantity <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (!isService && existing.quantity >= product.stock_quantity) {
          // Cannot add more than current stock for physical products
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            unit_price: product.selling_price,
            discount: 0,
          },
        ];
      }
    });
  };

  const updateCartQuantity = (productId: string, newQty: number) => {
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const isService = item.product.product_type === 'service';
    if (!isService && newQty > item.product.stock_quantity) {
      // Limit to max stock for physical products
      return;
    }

    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setIsDiscountOverrideApproved(false);
    setAmountPaidInput('');
    setPaymentReference('');
    setSaleNotes('');
    setSaleError(null);
  };

  // Submit Sale Handler
  const handleCompleteSale = async () => {
    if (!activeBusiness?.id) return;
    if (cart.length === 0) {
      setSaleError(isFr ? 'Le panier est vide. Sélectionnez des articles.' : 'Cart is empty. Select products to sell.');
      return;
    }

    // Role-based discount authorization check
    const maxAllowedDiscountPct = getMaxAllowedDiscount(effectiveRole);
    const currentDiscountPct = cartSubtotal > 0 ? (Number(discountAmount) / cartSubtotal) * 100 : 0;
    if (currentDiscountPct > maxAllowedDiscountPct && !isDiscountOverrideApproved) {
      setIsManagerDiscountApprovalOpen(true);
      return;
    }

    setIsSubmittingSale(true);
    setSaleError(null);

    try {
      const saleItems = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount || 0,
      }));

      const finalAmountPaid =
        amountPaidInput === '' ? cartTotal : Number(amountPaidInput) || 0;

      const { sale_id, error } = await SalesService.processSale({
        business_id: activeBusiness.id,
        customer_id: selectedCustomerId || null,
        items: saleItems,
        discount: Number(discountAmount) || 0,
        tax: 0,
        payment_amount: finalAmountPaid,
        payment_method: paymentMethod,
        payment_reference: paymentReference || null,
        notes: saleNotes || null,
      });

      if (error || !sale_id) {
        throw error || new Error(isFr ? 'La vente n’a pas pu être finalisée.' : 'Sale could not be completed.');
      }

      // Fetch the full newly completed sale record for the receipt
      const detail = await SalesService.getSaleDetail(activeBusiness.id, sale_id);
      setCompletedSale(detail);
      setIsReceiptOpen(true);

      // Peripheral hardware automations
      const hwSettings = HardwarePrinterService.getSettings();
      if (hwSettings.autoKickDrawerOnCash && paymentMethod === 'cash') {
        HardwarePrinterService.kickCashDrawer();
      }
      if (hwSettings.autoPrintOnSale && detail) {
        HardwarePrinterService.printThermalReceipt(detail, activeBusiness, currencyConfig);
      }

      // Refresh catalog stock
      loadData();
      clearCart();
    } catch (err: any) {
      setSaleError(err?.message || (isFr ? 'Échec de l’encaissement.' : 'Failed to process sale.'));
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Quick Customer Creation
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id || !newCustName.trim()) return;

    setCreatingCust(true);
    try {
      const newCust = await CustomerService.createCustomer({
        business_id: activeBusiness.id,
        name: newCustName.trim(),
        phone: newCustPhone.trim() || null,
        email: newCustEmail.trim() || null,
      });

      setCustomers((prev) => [
        {
          ...newCust,
          total_spent: 0,
          purchase_count: 0,
          last_purchase_at: null,
          outstanding_balance: 0,
        },
        ...prev,
      ]);
      setSelectedCustomerId(newCust.id);
      setIsNewCustomerModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
    } catch (err: any) {
      console.error('Error creating customer:', err);
    } finally {
      setCreatingCust(false);
    }
  };

  const selectedCustomerObj = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
              {isFr ? 'Point de Vente' : 'Point of Sale'}
            </h1>
            <Badge variant="emerald" size="sm">
              {isFr ? 'Caisse En Direct' : 'Live Register'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {isFr ? 'Terminal de caisse connecté pour' : 'Real-time sales terminal for'}{' '}
            <strong className="text-zinc-200">{activeBusiness?.name}</strong>
          </p>
        </div>

        {/* View Switcher Tabs & Hardware Configuration */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 self-start sm:self-auto">
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'pos'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span>{isFr ? 'Caisse' : 'Terminal'}</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>{isFr ? 'Historique' : 'History'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsHardwareModalOpen(true)}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer shrink-0"
            title={isFr ? 'Paramètres Imprimante' : 'Printer & Hardware Settings'}
          >
            <Printer className="w-4 h-4 text-emerald-400" />
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRegisterCloseoutOpen(true)}
            className="flex items-center gap-1.5 border-zinc-800 bg-zinc-900 text-zinc-200 hover:text-white cursor-pointer px-2.5 sm:px-3 shrink-0"
            title={isFr ? 'Clôture de caisse & Rapport Z' : 'Open Register Audit & End-of-Day Closeout (Z-Report)'}
          >
            <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">{isFr ? 'Clôture Caisse' : 'Z-Report'}</span>
          </Button>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="capitalize font-semibold text-zinc-300">{effectiveRole}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* POS TERMINAL VIEW                                                         */}
      {/* ========================================================================= */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CATALOG COLUMN (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Barcode/QR Scanner Trigger */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder={t.pos.searchProductsPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScannerOpen(true)}
                title={isFr ? 'Scanner un code-barres ou QR code (F2)' : 'Scan barcode or QR code (F2)'}
                className="flex items-center gap-1.5 border-zinc-800 bg-zinc-900 text-zinc-200 hover:text-white hover:border-emerald-500/50 hover:bg-zinc-800/90 px-3 py-2.5 rounded-xl shrink-0 cursor-pointer transition-colors shadow-xs"
              >
                <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold text-xs">{isFr ? 'Scanner' : 'Scan'}</span>
                <kbd className="hidden sm:inline-block px-1 py-0.5 text-[9px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700/60 rounded">
                  F2
                </kbd>
              </Button>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full overscroll-x-contain touch-pan-x">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-zinc-100 text-zinc-950 font-bold shadow'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {t.pos.allCategories} ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Product Cards Grid */}
            {loadingCatalog ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-32 rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800"
                  />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <Card className="text-center py-12 space-y-2">
                <Tag className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-sm font-semibold text-zinc-300">{isFr ? 'Aucun produit trouvé' : 'No products found'}</p>
                <p className="text-xs text-zinc-500">
                  {searchQuery || selectedCategory !== 'all'
                    ? (isFr ? 'Essayez de modifier votre recherche ou filtre.' : 'Try adjusting your search or category filter.')
                    : (isFr ? 'Ajoutez des articles dans le catalogue pour commencer à encaisser.' : 'Add products in the Business Catalog tab to start selling.')}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredProducts.map((product) => {
                  const inCartItem = cart.find((i) => i.product.id === product.id);
                  const isService = product.product_type === 'service';
                  const isOutOfStock = !isService && product.stock_quantity <= 0;
                  const isLowStock =
                    !isService &&
                    product.stock_quantity > 0 &&
                    product.stock_quantity <= product.minimum_stock_level;

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between select-none relative group ${
                        isOutOfStock
                          ? 'bg-zinc-900/30 border-zinc-800/40 opacity-50 cursor-not-allowed'
                          : inCartItem
                          ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500 cursor-pointer shadow-sm shadow-emerald-950/20'
                          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 cursor-pointer active:scale-98'
                      }`}
                    >
                      {/* In-Cart Quantity Indicator Badge */}
                      {inCartItem && (
                        <div className="absolute top-2 right-2 px-1.5 min-w-[24px] h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-lg animate-in zoom-in-50">
                          {inCartItem.quantity}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between gap-1">
                          {product.category ? (
                            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block truncate">
                              {product.category.name}
                            </span>
                          ) : <span />}
                          {isService && (
                            <span className="text-[9px] font-bold text-blue-400 bg-blue-950/40 border border-blue-800/50 px-1.5 py-0.5 rounded">
                              {isFr ? 'Service' : 'Service'}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-zinc-100 mt-0.5 line-clamp-2 leading-tight">
                          {product.name}
                        </h4>
                        {product.sku && (
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {product.sku}
                          </span>
                        )}
                      </div>

                      <div className="pt-3 mt-2 border-t border-zinc-800/60 flex items-center justify-between">
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-emerald-400">
                            {currencyConfig.format(product.selling_price)}
                          </p>
                          <div className="mt-0.5">
                            {isService ? (
                              <span className="text-[10px] font-medium text-blue-400">
                                {isFr ? 'Service (Sans limite de stock)' : 'Service (No stock limit)'}
                              </span>
                            ) : isOutOfStock ? (
                              <span className="text-[10px] font-bold text-rose-400">
                                {isFr ? 'Rupture' : 'Out of stock'}
                              </span>
                            ) : isLowStock ? (
                              <span className="text-[10px] font-semibold text-amber-400">
                                {product.stock_quantity} {product.unit_of_measure || (isFr ? 'pièce' : 'piece')} {isFr ? 'Faible' : 'Low stock'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-400">
                                {isFr ? 'Stock' : 'Stock'}: {product.stock_quantity} {product.unit_of_measure || (isFr ? 'pièce' : 'piece')}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          disabled={isOutOfStock}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            isOutOfStock
                              ? 'bg-zinc-800 text-zinc-600'
                              : inCartItem
                              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/40'
                              : 'bg-zinc-800 text-zinc-300 group-hover:bg-emerald-600 group-hover:text-white'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CART & CHECKOUT COLUMN (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-4">
            <Card id="pos_cart_container" className="p-4 sm:p-5 border-zinc-800 bg-zinc-900/90 backdrop-blur-md space-y-4 sticky top-20 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {isFr ? 'Commande en cours' : 'Current Order'}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={cart.length > 0 ? 'emerald' : 'zinc'}>
                    {cart.reduce((s, i) => s + i.quantity, 0)} {t.pos.itemsCount}
                  </Badge>
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      title={isFr ? 'Vider le panier' : 'Clear cart'}
                      className="text-xs text-zinc-400 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                  <label className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{isFr ? 'Client' : 'Customer'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerModalOpen(true)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> {isFr ? 'Nouveau' : 'New'}
                  </button>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">{t.pos.walkInCustomer}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{' '}
                      {c.outstanding_balance > 0
                        ? `[${isFr ? 'Dette' : 'Debt'}: ${currencyConfig.format(c.outstanding_balance)}]`
                        : ''}
                    </option>
                  ))}
                </select>

                {/* Outstanding balance warning for selected customer */}
                {selectedCustomerObj && selectedCustomerObj.outstanding_balance > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 stroke-[1.75]" />
                      <span>{isFr ? 'Dette en cours' : 'Outstanding Debt'}:</span>
                    </span>
                    <strong className="font-bold font-mono">
                      {currencyConfig.format(selectedCustomerObj.outstanding_balance)}
                    </strong>
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs space-y-1">
                    <ShoppingCart className="w-7 h-7 mx-auto opacity-30" />
                    <p>{t.pos.cartEmpty}</p>
                    <p className="text-[10px] text-zinc-400">{isFr ? 'Cliquez sur les articles pour les ajouter au panier' : 'Click products to add to current ticket'}</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-zinc-200 truncate">{item.product.name}</p>
                        <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                          {currencyConfig.format(item.unit_price)}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, Math.max(0, item.quantity - 1))}
                          className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0.0001"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              updateCartQuantity(item.product.id, val);
                            }
                          }}
                          className="w-11 text-center font-bold text-zinc-100 text-xs bg-transparent border-none focus:outline-none p-0"
                        />
                        <span className="text-[10px] text-zinc-400 select-none pr-0.5">
                          {item.product.unit_of_measure || (isFr ? 'pièce' : 'piece')}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.product.product_type !== 'service' && item.quantity >= item.product.stock_quantity}
                          className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-bold text-zinc-100 w-16 text-right whitespace-nowrap">
                        {currencyConfig.format(item.unit_price * item.quantity)}
                      </span>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Discount and Payment Settings */}
              {cart.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-zinc-800 text-xs">
                  {/* Discount Field */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-zinc-400 flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" /> {isFr ? 'Remise' : 'Discount'}:
                        </label>
                        {effectiveRole === 'cashier' && (
                          <span className="text-[10px] text-zinc-500 font-mono">({isFr ? 'Max 10%' : 'Max 10%'})</span>
                        )}
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          placeholder="0"
                          value={discountAmount || ''}
                          onChange={(e) => {
                            setDiscountAmount(Math.max(0, Number(e.target.value) || 0));
                            setIsDiscountOverrideApproved(false);
                          }}
                          className={`w-full bg-zinc-950 border rounded-lg px-2.5 py-1 text-right text-xs font-semibold focus:outline-none ${
                            cartSubtotal > 0 &&
                            (Number(discountAmount) / cartSubtotal) * 100 > getMaxAllowedDiscount(effectiveRole) &&
                            !isDiscountOverrideApproved
                              ? 'border-amber-500/60 text-amber-300'
                              : 'border-zinc-800 text-zinc-100 focus:border-emerald-500'
                          }`}
                        />
                      </div>
                    </div>
                    {cartSubtotal > 0 &&
                      (Number(discountAmount) / cartSubtotal) * 100 > getMaxAllowedDiscount(effectiveRole) && (
                        <div className="flex items-center justify-between text-[11px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {isDiscountOverrideApproved
                              ? (isFr ? 'Dérogation responsable validée' : 'Manager override approved')
                              : (isFr ? `Remise supérieure à la limite de ${getMaxAllowedDiscount(effectiveRole)}%` : `Discount exceeds ${getMaxAllowedDiscount(effectiveRole)}% limit`)}
                          </span>
                          {!isDiscountOverrideApproved && (
                            <button
                              type="button"
                              onClick={() => setIsManagerDiscountApprovalOpen(true)}
                              className="font-bold underline hover:text-amber-300 ml-1 cursor-pointer"
                            >
                              {isFr ? 'Code PIN' : 'Enter PIN'}
                            </button>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 flex items-center gap-1 font-semibold">
                      <CreditCard className="w-3.5 h-3.5" /> {t.pos.paymentMethod}:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { id: 'cash', label: isFr ? 'Espèces' : 'Cash', icon: <Banknote className="w-3.5 h-3.5 shrink-0" /> },
                        {
                          id: 'mobile_money',
                          label: isFr ? 'Mobile Money' : 'MoMo',
                          icon: <Smartphone className="w-3.5 h-3.5 shrink-0" />,
                        },
                        {
                          id: 'bank_transfer',
                          label: isFr ? 'Virement' : 'Bank',
                          icon: <Building2 className="w-3.5 h-3.5 shrink-0" />,
                        },
                        { id: 'card', label: isFr ? 'Carte' : 'Card', icon: <CreditCard className="w-3.5 h-3.5 shrink-0" /> },
                        { id: 'other', label: isFr ? 'Autre' : 'Other', icon: <Receipt className="w-3.5 h-3.5 shrink-0" /> },
                        {
                          id: 'credit',
                          label: isFr ? 'Crédit / Dette' : 'Credit',
                          icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
                        },
                      ].map((m) => {
                        const isSelected =
                          m.id === 'credit'
                            ? amountPaidInput === '0'
                            : paymentMethod === m.id && amountPaidInput !== '0';
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (m.id === 'credit') {
                                setAmountPaidInput('0');
                              } else {
                                setPaymentMethod(m.id as PaymentMethodType);
                                if (amountPaidInput === '0') setAmountPaidInput('');
                              }
                            }}
                            className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                            }`}
                          >
                            {m.icon}
                            <span className="truncate">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Amount Paid Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-zinc-400">{t.pos.amountTendered}:</label>
                      <button
                        type="button"
                        onClick={() => setAmountPaidInput(String(cartTotal))}
                        className="text-[11px] text-emerald-400 hover:underline font-semibold cursor-pointer"
                      >
                        {isFr ? 'Montant Exact' : 'Exact Amount'} ({currencyConfig.format(cartTotal)})
                      </button>
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder={String(cartTotal)}
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-zinc-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Change or Debt Breakdown */}
                  {changeDue > 0 && (
                    <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex justify-between text-xs text-emerald-300 font-bold">
                      <span>{t.pos.changeDue}:</span>
                      <span>{currencyConfig.format(changeDue)}</span>
                    </div>
                  )}

                  {balanceDue > 0 && (
                    <div className="p-2 rounded-lg bg-rose-950/20 border border-rose-500/30 flex justify-between text-xs text-rose-300 font-bold">
                      <span>{isFr ? 'Reste à devoir (Dette)' : 'Balance / Debt'}:</span>
                      <span>{currencyConfig.format(balanceDue)}</span>
                    </div>
                  )}

                  {/* Reference input */}
                  <input
                    type="text"
                    placeholder={t.pos.paymentRefPlaceholder}
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                  />

                  {/* Optional Notes */}
                  <input
                    type="text"
                    placeholder={t.pos.saleNotesPlaceholder}
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Totals Summary & Submit Button */}
              <div className="pt-3 border-t border-zinc-800 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>{t.pos.subtotal}:</span>
                    <span>{currencyConfig.format(cartSubtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>{t.pos.discount}:</span>
                      <span>-{currencyConfig.format(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-white pt-1 border-t border-zinc-800">
                    <span>{t.pos.totalToPay}:</span>
                    <span className="text-emerald-400">{currencyConfig.format(cartTotal)}</span>
                  </div>
                </div>

                {saleError && (
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{saleError}</span>
                  </div>
                )}

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleCompleteSale}
                  disabled={cart.length === 0 || isSubmittingSale}
                  isLoading={isSubmittingSale}
                  allowWrap
                  className="w-full py-3 px-3 sm:px-4 text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-950/40 cursor-pointer min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5 shrink-0" />
                  {isSubmittingSale
                    ? (isFr ? 'Finalisation de la vente...' : 'Processing Sale...')
                    : `${t.pos.completeSale} (${currencyConfig.format(cartTotal)})`}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SALES HISTORY & RECEIPTS VIEW                                             */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder={isFr ? 'Rechercher par n° de reçu, client, mémo...' : 'Search by order ID, customer name, notes...'}
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {(['all', 'paid', 'partial', 'unpaid'] as const).map((status) => {
                const label =
                  status === 'all'
                    ? (isFr ? 'Tous' : 'All')
                    : status === 'paid'
                    ? (isFr ? 'Payé' : 'Paid')
                    : status === 'partial'
                    ? (isFr ? 'Partiel' : 'Partial')
                    : (isFr ? 'Impayé' : 'Unpaid');
                return (
                  <button
                    key={status}
                    onClick={() => setHistoryStatusFilter(status)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                      historyStatusFilter === status
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}

              <button
                onClick={() =>
                  PDFAndPrintService.printSalesHistoryDirectly(
                    salesHistory,
                    activeBusiness,
                    currencyConfig,
                    historyStatusFilter === 'all'
                      ? (isFr ? 'Toutes les Transactions' : 'All Transactions')
                      : `${historyStatusFilter.toUpperCase()} ${isFr ? 'Transactions' : 'Transactions'}`
                  )
                }
                disabled={salesHistory.length === 0}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap disabled:opacity-40 cursor-pointer"
                title={isFr ? 'Imprimer le journal des ventes' : 'Print Sales Ledger'}
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>{isFr ? 'Imprimer Journal' : 'Print Ledger'}</span>
              </button>
            </div>
          </div>

          {/* Sales Table / Cards */}
          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800"
                />
              ))}
            </div>
          ) : salesHistory.length === 0 ? (
            <Card className="text-center py-12 space-y-2">
              <Receipt className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-zinc-300">
                {isFr ? 'Aucune transaction trouvée' : 'No sales transactions found'}
              </p>
              <p className="text-xs text-zinc-500">
                {isFr
                  ? 'Les ventes enregistrées et commandes clients apparaîtront ici.'
                  : 'Completed sales and customer orders will appear here.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {salesHistory.map((sale) => {
                const itemsCount = sale.sale_items.reduce((s, i) => s + i.quantity, 0);
                const itemsSummary = sale.sale_items
                  .map((i) => `${i.quantity}x ${i.product_name_snapshot}`)
                  .join(', ');

                return (
                  <div
                    key={sale.id}
                    onClick={() => {
                      setSelectedHistorySale(sale);
                      setIsDetailModalOpen(true);
                    }}
                    className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-emerald-400">
                          #{sale.id.substring(0, 8).toUpperCase()}
                        </span>
                        <Badge
                          variant={
                            sale.sale_status === 'completed'
                              ? 'emerald'
                              : sale.sale_status === 'cancelled'
                              ? 'rose'
                              : 'amber'
                          }
                        >
                          {sale.sale_status.toUpperCase()}
                        </Badge>
                        <Badge
                          variant={
                            sale.payment_status === 'paid'
                              ? 'emerald'
                              : sale.payment_status === 'partial'
                              ? 'amber'
                              : 'rose'
                          }
                        >
                          {sale.payment_status.toUpperCase()}
                        </Badge>
                      </div>

                      <p className="text-xs font-semibold text-zinc-100">
                        {sale.customers?.name || t.pos.walkInCustomer}
                        <span className="text-zinc-400 font-normal ml-2">
                          ({itemsCount} {isFr ? 'articles' : 'items'})
                        </span>
                      </p>

                      <p className="text-[11px] text-zinc-400 truncate max-w-lg">
                        {itemsSummary}
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800 shrink-0">
                      <p className="text-sm font-extrabold text-white">
                        {currencyConfig.format(sale.total)}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {new Date(sale.sold_at).toLocaleString(language === 'fr' ? 'fr-FR' : undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS: Receipt Modal                                                     */}
      {/* ========================================================================= */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={completedSale}
        onNewSale={() => {
          setIsReceiptOpen(false);
          setActiveTab('pos');
        }}
      />

      {/* ========================================================================= */}
      {/* MODALS: Sale Detail & Safe Cancellation Modal                             */}
      {/* ========================================================================= */}
      <SaleDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        sale={selectedHistorySale}
        onSaleUpdated={() => {
          loadSalesHistory();
          loadData();
        }}
      />

      {/* ========================================================================= */}
      {/* MODALS: Quick New Customer Creation Modal                                 */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        title={isFr ? 'Ajouter un Client' : 'Add Customer'}
        description={isFr ? 'Enregistrez les coordonnées pour gérer les dettes et factures' : 'Save customer info to track credit orders and sales'}
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <Input
            label={isFr ? 'Nom Complet du Client *' : 'Customer Name *'}
            placeholder={isFr ? 'ex: Jean Dupont / Société Alpha' : 'e.g. John Doe / Grace Enterprise'}
            value={newCustName}
            onChange={(e) => setNewCustName(e.target.value)}
            required
          />
          <Input
            label={isFr ? 'Numéro de Téléphone' : 'Phone Number'}
            placeholder={isFr ? 'ex: +237 670 000 000' : 'e.g. +237 670 000 000'}
            value={newCustPhone}
            onChange={(e) => setNewCustPhone(e.target.value)}
          />
          <Input
            label={isFr ? 'Adresse E-mail' : 'Email Address'}
            type="email"
            placeholder="client@example.com"
            value={newCustEmail}
            onChange={(e) => setNewCustEmail(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewCustomerModalOpen(false)}
              className="cursor-pointer"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!newCustName.trim() || creatingCust}
              isLoading={creatingCust}
              className="cursor-pointer"
            >
              {isFr ? 'Enregistrer le Client' : 'Save Customer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* POS Hardware & Thermal Printer Settings Modal */}
      <HardwareSettingsModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
      />

      {/* Register Closeout & End-of-Day Z-Report Modal */}
      <RegisterCloseoutModal
        isOpen={isRegisterCloseoutOpen}
        onClose={() => setIsRegisterCloseoutOpen(false)}
      />

      {/* Manager Discount Approval PIN Modal */}
      <Modal
        isOpen={isManagerDiscountApprovalOpen}
        onClose={() => {
          setIsManagerDiscountApprovalOpen(false);
          setManagerDiscountPin('');
          setManagerDiscountError(null);
        }}
        title={isFr ? 'Validation Responsable Requise' : 'Manager Approval Required'}
        description={
          isFr
            ? 'Cette remise dépasse le plafond autorisé pour la caisse. Un gérant ou propriétaire doit saisir son code PIN.'
            : 'This discount exceeds the cashier limit. A manager or owner must enter their PIN to authorize this override.'
        }
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <p className="font-bold text-amber-300">
                {isFr ? 'Dérogation Plafond de Remise' : 'Excess Discount Override'}
              </p>
              <p className="text-zinc-400">
                {isFr
                  ? `Remise: ${currencyConfig.format(Number(discountAmount))} (${cartSubtotal > 0 ? Math.round((Number(discountAmount) / cartSubtotal) * 100) : 0}%) dépasse la limite caissier de ${getMaxAllowedDiscount(effectiveRole)}%.`
                  : `Discount: ${currencyConfig.format(Number(discountAmount))} (${cartSubtotal > 0 ? Math.round((Number(discountAmount) / cartSubtotal) * 100) : 0}%) exceeds cashier threshold of ${getMaxAllowedDiscount(effectiveRole)}%.`}
              </p>
            </div>
          </div>

          <Input
            label={isFr ? 'Code PIN Responsable *' : 'Manager PIN *'}
            type="password"
            placeholder={isFr ? 'Entrez le PIN (défaut: 8888)' : 'Enter PIN (default: 8888)'}
            value={managerDiscountPin}
            onChange={(e) => {
              setManagerDiscountPin(e.target.value);
              setManagerDiscountError(null);
            }}
            autoFocus
          />

          {managerDiscountError && (
            <p className="text-xs text-rose-500 font-medium">{managerDiscountError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsManagerDiscountApprovalOpen(false);
                setManagerDiscountPin('');
                setManagerDiscountError(null);
              }}
              className="cursor-pointer"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              className="cursor-pointer"
              onClick={() => {
                if (!verifyManagerPin(managerDiscountPin)) {
                  setManagerDiscountError(
                    isFr ? 'Code PIN responsable invalide. Veuillez réessayer.' : 'Invalid manager PIN. Please enter an authorized manager PIN.'
                  );
                  return;
                }
                setIsDiscountOverrideApproved(true);
                setIsManagerDiscountApprovalOpen(false);
                setManagerDiscountPin('');
                setManagerDiscountError(null);
              }}
            >
              {isFr ? 'Autoriser la Remise' : 'Authorize Discount'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Live Camera Barcode & QR Code Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onProductScanned={(product) => addToCart(product)}
        currencyConfig={currencyConfig}
        isFr={isFr}
      />
    </div>
  );
};
