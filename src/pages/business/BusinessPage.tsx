import React, { useState, useEffect, useMemo } from 'react';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { ProductService, type CreateProductInput, type ProductDetailResult } from '../../services/product.service.ts';
import { InventoryService, type InventoryLedgerItem } from '../../services/inventory.service.ts';
import { ExpenseService, type CreateExpenseInput } from '../../services/expense.service.ts';
import { Card } from '../../components/common/Card.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { TeamManagementSection } from '../../components/team/TeamManagementSection.tsx';
import {
  CURRENCY_MAP,
  EXPENSE_CATEGORIES,
  type ProductWithCategory,
  type ProductCategory,
  type Supplier,
  type Expense,
  type PaymentMethodType,
  type InventoryTransactionType,
} from '../../types/index.ts';
import {
  Package,
  Layers,
  Receipt,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Archive,
  History,
  Tag,
  Boxes,
  Users,
} from 'lucide-react';
import {
  getCategoryTheme,
  CATEGORY_PALETTES,
  setCategoryColorOverride,
  getCategoryColorOverrides,
  removeCategoryColorOverride,
} from '../../lib/product-colors.ts';

export const UNIT_OF_MEASURE_GROUPS_EN = [
  {
    group: 'Count & Packaging',
    units: [
      { value: 'piece', label: 'Piece / Item (pcs)' },
      { value: 'pack', label: 'Pack (pk)' },
      { value: 'box', label: 'Box / Carton (box)' },
      { value: 'bottle', label: 'Bottle (btl)' },
      { value: 'can', label: 'Can' },
      { value: 'bag', label: 'Bag / Sack' },
      { value: 'pair', label: 'Pair (pr)' },
      { value: 'dozen', label: 'Dozen (dz)' },
      { value: 'roll', label: 'Roll' },
      { value: 'set', label: 'Set' },
    ],
  },
  {
    group: 'Weight',
    units: [
      { value: 'kg', label: 'Kilogram (kg)' },
      { value: 'g', label: 'Gram (g)' },
      { value: 'lb', label: 'Pound (lb)' },
      { value: 'oz', label: 'Ounce (oz)' },
    ],
  },
  {
    group: 'Volume & Liquid',
    units: [
      { value: 'L', label: 'Liter (L)' },
      { value: 'ml', label: 'Milliliter (ml)' },
      { value: 'gal', label: 'Gallon (gal)' },
      { value: 'cup', label: 'Cup' },
    ],
  },
  {
    group: 'Length & Dimension',
    units: [
      { value: 'm', label: 'Meter (m)' },
      { value: 'cm', label: 'Centimeter (cm)' },
      { value: 'yard', label: 'Yard (yd)' },
      { value: 'ft', label: 'Foot (ft)' },
    ],
  },
  {
    group: 'Other',
    units: [
      { value: 'custom', label: 'Other / Custom Unit...' },
    ],
  },
];

export const UNIT_OF_MEASURE_GROUPS_FR = [
  {
    group: 'Unités & Conditionnement',
    units: [
      { value: 'piece', label: 'Pièce / Article (pcs)' },
      { value: 'pack', label: 'Paquet (pk)' },
      { value: 'box', label: 'Carton / Boîte (box)' },
      { value: 'bottle', label: 'Bouteille (btl)' },
      { value: 'can', label: 'Canette / Boîte' },
      { value: 'bag', label: 'Sac / Sachet' },
      { value: 'pair', label: 'Paire (pr)' },
      { value: 'dozen', label: 'Douzaine (dz)' },
      { value: 'roll', label: 'Rouleau' },
      { value: 'set', label: 'Ensemble / Lot' },
    ],
  },
  {
    group: 'Poids',
    units: [
      { value: 'kg', label: 'Kilogramme (kg)' },
      { value: 'g', label: 'Gramme (g)' },
      { value: 'lb', label: 'Livre (lb)' },
      { value: 'oz', label: 'Once (oz)' },
    ],
  },
  {
    group: 'Volume & Liquides',
    units: [
      { value: 'L', label: 'Litre (L)' },
      { value: 'ml', label: 'Millilitre (ml)' },
      { value: 'gal', label: 'Gallon (gal)' },
      { value: 'cup', label: 'Tasse' },
    ],
  },
  {
    group: 'Longueur & Dimensions',
    units: [
      { value: 'm', label: 'Mètre (m)' },
      { value: 'cm', label: 'Centimètre (cm)' },
      { value: 'yard', label: 'Yard (yd)' },
      { value: 'ft', label: 'Pied (ft)' },
    ],
  },
  {
    group: 'Autre',
    units: [
      { value: 'custom', label: 'Autre unité personnalisée...' },
    ],
  },
];

export interface BusinessPageProps {
  initialTab?: 'catalog' | 'inventory' | 'categories' | 'expenses' | 'team';
}

