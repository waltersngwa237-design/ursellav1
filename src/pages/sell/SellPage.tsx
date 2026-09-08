import React, { useState, useEffect, useMemo } from 'react';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { ProductService } from '../../services/product.service.ts';
import { SalesService } from '../../services/sales.service.ts';
import { CustomerService } from '../../services/customer.service.ts';
import { Card } from '../../components/common/Card.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { Select } from '../../components/common/Select.tsx';
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
  RotateCcw,
  Tag,
  AlertCircle,
  Sparkles,
  History,
  X,
  UserPlus,
  Printer,
} from 'lucide-react';
import { PDFAndPrintService } from '../../services/pdf.service.ts';

export const SellPage: React.FC = () => {
  const { activeBusiness, currency } = useBusiness();
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');

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

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - (Number(discountAmount) || 0));
  }, [cartSubtotal, discountAmount]);

  // Auto set amount paid to total if empty or user clicks exact
  const effectiveAmountPaid = useMemo(() => {
    if (amountPaidInput === '') {
      return cartTotal;
    }
    return Number(amountPaidInput) || 0;
  }, [amountPaidInput, cartTotal]);

  const changeDue = useMemo(() => {
    if (effectiveAmountPaid > cartTotal) {
      return effectiveAmountPaid - cartTotal;
    }
    return 0;
  }, [effectiveAmountPaid, cartTotal]);

  const balanceDue = useMemo(() => {
    if (effectiveAmountPaid < cartTotal) {
      return cartTotal - effectiveAmountPaid;
    }
    return 0;
  }, [effectiveAmountPaid, cartTotal]);

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
    setAmountPaidInput('');
    setPaymentReference('');
    setSaleNotes('');
    setSaleError(null);
  };

  // Submit Sale Handler
  const handleCompleteSale = async () => {
    if (!activeBusiness?.id) return;
    if (cart.length === 0) {
      setSaleError('Cart is empty. Select products to sell.');
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
        throw error || new Error('Sale could not be completed.');
      }

      // Fetch the full newly completed sale record for the receipt
      const detail = await SalesService.getSaleDetail(activeBusiness.id, sale_id);
      setCompletedSale(detail);
      setIsReceiptOpen(true);

      // Refresh catalog stock
      loadData();
      clearCart();
    } catch (err: any) {
      setSaleError(err?.message || 'Failed to process sale.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Point of Sale & Checkout
            </h1>
            <Badge variant="emerald" size="sm">
              Live Terminal
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Fast transactions, stock synchronization, and customer debt ledger for{' '}
            <strong className="text-zinc-200">{activeBusiness?.name}</strong>
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pos'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Sales History</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* POS TERMINAL VIEW                                                         */}
      {/* ========================================================================= */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CATALOG COLUMN (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Category Filter Header */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search products by name or SKU..."
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
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full overscroll-x-contain touch-pan-x">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-zinc-100 text-zinc-950 font-bold shadow'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                All Categories ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
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
                <p className="text-sm font-semibold text-zinc-300">No products found</p>
                <p className="text-xs text-zinc-500">
                  {searchQuery || selectedCategory !== 'all'
                    ? 'Try adjusting your search or category filter.'
                    : 'Add products in the Business Catalog tab to start selling.'}
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
                              Service
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
                                Service (No stock limit)
                              </span>
                            ) : isOutOfStock ? (
                              <span className="text-[10px] font-bold text-rose-400">
                                Out of stock
                              </span>
                            ) : isLowStock ? (
                              <span className="text-[10px] font-semibold text-amber-400">
                                {product.stock_quantity} {product.unit_of_measure || 'piece'} left (Low)
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-400">
                                Stock: {product.stock_quantity} {product.unit_of_measure || 'piece'}
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
                    Current Order
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={cart.length > 0 ? 'emerald' : 'zinc'}>
                    {cart.reduce((s, i) => s + i.quantity, 0)} Items
                  </Badge>
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      title="Clear Cart"
                      className="text-xs text-zinc-400 hover:text-rose-400 transition-colors p-1"
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
                    <span>Customer</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerModalOpen(true)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> New Customer
                  </button>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Walk-in Customer (General)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{' '}
                      {c.outstanding_balance > 0
                        ? `[⚠️ Debt: ${currencyConfig.format(c.outstanding_balance)}]`
                        : ''}
                    </option>
                  ))}
                </select>

                {/* Outstanding balance warning for selected customer */}
                {selectedCustomerObj && selectedCustomerObj.outstanding_balance > 0 && (
                  <div className="p-2 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-300 flex items-center justify-between">
                    <span>Outstanding Debt Balance:</span>
                    <strong className="font-bold">
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
                    <p>No items in cart</p>
                    <p className="text-[10px] text-zinc-400">Click products from catalog to add</p>
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
                          className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800"
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
                          {item.product.unit_of_measure || 'piece'}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.product.product_type !== 'service' && item.quantity >= item.product.stock_quantity}
                          className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-bold text-zinc-100 w-16 text-right whitespace-nowrap">
                        {currencyConfig.format(item.unit_price * item.quantity)}
                      </span>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1"
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
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-zinc-400 flex items-center gap-1 shrink-0">
                      <Tag className="w-3.5 h-3.5" /> Discount:
                    </label>
                    <div className="w-32">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        placeholder="0"
                        value={discountAmount || ''}
                        onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-right text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 flex items-center gap-1 font-semibold">
                      <CreditCard className="w-3.5 h-3.5" /> Payment Method:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'cash', label: 'Cash', icon: <Banknote className="w-3.5 h-3.5" /> },
                        {
                          id: 'mobile_money',
                          label: 'Mobile Money',
                          icon: <Smartphone className="w-3.5 h-3.5" />,
                        },
                        {
                          id: 'bank_transfer',
                          label: 'Transfer',
                          icon: <Building2 className="w-3.5 h-3.5" />,
                        },
                        { id: 'card', label: 'Card', icon: <CreditCard className="w-3.5 h-3.5" /> },
                        { id: 'other', label: 'Other', icon: <Receipt className="w-3.5 h-3.5" /> },
                        {
                          id: 'credit',
                          label: 'Credit / Unpaid',
                          icon: <Clock className="w-3.5 h-3.5" />,
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
                            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all ${
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
                      <label className="text-zinc-400">Amount Tendered / Paid:</label>
                      <button
                        type="button"
                        onClick={() => setAmountPaidInput(String(cartTotal))}
                        className="text-[11px] text-emerald-400 hover:underline font-semibold"
                      >
                        Exact ({currencyConfig.format(cartTotal)})
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
                      <span>Change to Return:</span>
                      <span>{currencyConfig.format(changeDue)}</span>
                    </div>
                  )}

                  {balanceDue > 0 && (
                    <div className="p-2 rounded-lg bg-rose-950/20 border border-rose-500/30 flex justify-between text-xs text-rose-300 font-bold">
                      <span>Remaining Balance (Debt):</span>
                      <span>{currencyConfig.format(balanceDue)}</span>
                    </div>
                  )}

                  {/* Optional Notes */}
                  <input
                    type="text"
                    placeholder="Optional memo / reference..."
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
                    <span>Subtotal:</span>
                    <span>{currencyConfig.format(cartSubtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount:</span>
                      <span>-{currencyConfig.format(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-white pt-1 border-t border-zinc-800">
                    <span>Total Due:</span>
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
                  className="w-full py-3 text-sm font-extrabold shadow-lg shadow-emerald-950/40"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Complete Sale ({currencyConfig.format(cartTotal)})
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
                placeholder="Search by order ID, customer name, notes..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {(['all', 'paid', 'partial', 'unpaid'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setHistoryStatusFilter(status)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all whitespace-nowrap ${
                    historyStatusFilter === status
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {status}
                </button>
              ))}

              <button
                onClick={() =>
                  PDFAndPrintService.printSalesHistoryDirectly(
                    salesHistory,
                    activeBusiness,
                    currencyConfig,
                    historyStatusFilter === 'all' ? 'All Transactions' : `${historyStatusFilter.toUpperCase()} Transactions`
                  )
                }
                disabled={salesHistory.length === 0}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap disabled:opacity-40"
                title="Print Sales Ledger"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>Print Ledger</span>
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
              <p className="text-sm font-semibold text-zinc-300">No sales transactions found</p>
              <p className="text-xs text-zinc-500">
                Completed sales and customer orders will appear here.
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
                        {sale.customers?.name || 'Walk-in Customer'}
                        <span className="text-zinc-400 font-normal ml-2">({itemsCount} items)</span>
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
                        {new Date(sale.sold_at).toLocaleString(undefined, {
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
        title="Add Customer"
        description="Save customer info to track credit orders and sales"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <Input
            label="Customer Name *"
            placeholder="e.g. John Doe / Grace Enterprise"
            value={newCustName}
            onChange={(e) => setNewCustName(e.target.value)}
            required
          />
          <Input
            label="Phone Number"
            placeholder="e.g. +237 670 000 000"
            value={newCustPhone}
            onChange={(e) => setNewCustPhone(e.target.value)}
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="customer@example.com"
            value={newCustEmail}
            onChange={(e) => setNewCustEmail(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewCustomerModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!newCustName.trim() || creatingCust}
              isLoading={creatingCust}
            >
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