export const BusinessPage: React.FC<BusinessPageProps> = ({ initialTab = 'catalog' }) => {
  const { activeBusiness, currency } = useBusiness();
  const { language, t } = useLanguage();
  const isFr = language === 'fr';
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const unitGroups = isFr ? UNIT_OF_MEASURE_GROUPS_FR : UNIT_OF_MEASURE_GROUPS_EN;

  const [activeTab, setActiveTab] = useState<'catalog' | 'inventory' | 'categories' | 'expenses' | 'team'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('expense')) return 'expenses';
    }
    return initialTab;
  });

  // Sync activeTab when initialTab changes or when URL hash changes to expenses
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('expense')) {
        setActiveTab('expenses');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // ==========================================
  // STATE: CATALOG & PRODUCTS
  // ==========================================
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [showArchivedProducts, setShowArchivedProducts] = useState(false);

  // Product Modals
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodFormName, setProdFormName] = useState('');
  const [prodFormSku, setProdFormSku] = useState('');
  const [prodFormCategory, setProdFormCategory] = useState('');
  const [prodFormSellingPrice, setProdFormSellingPrice] = useState<string>('');
  const [prodFormCostPrice, setProdFormCostPrice] = useState<string>('');
  const [prodFormStock, setProdFormStock] = useState<string>('0');
  const [prodFormMinStock, setProdFormMinStock] = useState<string>('5');
  const [prodFormUnit, setProdFormUnit] = useState<string>('piece');
  const [prodFormCustomUnit, setProdFormCustomUnit] = useState<string>('');
  const [prodFormSupplier, setProdFormSupplier] = useState('');
  const [prodFormDesc, setProdFormDesc] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);

  // Product Detail Modal
  const [selectedProductDetail, setSelectedProductDetail] = useState<ProductDetailResult | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Product Delete Modal
  const [productToDelete, setProductToDelete] = useState<ProductWithCategory | null>(null);
  const [isDeleteProductModalOpen, setIsDeleteProductModalOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);

  // ==========================================
  // STATE: INVENTORY MOVEMENTS & ADJUSTMENTS
  // ==========================================
  const [inventoryLedger, setInventoryLedger] = useState<InventoryLedgerItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustType, setAdjustType] = useState<InventoryTransactionType>('restock');
  const [adjustQuantity, setAdjustQuantity] = useState<string>('1');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // ==========================================
  // STATE: CATEGORIES
  // ==========================================
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState<string>('auto');
  const [savingCategory, setSavingCategory] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // ==========================================
  // STATE: EXPENSES
  // ==========================================
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCatFilter, setExpenseCatFilter] = useState('all');

  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expCategory, setExpCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [expAmount, setExpAmount] = useState<string>('');
  const [expPaymentMethod, setExpPaymentMethod] = useState<PaymentMethodType>('cash');
  const [expDate, setExpDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expDesc, setExpDesc] = useState('');
  const [expRecurring, setExpRecurring] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Load Data
  const loadProducts = async () => {
    if (!activeBusiness?.id) return;
    setLoadingProducts(true);
    try {
      const [prods, cats, sups] = await Promise.all([
        ProductService.getProducts(activeBusiness.id, {
          isActive: showArchivedProducts ? undefined : true,
          categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
          stockStatus: stockStatusFilter,
          search: productSearch,
        }),
        ProductService.getCategories(activeBusiness.id),
        ProductService.getSuppliers(activeBusiness.id),
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadInventory = async () => {
    if (!activeBusiness?.id) return;
    setLoadingInventory(true);
    try {
      const ledger = await InventoryService.getInventoryLedger(activeBusiness.id);
      setInventoryLedger(ledger);
    } catch (err) {
      console.error('Error loading inventory ledger:', err);
    } finally {
      setLoadingInventory(false);
    }
  };

  const loadExpenses = async () => {
    if (!activeBusiness?.id) return;
    setLoadingExpenses(true);
    try {
      const exps = await ExpenseService.getExpenses(activeBusiness.id, {
        category: expenseCatFilter !== 'all' ? expenseCatFilter : undefined,
        search: expenseSearch,
      });
      setExpenses(exps);
    } catch (err) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoadingExpenses(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [activeBusiness?.id, categoryFilter, stockStatusFilter, showArchivedProducts, productSearch]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      loadInventory();
    } else if (activeTab === 'expenses') {
      loadExpenses();
    }
  }, [activeBusiness?.id, activeTab, expenseCatFilter, expenseSearch]);

  // Real-time synchronization when AI actions, restocks, or sales alter product stock
  useEffect(() => {
    const handleDataChanged = () => {
      loadProducts();
      if (activeTab === 'inventory') {
        loadInventory();
      } else if (activeTab === 'expenses') {
        loadExpenses();
      }
    };
    window.addEventListener('ursella_data_changed', handleDataChanged);
    return () => {
      window.removeEventListener('ursella_data_changed', handleDataChanged);
    };
  }, [activeBusiness?.id, activeTab, categoryFilter, stockStatusFilter, showArchivedProducts, productSearch, expenseCatFilter, expenseSearch]);

  // View Product Detail Modal
  const handleViewProductDetail = async (productId: string) => {
    if (!activeBusiness?.id) return;
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const detail = await ProductService.getProductDetail(activeBusiness.id, productId);
      setSelectedProductDetail(detail);
    } catch (err) {
      console.error('Failed to load product detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Save Product (Create or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id) return;

    setSavingProduct(true);
    setProductFormError(null);

    try {
      const sellingPrice = Number(prodFormSellingPrice);
      const costPrice = Number(prodFormCostPrice);
      const stock = Number(prodFormStock);
      const minStock = Number(prodFormMinStock);

      if (isNaN(sellingPrice) || sellingPrice < 0) {
        throw new Error(isFr ? 'Le prix de vente doit être un nombre positif.' : 'Selling price must be a non-negative number.');
      }
      if (isNaN(costPrice) || costPrice < 0) {
        throw new Error(isFr ? 'Le prix d’achat doit être un nombre positif.' : 'Cost price must be a non-negative number.');
      }

      const resolvedUnit = prodFormUnit === 'custom'
        ? (prodFormCustomUnit.trim() || 'piece')
        : (prodFormUnit.trim() || 'piece');

      if (editingProductId) {
        await ProductService.updateProduct(activeBusiness.id, editingProductId, {
          name: prodFormName.trim(),
          sku: prodFormSku.trim() || null,
          category_id: prodFormCategory || null,
          supplier_id: prodFormSupplier || null,
          unit_of_measure: resolvedUnit,
          selling_price: sellingPrice,
          cost_price: costPrice,
          minimum_stock_level: minStock,
          description: prodFormDesc.trim() || null,
        });
      } else {
        await ProductService.createProduct({
          business_id: activeBusiness.id,
          name: prodFormName.trim(),
          sku: prodFormSku.trim() || null,
          category_id: prodFormCategory || null,
          supplier_id: prodFormSupplier || null,
          unit_of_measure: resolvedUnit,
          selling_price: sellingPrice,
          cost_price: costPrice,
          stock_quantity: stock,
          minimum_stock_level: minStock,
          description: prodFormDesc.trim() || null,
        });
      }

      setIsAddProductModalOpen(false);
      resetProductForm();
      loadProducts();
    } catch (err: any) {
      setProductFormError(err?.message || (isFr ? 'Erreur lors de l’enregistrement du produit.' : 'Failed to save product.'));
    } finally {
      setSavingProduct(false);
    }
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProdFormName('');
    setProdFormSku('');
    setProdFormCategory('');
    setProdFormSellingPrice('');
    setProdFormCostPrice('');
    setProdFormStock('0');
    setProdFormMinStock('5');
    setProdFormUnit('piece');
    setProdFormCustomUnit('');
    setProdFormSupplier('');
    setProdFormDesc('');
    setProductFormError(null);
  };

  const openEditProduct = (prod: ProductWithCategory) => {
    setEditingProductId(prod.id);
    setProdFormName(prod.name);
    setProdFormSku(prod.sku || '');
    setProdFormCategory(prod.category_id || '');
    setProdFormSellingPrice(String(prod.selling_price));
    setProdFormCostPrice(String(prod.cost_price));
    setProdFormStock(String(prod.stock_quantity));
    setProdFormMinStock(String(prod.minimum_stock_level));
    
    const allKnownUnits = UNIT_OF_MEASURE_GROUPS_EN.flatMap((g) => g.units.map((u) => u.value)).filter((v) => v !== 'custom');
    const existingUnit = prod.unit_of_measure?.trim() || 'piece';
    if (allKnownUnits.includes(existingUnit)) {
      setProdFormUnit(existingUnit);
      setProdFormCustomUnit('');
    } else {
      setProdFormUnit('custom');
      setProdFormCustomUnit(existingUnit);
    }

    setProdFormSupplier(prod.supplier_id || '');
    setProdFormDesc(prod.description || '');
    setIsAddProductModalOpen(true);
  };

  const handleToggleProductArchive = async (prod: ProductWithCategory) => {
    if (!activeBusiness?.id) return;
    try {
      await ProductService.toggleProductActive(activeBusiness.id, prod.id, !prod.is_active);
      loadProducts();
      if (selectedProductDetail && selectedProductDetail.product.id === prod.id) {
        setIsDetailModalOpen(false);
      }
    } catch (err: any) {
      alert(err?.message || (isFr ? 'Échec de mise à jour' : 'Failed to update product status'));
    }
  };

  const confirmDeleteProduct = (prod: ProductWithCategory) => {
    setProductToDelete(prod);
    setIsDeleteProductModalOpen(true);
  };

  const handleDeleteProduct = async () => {
    if (!activeBusiness?.id || !productToDelete) return;
    setDeletingProduct(true);
    try {
      await ProductService.deleteProduct(activeBusiness.id, productToDelete.id);
      setIsDeleteProductModalOpen(false);
      setProductToDelete(null);
      if (selectedProductDetail && selectedProductDetail.product.id === productToDelete.id) {
        setIsDetailModalOpen(false);
        setSelectedProductDetail(null);
      }
      loadProducts();
    } catch (err: any) {
      alert(err?.message || (isFr ? 'Échec de suppression' : 'Failed to delete product'));
    } finally {
      setDeletingProduct(false);
    }
  };

  // Stock Adjustment Submit
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id || !adjustProductId) return;

    setSavingAdjustment(true);
    setAdjustError(null);

    try {
      const qty = Number(adjustQuantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error(isFr ? 'La quantité doit être supérieure à zéro.' : 'Quantity must be greater than zero.');
      }

      await InventoryService.recordTransaction({
        business_id: activeBusiness.id,
        product_id: adjustProductId,
        transaction_type: adjustType,
        quantity: qty,
        reason: adjustReason.trim() || undefined,
        notes: adjustNotes.trim() || undefined,
      });

      setIsAdjustStockModalOpen(false);
      setAdjustProductId('');
      setAdjustReason('');
      setAdjustNotes('');
      loadProducts();
      if (activeTab === 'inventory') loadInventory();
    } catch (err: any) {
      setAdjustError(err?.message || (isFr ? 'Erreur lors de l’ajustement de stock.' : 'Failed to record stock movement.'));
    } finally {
      setSavingAdjustment(false);
    }
  };

  // Category Submit
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id || !catName.trim()) return;

    setSavingCategory(true);
    setCatError(null);

    try {
      let savedCatId = editingCatId;
      if (editingCatId) {
        await ProductService.updateCategory(activeBusiness.id, editingCatId, catName.trim(), catDesc);
      } else {
        const created = await ProductService.createCategory(activeBusiness.id, catName.trim(), catDesc);
        savedCatId = created.id;
      }

      // Persist chosen color override
      if (catColor && catColor !== 'auto') {
        setCategoryColorOverride(activeBusiness.id, catName.trim(), catColor);
        if (savedCatId) {
          setCategoryColorOverride(activeBusiness.id, savedCatId, catColor);
        }
      } else if (catColor === 'auto') {
        removeCategoryColorOverride(activeBusiness.id, catName.trim());
        if (savedCatId) {
          removeCategoryColorOverride(activeBusiness.id, savedCatId);
        }
      }

      setIsCategoryModalOpen(false);
      setCatName('');
      setCatDesc('');
      setCatColor('auto');
      setEditingCatId(null);
      loadProducts();
    } catch (err: any) {
      setCatError(err?.message || (isFr ? 'Erreur lors de l’enregistrement de la catégorie.' : 'Failed to save category.'));
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!activeBusiness?.id) return;
    if (!confirm(isFr ? 'Voulez-vous vraiment supprimer cette catégorie ? Les produits associés ne seront pas supprimés.' : 'Are you sure you want to remove this category? Products in this category will not be deleted.')) return;

    try {
      const targetCat = categories.find((c) => c.id === catId);
      if (targetCat) {
        removeCategoryColorOverride(activeBusiness.id, targetCat.name);
        removeCategoryColorOverride(activeBusiness.id, targetCat.id);
      }
      await ProductService.deleteOrArchiveCategory(activeBusiness.id, catId);
      loadProducts();
    } catch (err: any) {
      alert(err?.message || (isFr ? 'Échec de suppression' : 'Failed to delete category'));
    }
  };

  // Expense Submit
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id) return;

    setSavingExpense(true);
    setExpenseError(null);

    try {
      const amt = Number(expAmount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error(isFr ? 'Le montant de la dépense doit être supérieur à zéro.' : 'Expense amount must be greater than zero.');
      }

      if (editingExpenseId) {
        await ExpenseService.updateExpense(activeBusiness.id, editingExpenseId, {
          category: expCategory,
          amount: amt,
          payment_method: expPaymentMethod,
          expense_date: expDate,
          description: expDesc.trim() || null,
          is_recurring: expRecurring,
        });
      } else {
        await ExpenseService.createExpense({
          business_id: activeBusiness.id,
          category: expCategory,
          amount: amt,
          payment_method: expPaymentMethod,
          expense_date: expDate,
          description: expDesc.trim() || null,
          is_recurring: expRecurring,
        });
      }

      setIsAddExpenseModalOpen(false);
      resetExpenseForm();
      loadExpenses();
    } catch (err: any) {
      setExpenseError(err?.message || (isFr ? 'Erreur lors de l’enregistrement de la dépense.' : 'Failed to save expense.'));
    } finally {
      setSavingExpense(false);
    }
  };

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpCategory(EXPENSE_CATEGORIES[0]);
    setExpAmount('');
    setExpPaymentMethod('cash');
    setExpDate(new Date().toISOString().split('T')[0]);
    setExpDesc('');
    setExpRecurring(false);
    setExpenseError(null);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!activeBusiness?.id) return;
    if (!confirm(isFr ? 'Voulez-vous vraiment supprimer cette dépense ?' : 'Are you sure you want to delete this expense record?')) return;

    try {
      await ExpenseService.deleteExpense(activeBusiness.id, expenseId);
      loadExpenses();
    } catch (err: any) {
      alert(err?.message || (isFr ? 'Échec de suppression' : 'Failed to delete expense'));
    }
  };

  // Inventory Valuation Metric
  const totalInventoryValuation = useMemo(() => {
    return products.reduce((sum, p) => sum + p.stock_quantity * p.cost_price, 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.is_active && p.stock_quantity <= p.minimum_stock_level).length;
  }, [products]);

  const totalExpensesThisMonth = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {isFr ? 'Opérations Commerciales' : 'Business Operations'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {isFr
              ? 'Catalogue d’articles, registre de stock, catégories et charges pour '
              : 'Catalog items, atomic stock ledger, categories, and overhead expenses for '}
            <strong className="text-zinc-200">{activeBusiness?.name}</strong>
          </p>
        </div>

        {/* View Tabs Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 max-w-full overflow-x-auto self-stretch sm:self-auto no-scrollbar overscroll-x-contain touch-pan-x gap-1">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span>{isFr ? 'Catalogue Produits' : 'Products'}</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>{isFr ? 'Registre de Stock' : 'Stock Ledger'}</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5 shrink-0" />
            <span>{isFr ? 'Catégories' : 'Categories'}</span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 shrink-0" />
            <span>{t.navigation.expenses}</span>
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'team'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>{isFr ? 'Équipe & Personnel' : 'Team & Staff'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PRODUCTS CATALOG                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Section Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-800/80">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  <span>{isFr ? 'Catalogue Produits' : 'Products'}</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                  {products.length} {products.length === 1 ? (isFr ? 'article' : 'item') : (isFr ? 'articles' : 'items')}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isFr
                  ? 'Gérez vos niveaux de stock, prix de vente, codes-barres et marges bénéficiaires'
                  : 'Manage inventory stock levels, prices, barcodes, and product profit margins'}
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                resetProductForm();
                setIsAddProductModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.inventory.addProduct}</span>
            </Button>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[140px] sm:min-w-[220px] flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder={isFr ? 'Rechercher par nom, SKU ou description...' : 'Search products by name, SKU, or description...'}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">{isFr ? 'Toutes les catégories' : 'All Categories'}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">{isFr ? 'Tous les états de stock' : 'All Stock Statuses'}</option>
              <option value="in_stock">{isFr ? 'En stock' : 'In Stock'}</option>
              <option value="low_stock">{isFr ? 'Stock faible (≤ Seuil)' : 'Low Stock (≤ Alert level)'}</option>
              <option value="out_of_stock">{isFr ? 'Rupture de stock (0)' : 'Out of Stock (0)'}</option>
            </select>

            <button
              onClick={() => setShowArchivedProducts(!showArchivedProducts)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer ${
                showArchivedProducts
                  ? 'bg-amber-950/30 text-amber-300 border-amber-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
              title={isFr ? 'Afficher les produits archivés' : 'Toggle showing archived products in catalog'}
            >
              {showArchivedProducts ? (isFr ? 'Archivés Inclus' : 'Archived Included') : (isFr ? 'Voir Archivés' : 'Show Archived')}
            </button>
          </div>

          {/* Products Grid */}
          {loadingProducts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-36 rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <Card className="text-center py-12 space-y-3">
              <Package className="w-10 h-10 text-zinc-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-200">{isFr ? 'Aucun produit trouvé' : 'No products found'}</p>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  {productSearch || categoryFilter !== 'all' || stockStatusFilter !== 'all'
                    ? (isFr ? 'Aucun produit ne correspond à vos critères de recherche ou filtre.' : 'No products match your active search or filter criteria. Try clearing filters.')
                    : (isFr ? 'Commencez par ajouter votre premier produit pour activer les ventes et la gestion de stock.' : 'Get started by adding your first product to activate sales and stock management.')}
                </p>
              </div>
              {productSearch || categoryFilter !== 'all' || stockStatusFilter !== 'all' ? (
                <button
                  onClick={() => {
                    setProductSearch('');
                    setCategoryFilter('all');
                    setStockStatusFilter('all');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                >
                  {isFr ? 'Effacer les filtres' : 'Clear Filters'}
                </button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    resetProductForm();
                    setIsAddProductModalOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-1.5 font-semibold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isFr ? 'Ajouter un Premier Produit' : 'Add First Product'}</span>
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map((product) => {
                const marginAmount = Math.max(0, product.selling_price - product.cost_price);
                const marginPercent =
                  product.selling_price > 0
                    ? Math.round((marginAmount / product.selling_price) * 100)
                    : 0;

                const isService = product.product_type === 'service';
                const isOutOfStock = !isService && product.stock_quantity <= 0;
                const isLowStock =
                  !isService &&
                  product.stock_quantity > 0 &&
                  product.stock_quantity <= product.minimum_stock_level;

                const theme = getCategoryTheme(product.category?.name || (isService ? 'service' : ''), activeBusiness?.id);

                let cardBg = `${theme.bg} ${theme.border} ${theme.hoverBorder}`;
                if (!product.is_active) {
                  cardBg = 'bg-zinc-950/40 border-zinc-900 opacity-60';
                } else if (isOutOfStock) {
                  cardBg = 'bg-zinc-950/30 border-zinc-800/50 opacity-60';
                }

                return (
                  <div
                    key={product.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group relative overflow-hidden ${cardBg}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        {product.category ? (
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder} uppercase tracking-wider truncate max-w-[160px]`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.accentDot}`} />
                            <span className="truncate">{product.category.name}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                            {isFr ? 'Général' : 'General Product'}
                          </span>
                        )}
                        {!product.is_active && <Badge variant="zinc">{isFr ? 'Archivé' : 'Archived'}</Badge>}
                      </div>

                      <h3
                        onClick={() => handleViewProductDetail(product.id)}
                        className="text-sm font-bold text-zinc-100 hover:text-blue-400 cursor-pointer mt-2 line-clamp-1 group-hover:text-white transition-colors"
                      >
                        {product.name}
                      </h3>

                      {product.sku && (
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">SKU: {product.sku}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="text-[10px] text-zinc-400">{isFr ? 'Prix de vente' : 'Selling Price'}</p>
                          <p className="font-extrabold text-sm text-emerald-400">
                            {currencyConfig.format(product.selling_price)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-zinc-400">{isFr ? 'Achat / Marge' : 'Cost / Margin'}</p>
                          <p className="text-xs text-zinc-300 font-medium">
                            {currencyConfig.format(product.cost_price)}{' '}
                            <span className="text-emerald-400 text-[10px] font-bold">
                              (+{marginPercent}%)
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          {isOutOfStock ? (
                            <Badge variant="rose">0 {product.unit_of_measure || 'pcs'} {isFr ? 'en stock' : 'in stock'}</Badge>
                          ) : isLowStock ? (
                            <Badge variant="amber">{product.stock_quantity} {product.unit_of_measure || 'pcs'} ({isFr ? 'Faible' : 'Low'})</Badge>
                          ) : (
                            <Badge variant="emerald">{product.stock_quantity} {product.unit_of_measure || 'pcs'}</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setAdjustProductId(product.id);
                              setAdjustType('restock');
                              const targetReplenish = Math.max(10, ((product.minimum_stock_level || 5) * 2) - Math.max(0, product.stock_quantity || 0));
                              setAdjustQuantity(String(targetReplenish));
                              setAdjustReason(isFr ? 'Réapprovisionnement fournisseur' : 'Supplier replenishment restock');
                              setIsAdjustStockModalOpen(true);
                            }}
                            title={isFr ? 'Réapprovisionner le stock' : 'Restock Stock'}
                            className="p-1 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-950/20 cursor-pointer"
                          >
                            <Boxes className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditProduct(product)}
                            title={isFr ? 'Modifier le produit' : 'Edit Product'}
                            className="p-1 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-950/20 cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleProductArchive(product)}
                            title={product.is_active ? (isFr ? 'Archiver le produit' : 'Archive Product') : (isFr ? 'Désarchiver le produit' : 'Unarchive Product')}
                            className="p-1 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-amber-950/20 cursor-pointer"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmDeleteProduct(product)}
                            title={isFr ? 'Supprimer le produit' : 'Delete Product'}
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INVENTORY MOVEMENTS & STOCK LEDGER                                  */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400">
                {isFr ? 'Valeur Totale du Stock' : 'Total Inventory Valuation'}
              </span>
              <p className="text-xl font-extrabold text-white">
                {currencyConfig.format(totalInventoryValuation)}
              </p>
              <span className="text-[11px] text-zinc-400">{isFr ? 'Au coût d’achat historique' : 'At historical cost basis'}</span>
            </Card>

            <Card className="p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400">
                {isFr ? 'Références au Catalogue' : 'Catalog SKUs Tracked'}
              </span>
              <p className="text-xl font-extrabold text-blue-400">{products.length} {isFr ? 'Produits' : 'Products'}</p>
              <span className="text-[11px] text-zinc-400">{isFr ? 'Actifs et suivis' : 'Active and managed'}</span>
            </Card>

            <Card className="p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400">
                {isFr ? 'Alertes Stock Faible' : 'Low Stock Alerts'}
              </span>
              <p className="text-xl font-extrabold text-amber-400">{lowStockCount} {isFr ? 'Articles' : 'Items'}</p>
              <span className="text-[11px] text-zinc-400">{isFr ? 'Sous le seuil minimum' : 'Below minimum threshold'}</span>
            </Card>
          </div>

          {/* Action Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" /> {isFr ? 'Journal d’Audit de Stock' : 'Stock Audit Ledger'}
            </h3>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setAdjustProductId(products[0]?.id || '');
                setAdjustType('restock');
                setAdjustQuantity('1');
                setAdjustReason('');
                setAdjustNotes('');
                setIsAdjustStockModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isFr ? 'Enregistrer un Mouvement' : 'Record Stock Movement'}</span>
            </Button>
          </div>

          {/* Ledger Table */}
          {loadingInventory ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800"
                />
              ))}
            </div>
          ) : inventoryLedger.length === 0 ? (
            <Card className="text-center py-12 space-y-2">
              <Layers className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-zinc-300">{isFr ? 'Aucun mouvement de stock enregistré' : 'No inventory movements recorded'}</p>
              <p className="text-xs text-zinc-500">
                {isFr ? 'Le stock initial, les déductions des ventes, réapprovisionnements et audits apparaîtront ici.' : 'Initial stock, sales deductions, restocks, and audits will be logged here.'}
              </p>
            </Card>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-x-auto max-w-full overscroll-x-contain bg-zinc-900/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-800/80 text-zinc-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3">{isFr ? 'Date & Heure' : 'Date & Time'}</th>
                    <th className="py-3 px-3">{isFr ? 'Produit' : 'Product'}</th>
                    <th className="py-3 px-2">{isFr ? 'Type' : 'Type'}</th>
                    <th className="py-3 px-3 text-right">{isFr ? 'Quantité' : 'Quantity'}</th>
                    <th className="py-3 px-3">{isFr ? 'Référence / Notes' : 'Reference / Notes'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {inventoryLedger.map((tx) => {
                    const isPositive = ['purchase', 'restock', 'return', 'initial_stock'].includes(
                      tx.transaction_type
                    );
                    return (
                      <tr key={tx.id} className="hover:bg-zinc-800/30">
                        <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-zinc-200">
                          {tx.product?.name || (isFr ? 'Produit du catalogue' : 'Catalog Product')}
                          {tx.product?.sku && (
                            <span className="text-[10px] text-zinc-400 font-mono ml-2">
                              {tx.product.sku}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <Badge
                            variant={
                              tx.transaction_type === 'sale'
                                ? 'zinc'
                                : tx.transaction_type === 'restock' || tx.transaction_type === 'purchase'
                                ? 'emerald'
                                : tx.transaction_type === 'damage'
                                ? 'rose'
                                : 'blue'
                            }
                          >
                            {tx.transaction_type.toUpperCase()}
                          </Badge>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? `+${tx.quantity}` : `-${tx.quantity}`}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 truncate max-w-xs">
                          {tx.notes || tx.reference_type || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CATEGORIES                                                         */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {isFr ? 'Catégories de Produits' : 'Product Categories'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isFr ? 'Organisez votre catalogue pour un filtrage rapide en caisse' : 'Organize your catalog for fast filtering during sales'}
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingCatId(null);
                setCatName('');
                setCatDesc('');
                setIsCategoryModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isFr ? 'Ajouter une Catégorie' : 'Add Category'}</span>
            </Button>
          </div>

          {categories.length === 0 ? (
            <Card className="text-center py-12 space-y-2">
              <Tag className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-zinc-300">{isFr ? 'Aucune catégorie créée' : 'No categories created'}</p>
              <p className="text-xs text-zinc-500">
                {isFr ? 'Cliquez sur "+ Ajouter une Catégorie" pour créer des groupes de produits (ex. Boissons, Boulangerie).' : 'Click "+ Add Category" to create product groupings (e.g. Beverages, Bakery).'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {categories.map((cat) => {
                const assignedProds = products.filter((p) => p.category_id === cat.id);
                const theme = getCategoryTheme(cat.name, activeBusiness?.id);
                return (
                  <div
                    key={cat.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 group relative overflow-hidden ${theme.bg} ${theme.border} ${theme.hoverBorder}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-3.5 h-3.5 rounded-full ${theme.accentDot} mt-1 shrink-0 ring-4 ring-zinc-900/50`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-zinc-100 truncate">{cat.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder} shrink-0`}>
                            {assignedProds.length} {isFr ? 'prod.' : 'prod.'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {assignedProds.length} {isFr ? (assignedProds.length === 1 ? 'produit associé' : 'produits associés') : (assignedProds.length === 1 ? 'product assigned' : 'products assigned')}
                        </p>
                        {cat.description && (
                          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                            {cat.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          const overrides = getCategoryColorOverrides(activeBusiness?.id);
                          const existingColor = overrides[cat.name.toLowerCase()] || overrides[cat.id.toLowerCase()] || 'auto';
                          setEditingCatId(cat.id);
                          setCatName(cat.name);
                          setCatDesc(cat.description || '');
                          setCatColor(existingColor);
                          setIsCategoryModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-950/30 cursor-pointer"
                        title={isFr ? 'Modifier' : 'Edit'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer"
                        title={isFr ? 'Supprimer' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: EXPENSES                                                           */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && (
        <div className="space-y-5">
          {/* Top Summary Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                {isFr ? 'Dépenses & Charges d’Exploitation' : 'Operating Expenses'}
              </span>
              <h3 className="text-2xl font-black text-white mt-0.5">
                {currencyConfig.format(totalExpensesThisMonth)}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {expenses.length} {isFr ? 'dépenses enregistrées dans le journal' : 'expense entries recorded in ledger'}
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                resetExpenseForm();
                setIsAddExpenseModalOpen(true);
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 self-start sm:self-auto font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.finance.addExpense}</span>
            </Button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder={isFr ? 'Rechercher une dépense ou catégorie...' : 'Search expense description or category...'}
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <select
              value={expenseCatFilter}
              onChange={(e) => setExpenseCatFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
            >
              <option value="all">{isFr ? 'Toutes les catégories de dépense' : 'All Expense Categories'}</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Expenses List */}
          {loadingExpenses ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800"
                />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <Card className="text-center py-12 space-y-2">
              <Receipt className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-zinc-300">{isFr ? 'Aucune dépense enregistrée' : 'No expenses recorded'}</p>
              <p className="text-xs text-zinc-500">
                {isFr ? 'Enregistrez le loyer, l’électricité, les salaires et fournitures pour calculer le bénéfice net.' : 'Log rent, utilities, salaries, and operating supplies to compute net business profit.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp) => (
                <div
                  key={exp.id}
                  className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="amber">{exp.category}</Badge>
                      <span className="text-[10px] uppercase font-bold text-zinc-400">
                        {exp.payment_method.replace('_', ' ')}
                      </span>
                      {exp.is_recurring && <Badge variant="blue">{isFr ? 'Récurrent' : 'Recurring'}</Badge>}
                    </div>

                    <p className="text-xs font-semibold text-zinc-200">
                      {exp.description || exp.category}
                    </p>

                    <p className="text-[10px] text-zinc-400">
                      {new Date(exp.expense_date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-sm font-extrabold text-amber-400">
                      {currencyConfig.format(exp.amount)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingExpenseId(exp.id);
                          setExpCategory(exp.category);
                          setExpAmount(String(exp.amount));
                          setExpPaymentMethod(exp.payment_method);
                          setExpDate(exp.expense_date);
                          setExpDesc(exp.description || '');
                          setExpRecurring(exp.is_recurring);
                          setIsAddExpenseModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-amber-950/20 cursor-pointer"
                        title={isFr ? 'Modifier la dépense' : 'Edit Expense'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 cursor-pointer"
                        title={isFr ? 'Supprimer la dépense' : 'Delete Expense'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: TEAM & STAFF MANAGEMENT                                            */}
      {/* ========================================================================= */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <TeamManagementSection />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS: Product Create & Edit                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        title={editingProductId ? (isFr ? 'Modifier le Produit' : 'Edit Product') : (isFr ? 'Ajouter un Nouveau Produit' : 'Add New Product')}
        description={isFr ? 'Détails du catalogue, prix de revient et alertes de stock' : 'Catalog details, cost pricing, and stock alerts'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={`${isFr ? 'Nom du Produit' : 'Product Name'} *`}
              placeholder={isFr ? 'ex. Café Arabica 500g' : 'e.g. Arabica Coffee Beans 500g'}
              value={prodFormName}
              onChange={(e) => setProdFormName(e.target.value)}
              required
            />
            <Input
              label={isFr ? 'Code-barres / SKU' : 'SKU / Barcode'}
              placeholder="e.g. COF-001"
              value={prodFormSku}
              onChange={(e) => setProdFormSku(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">{isFr ? 'Catégorie' : 'Category'}</label>
              <select
                value={prodFormCategory}
                onChange={(e) => setProdFormCategory(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">{isFr ? 'Aucune catégorie' : 'No Category'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">{isFr ? 'Fournisseur' : 'Supplier'}</label>
              <select
                value={prodFormSupplier}
                onChange={(e) => setProdFormSupplier(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">{isFr ? 'Aucun fournisseur sélectionné' : 'No Supplier Selected'}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={`${isFr ? 'Prix de Vente' : 'Selling Price'} *`}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0.00"
              value={prodFormSellingPrice}
              onChange={(e) => setProdFormSellingPrice(e.target.value)}
              required
            />
            <Input
              label={`${isFr ? 'Prix d’Achat / Coût' : 'Cost Price'} *`}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0.00"
              value={prodFormCostPrice}
              onChange={(e) => setProdFormCostPrice(e.target.value)}
              required
            />
          </div>

          <div className={`grid ${!editingProductId ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'} gap-3`}>
            {!editingProductId && (
              <Input
                label={`${isFr ? 'Stock Initial' : 'Initial Stock'} (${prodFormUnit === 'custom' ? (prodFormCustomUnit.trim() || 'unités') : prodFormUnit}) *`}
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                value={prodFormStock}
                onChange={(e) => setProdFormStock(e.target.value)}
                required
              />
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">{isFr ? 'Unité de Mesure *' : 'Unit of Measure *'}</label>
              <select
                value={prodFormUnit}
                onChange={(e) => setProdFormUnit(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                {unitGroups.map((grp) => (
                  <optgroup key={grp.group} label={grp.group}>
                    {grp.units.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <Input
              label={`${isFr ? 'Alerte Stock Min.' : 'Min Stock Alert'} (${prodFormUnit === 'custom' ? (prodFormCustomUnit.trim() || 'unités') : prodFormUnit}) *`}
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="5"
              value={prodFormMinStock}
              onChange={(e) => setProdFormMinStock(e.target.value)}
              required
            />
          </div>

          {prodFormUnit === 'custom' && (
            <Input
              label={`${isFr ? 'Nom de l’Unité Personnalisée' : 'Custom Unit Name'} *`}
              placeholder={isFr ? 'ex. caisse, lot, seau, portion, fût' : 'e.g. crate, bundle, bucket, portion, drum'}
              value={prodFormCustomUnit}
              onChange={(e) => setProdFormCustomUnit(e.target.value)}
              required
            />
          )}

          <Input
            label={isFr ? 'Description' : 'Description'}
            placeholder={isFr ? 'Détails du produit, conditionnement, notes...' : 'Product details, packaging size, notes...'}
            value={prodFormDesc}
            onChange={(e) => setProdFormDesc(e.target.value)}
          />

          {productFormError && (
            <p className="text-xs text-rose-400 font-medium">{productFormError}</p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddProductModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!prodFormName.trim() || savingProduct}
              isLoading={savingProduct}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {editingProductId ? (isFr ? 'Mettre à Jour' : 'Update Product') : (isFr ? 'Créer le Produit' : 'Create Product')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODALS: Product Detail & Audit History Modal                              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        maxWidth="lg"
        title={selectedProductDetail?.product.name || (isFr ? 'Détails du Produit' : 'Product Details')}
        description={isFr ? 'Marges économiques, historique des ventes et mouvements de stock' : 'Economic margins, sales history, and inventory ledger'}
      >
        {loadingDetail ? (
          <div className="py-12 text-center text-zinc-400 animate-pulse">{isFr ? 'Chargement des détails...' : 'Loading product details...'}</div>
        ) : selectedProductDetail ? (
          <div className="space-y-6">
            {/* Economic Header Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
              <div>
                <span className="text-zinc-400">{isFr ? 'Prix de vente :' : 'Selling Price:'}</span>
                <p className="font-extrabold text-base text-emerald-400">
                  {currencyConfig.format(selectedProductDetail.product.selling_price)}
                </p>
              </div>
              <div>
                <span className="text-zinc-400">{isFr ? 'Prix d’achat :' : 'Cost Price:'}</span>
                <p className="font-semibold text-sm text-zinc-200">
                  {currencyConfig.format(selectedProductDetail.product.cost_price)}
                </p>
              </div>
              <div>
                <span className="text-zinc-400">{isFr ? 'Marge estimée :' : 'Estimated Margin:'}</span>
                <p className="font-bold text-sm text-emerald-300">
                  +{currencyConfig.format(
                    Math.max(0, selectedProductDetail.product.selling_price - selectedProductDetail.product.cost_price)
                  )}{' '}
                  (
                  {selectedProductDetail.product.selling_price > 0
                    ? Math.round(
                        ((selectedProductDetail.product.selling_price - selectedProductDetail.product.cost_price) /
                          selectedProductDetail.product.selling_price) *
                          100
                      )
                    : 0}
                  %)
                </p>
              </div>
              <div>
                <span className="text-zinc-400">{isFr ? 'Stock actuel :' : 'Current Stock:'}</span>
                <p className="font-extrabold text-sm text-white">
                  {selectedProductDetail.product.stock_quantity} {selectedProductDetail.product.unit_of_measure || 'units'}
                </p>
              </div>
            </div>

            {/* Inventory Movements for this Product */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {isFr ? 'Historique Récent du Stock' : 'Recent Inventory Audit Logs'}
              </h4>
              <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40 max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-800/80 text-zinc-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2 px-3">{isFr ? 'Date' : 'Date'}</th>
                      <th className="py-2 px-2">{isFr ? 'Type' : 'Type'}</th>
                      <th className="py-2 px-3 text-right">{isFr ? 'Quantité' : 'Quantity'}</th>
                      <th className="py-2 px-3">{isFr ? 'Notes' : 'Notes'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {selectedProductDetail.inventoryHistory.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2 px-3 text-zinc-400">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="blue">{tx.transaction_type}</Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-zinc-200">
                          {tx.quantity}
                        </td>
                        <td className="py-2 px-3 text-zinc-400 truncate max-w-xs">{tx.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sales History for this Product */}
            {selectedProductDetail.salesHistory.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {isFr ? 'Historique des Ventes' : 'Recent Sales Snapshots'}
                </h4>
                <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40 max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-800/80 text-zinc-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2 px-3">{isFr ? 'Date' : 'Date'}</th>
                        <th className="py-2 px-3">{isFr ? 'Client' : 'Customer'}</th>
                        <th className="py-2 px-2 text-center">{isFr ? 'Qté' : 'Qty'}</th>
                        <th className="py-2 px-3 text-right">{isFr ? 'Total Vente' : 'Sold At'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {selectedProductDetail.salesHistory.map((sh, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-zinc-400">
                            {new Date(sh.sold_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 font-semibold text-zinc-200">
                            {sh.customer_name || (isFr ? 'Comptoir / Anonyme' : 'Walk-in')}
                          </td>
                          <td className="py-2 px-2 text-center text-zinc-300">{sh.quantity}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-400">
                            {currencyConfig.format(sh.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
              >
                {t.common.close}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  const prod = selectedProductDetail.product;
                  confirmDeleteProduct(prod);
                }}
                className="flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isFr ? 'Supprimer' : 'Delete Product'}</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  const prod = selectedProductDetail.product;
                  setIsDetailModalOpen(false);
                  openEditProduct(prod as any);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 font-semibold cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isFr ? 'Modifier le Produit' : 'Edit Product'}</span>
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ========================================================================= */}
      {/* MODALS: Product Delete Confirmation Modal                                 */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeleteProductModalOpen}
        onClose={() => {
          if (!deletingProduct) {
            setIsDeleteProductModalOpen(false);
            setProductToDelete(null);
          }
        }}
        title={isFr ? 'Supprimer le Produit' : 'Delete Product'}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-950/30 border border-rose-900/50">
            <div className="p-2 rounded-lg bg-rose-900/40 text-rose-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-rose-200">{isFr ? 'Suppression Définitive' : 'Permanent Product Removal'}</p>
              <p className="text-zinc-300 leading-relaxed">
                {isFr
                  ? `Voulez-vous vraiment supprimer définitivement "${productToDelete?.name}" ? Il sera retiré de votre catalogue.`
                  : `Are you sure you want to delete "${productToDelete?.name}"? This will permanently remove the product from your active catalog.`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deletingProduct}
              onClick={() => {
                setIsDeleteProductModalOpen(false);
                setProductToDelete(null);
              }}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={deletingProduct}
              disabled={deletingProduct}
              onClick={handleDeleteProduct}
              className="flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isFr ? 'Confirmer la Suppression' : 'Yes, Delete Product'}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODALS: Stock Movement & Adjustment Modal                                 */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAdjustStockModalOpen}
        onClose={() => setIsAdjustStockModalOpen(false)}
        title={isFr ? 'Enregistrer un Mouvement de Stock' : 'Record Stock Movement'}
        description={isFr ? 'Réapprovisionnement, retour client ou inventaire d’audit' : 'Replenish stock, log customer returns, or perform manual inventory audit'}
      >
        <form onSubmit={handleSaveAdjustment} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">{isFr ? 'Sélectionner le Produit *' : 'Select Product *'}</label>
            <select
              value={adjustProductId}
              onChange={(e) => setAdjustProductId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">{isFr ? 'Choisir un produit à ajuster...' : 'Select product to adjust...'}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({isFr ? 'Actuel :' : 'Current:'} {p.stock_quantity} {p.unit_of_measure || 'units'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">{isFr ? 'Type de Mouvement *' : 'Movement Type *'}</label>
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as InventoryTransactionType)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                <option value="restock">{isFr ? 'Réapprovisionnement / Achat (+ Stock)' : 'Restock / Purchase (Adds stock)'}</option>
                <option value="return">{isFr ? 'Retour Client (+ Stock)' : 'Customer Return (Adds stock)'}</option>
                <option value="adjustment">{isFr ? 'Audit d’Inventaire (Fixe la cible)' : 'Stock Count Audit (Sets target)'}</option>
                <option value="damage">{isFr ? 'Perte / Casse / Avarie (- Stock)' : 'Damage / Loss (Deducts stock)'}</option>
              </select>
            </div>

            <Input
              label={`${isFr ? 'Quantité' : 'Quantity'} (${products.find((p) => p.id === adjustProductId)?.unit_of_measure || 'units'}) *`}
              type="number"
              inputMode="decimal"
              min="1"
              value={adjustQuantity}
              onChange={(e) => setAdjustQuantity(e.target.value)}
              required
            />
          </div>

          <Input
            label={`${isFr ? 'Motif / Explication du Mouvement' : 'Reason / Movement Explanation'} *`}
            placeholder={isFr ? 'ex. Réapprovisionnement hebdomadaire, comptage rayon' : 'e.g., Weekly supplier restock, shelf audit recount'}
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            required
          />

          <Input
            label={isFr ? 'Notes Complémentaires / N° Facture' : 'Additional Notes / Supplier Memo'}
            placeholder={isFr ? 'Optionnel : n° facture ou détails...' : 'Optional invoice # or notes...'}
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
          />

          {adjustError && <p className="text-xs text-rose-400 font-medium">{adjustError}</p>}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAdjustStockModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!adjustProductId || savingAdjustment}
              isLoading={savingAdjustment}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isFr ? 'Enregistrer le Mouvement' : 'Save Movement'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODALS: Category Create & Edit                                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCatId ? (isFr ? 'Modifier la Catégorie' : 'Edit Category') : (isFr ? 'Créer une Catégorie' : 'Create Category')}
        description={isFr ? 'Organisez vos produits pour la caisse et les rapports' : 'Organize products for POS and reporting'}
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <Input
            label={`${isFr ? 'Nom de la Catégorie' : 'Category Name'} *`}
            placeholder={isFr ? 'ex. Boissons Chaudes, Boulangerie, Vêtements' : 'e.g. Hot Drinks, Bakery, Apparel'}
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />
          <Input
            label={isFr ? 'Description' : 'Description'}
            placeholder={isFr ? 'Description optionnelle...' : 'Optional category description...'}
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
          />

          {/* Color & Theme Picker */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">
                {isFr ? 'Couleur & Thème de Carte' : 'Card Color & Theme'}
              </label>
              <span className="text-[11px] text-zinc-400">
                {catColor === 'auto'
                  ? (isFr ? 'Attribution automatique' : 'Auto-assigned')
                  : CATEGORY_PALETTES.find((p) => p.id === catColor)?.name || catColor}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {/* Auto Option */}
              <button
                type="button"
                onClick={() => setCatColor('auto')}
                className={`h-9 rounded-xl border flex flex-col items-center justify-center text-[10px] font-bold transition-all cursor-pointer ${
                  catColor === 'auto'
                    ? 'border-white bg-zinc-800 text-white ring-2 ring-white/20'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
                title={isFr ? 'Automatique (basé sur le nom)' : 'Automatic (based on category name)'}
              >
                Auto
              </button>

              {/* Palette swatches */}
              {CATEGORY_PALETTES.map((pal) => {
                const isSelected = catColor === pal.id;
                return (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => setCatColor(pal.id)}
                    className={`h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer relative group ${pal.bg} ${
                      isSelected
                        ? 'border-white ring-2 ring-white/30 scale-105 z-10'
                        : `${pal.border} hover:border-zinc-500`
                    }`}
                    title={pal.name}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${pal.accentDot} shadow-sm ring-1 ring-black/30`} />
                  </button>
                );
              })}
            </div>

            {/* Live Preview Card */}
            <div className="pt-2">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                {isFr ? 'Aperçu de la carte produit' : 'Live Product Card Preview'}
              </span>
              {(() => {
                const previewTheme = getCategoryTheme(
                  catName.trim() || 'Sample',
                  activeBusiness?.id,
                  catColor !== 'auto' ? catColor : null
                );
                return (
                  <div className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${previewTheme.bg} ${previewTheme.border}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${previewTheme.accentDot}`} />
                      <div className="min-w-0">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border ${previewTheme.badgeBg} ${previewTheme.badgeText} ${previewTheme.badgeBorder} uppercase tracking-wider`}>
                          {catName.trim() || (isFr ? 'Nom Catégorie' : 'Category Name')}
                        </span>
                        <p className="text-xs font-bold text-zinc-100 mt-1 truncate">
                          {isFr ? 'Exemple de Produit' : 'Sample Product Title'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-400 shrink-0">
                      {currencyConfig.format(1500)}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {catError && <p className="text-xs text-rose-400 font-medium">{catError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!catName.trim() || savingCategory}
              isLoading={savingCategory}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isFr ? 'Enregistrer la Catégorie' : 'Save Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODALS: Expense Create & Edit                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddExpenseModalOpen}
        onClose={() => setIsAddExpenseModalOpen(false)}
        title={editingExpenseId ? (isFr ? 'Modifier la Dépense' : 'Edit Expense Record') : (isFr ? 'Enregistrer une Dépense' : 'Record Business Expense')}
        description={isFr ? 'Suivez les charges opérationnelles, fournitures et loyers' : 'Track operating overhead, supplies, and rent'}
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">{isFr ? 'Catégorie de Dépense *' : 'Expense Category *'}</label>
            <select
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`${isFr ? 'Montant Payé' : 'Amount Paid'} *`}
              type="number"
              min="0.01"
              step="any"
              placeholder="0.00"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              required
            />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">{isFr ? 'Mode de Règlement *' : 'Payment Method *'}</label>
              <select
                value={expPaymentMethod}
                onChange={(e) => setExpPaymentMethod(e.target.value as PaymentMethodType)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="cash">{isFr ? 'Espèces' : 'Cash'}</option>
                <option value="mobile_money">{isFr ? 'Mobile Money (MTN / Orange / Wave)' : 'Mobile Money'}</option>
                <option value="bank_transfer">{isFr ? 'Virement Bancaire' : 'Bank Transfer'}</option>
                <option value="card">{isFr ? 'Carte Bancaire' : 'Card / POS'}</option>
                <option value="other">{isFr ? 'Autre' : 'Other'}</option>
              </select>
            </div>
          </div>

          <Input
            label={`${isFr ? 'Date de la Dépense' : 'Expense Date'} *`}
            type="date"
            value={expDate}
            onChange={(e) => setExpDate(e.target.value)}
            required
          />

          <Input
            label={isFr ? 'Description / Bénéficiaire' : 'Description / Vendor'}
            placeholder={isFr ? 'ex. Carburant groupe électrogène, Facture électricité' : 'e.g. Office generator fuel, Shop electricity bill'}
            value={expDesc}
            onChange={(e) => setExpDesc(e.target.value)}
          />

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={expRecurring}
              onChange={(e) => setExpRecurring(e.target.checked)}
              className="rounded border-zinc-800 bg-zinc-950 text-amber-500 focus:ring-amber-500/20"
            />
            <span className="text-xs text-zinc-300">{isFr ? 'Dépense mensuelle récurrente' : 'Recurring monthly expense'}</span>
          </label>

          {expenseError && <p className="text-xs text-rose-400 font-medium">{expenseError}</p>}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddExpenseModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!expAmount || savingExpense}
              isLoading={savingExpense}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {isFr ? 'Enregistrer la Dépense' : 'Save Expense'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
