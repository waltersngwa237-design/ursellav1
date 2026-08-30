import React, { useState, useEffect, useMemo } from 'react';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { CustomerService, type CreateCustomerInput, type CustomerProfileResult } from '../../services/customer.service.ts';
import { PDFAndPrintService } from '../../services/pdf.service.ts';
import { Card } from '../../components/common/Card.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { SaleDetailModal } from '../../components/sales/SaleDetailModal.tsx';
import { SalesService } from '../../services/sales.service.ts';
import {
  CURRENCY_MAP,
  type CustomerWithSummary,
  type PaymentMethodType,
  type SaleWithDetails,
} from '../../types/index.ts';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Receipt,
  CreditCard,
  Edit2,
  Archive,
  ArrowUpRight,
  Clock,
  ChevronRight,
  X,
  Printer,
  Download,
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const { activeBusiness, currency } = useBusiness();
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF;

  const [customers, setCustomers] = useState<CustomerWithSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debt_only' | 'active' | 'archived'>('all');

  // Customer Modals
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custLocation, setCustLocation] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Customer Profile Detail Modal
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<CustomerProfileResult | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Settle Debt Modal
  const [isSettleDebtModalOpen, setIsSettleDebtModalOpen] = useState(false);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState<string>('');
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<PaymentMethodType>('cash');
  const [debtPaymentRef, setDebtPaymentRef] = useState('');
  const [debtPaymentNotes, setDebtPaymentNotes] = useState('');
  const [processingDebtPayment, setProcessingDebtPayment] = useState(false);
  const [debtPaymentError, setDebtPaymentError] = useState<string | null>(null);

  // Sale Receipt Modal (from customer profile)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleWithDetails | null>(null);
  const [isSaleDetailOpen, setIsSaleDetailOpen] = useState(false);

  // Load Customers
  const loadCustomers = async () => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    try {
      const data = await CustomerService.getCustomers(activeBusiness.id, {
        search: searchQuery,
        hasOutstandingDebt: filterType === 'debt_only' ? true : undefined,
        isActive: filterType === 'archived' ? false : filterType === 'active' ? true : undefined,
      });
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [activeBusiness?.id, filterType, searchQuery]);

  // KPIs
  const totalReceivables = useMemo(() => {
    return customers.reduce((sum, c) => sum + c.outstanding_balance, 0);
  }, [customers]);

  const debtCustomersCount = useMemo(() => {
    return customers.filter((c) => c.outstanding_balance > 0).length;
  }, [customers]);

  // Open Customer Detail
  const handleOpenCustomerProfile = async (customerId: string) => {
    if (!activeBusiness?.id) return;
    setLoadingProfile(true);
    setIsProfileModalOpen(true);
    try {
      const profile = await CustomerService.getCustomerProfile(activeBusiness.id, customerId);
      setSelectedCustomerProfile(profile);
    } catch (err) {
      console.error('Failed to load customer profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Open Settle Debt Modal
  const handleOpenSettleDebt = (cust: CustomerWithSummary) => {
    setSelectedCustomerProfile((prev) => (prev ? prev : ({ customer: cust, sales: [], payments: [] } as any)));
    setDebtPaymentAmount(String(cust.outstanding_balance));
    setDebtPaymentMethod('cash');
    setDebtPaymentRef('');
    setDebtPaymentNotes('Debt Settlement Payment');
    setDebtPaymentError(null);
    setIsSettleDebtModalOpen(true);
  };

  // Submit Debt Payment
  const handleProcessDebtPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id || !selectedCustomerProfile?.customer.id) return;

    setProcessingDebtPayment(true);
    setDebtPaymentError(null);

    try {
      const amt = Number(debtPaymentAmount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error('Payment amount must be greater than zero.');
      }

      await CustomerService.recordDebtPayment({
        business_id: activeBusiness.id,
        customer_id: selectedCustomerProfile.customer.id,
        amount: amt,
        payment_method: debtPaymentMethod,
        reference: debtPaymentRef || null,
        notes: debtPaymentNotes || null,
      });

      setIsSettleDebtModalOpen(false);
      loadCustomers();
      if (isProfileModalOpen) {
        handleOpenCustomerProfile(selectedCustomerProfile.customer.id);
      }
    } catch (err: any) {
      setDebtPaymentError(err?.message || 'Failed to record payment.');
    } finally {
      setProcessingDebtPayment(false);
    }
  };

  // Save Customer (Create or Edit)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id || !custName.trim()) return;

    setSavingCustomer(true);
    setCustomerError(null);

    try {
      if (editingCustomerId) {
        await CustomerService.updateCustomer(activeBusiness.id, editingCustomerId, {
          name: custName.trim(),
          phone: custPhone.trim() || null,
          email: custEmail.trim() || null,
          location: custLocation.trim() || null,
          notes: custNotes.trim() || null,
        });
      } else {
        await CustomerService.createCustomer({
          business_id: activeBusiness.id,
          name: custName.trim(),
          phone: custPhone.trim() || null,
          email: custEmail.trim() || null,
          location: custLocation.trim() || null,
          notes: custNotes.trim() || null,
        });
      }

      setIsAddCustomerModalOpen(false);
      resetCustomerForm();
      loadCustomers();
    } catch (err: any) {
      setCustomerError(err?.message || 'Failed to save customer.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const resetCustomerForm = () => {
    setEditingCustomerId(null);
    setCustName('');
    setCustPhone('');
    setCustEmail('');
    setCustLocation('');
    setCustNotes('');
    setCustomerError(null);
  };

  const openEditCustomer = (cust: CustomerWithSummary) => {
    setEditingCustomerId(cust.id);
    setCustName(cust.name);
    setCustPhone(cust.phone || '');
    setCustEmail(cust.email || '');
    setCustLocation(cust.location || '');
    setCustNotes(cust.notes || '');
    setIsAddCustomerModalOpen(true);
  };

  const handleToggleCustomerArchive = async (cust: CustomerWithSummary) => {
    if (!activeBusiness?.id) return;
    try {
      await CustomerService.toggleCustomerActive(activeBusiness.id, cust.id, !cust.is_active);
      loadCustomers();
      if (selectedCustomerProfile && selectedCustomerProfile.customer.id === cust.id) {
        setIsProfileModalOpen(false);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update customer status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Customer Directory & Debt Ledger
            </h1>
            <Badge variant="purple" size="sm">
              CRM Engine
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Accounts, customer transaction history, and outstanding credit balances for{' '}
            <strong className="text-zinc-200">{activeBusiness?.name}</strong>
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            resetCustomerForm();
            setIsAddCustomerModalOpen(true);
          }}
          className="bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Customer</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-400">
            Total Outstanding Receivables
          </span>
          <p className="text-xl font-extrabold text-rose-400">
            {currencyConfig.format(totalReceivables)}
          </p>
          <span className="text-[11px] text-zinc-400">Across all credit sales</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-400">
            Customers with Debt
          </span>
          <p className="text-xl font-extrabold text-amber-400">
            {debtCustomersCount} Accounts
          </p>
          <span className="text-[11px] text-zinc-400">Require payment collection</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-400">
            Total Customer Accounts
          </span>
          <p className="text-xl font-extrabold text-purple-400">
            {customers.length} Profiles
          </p>
          <span className="text-[11px] text-zinc-400">Registered in business</span>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search customers by name, phone, email, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Customers' },
            { id: 'debt_only', label: 'With Debt ⚠️' },
            { id: 'active', label: 'Active Only' },
            { id: 'archived', label: 'Archived' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            onClick={() =>
              PDFAndPrintService.exportCustomerListPDF(
                customers,
                activeBusiness,
                currencyConfig,
                filterType === 'debt_only'
                  ? 'Customer Debt & Outstanding Balance Statement'
                  : filterType === 'archived'
                  ? 'Archived Customer Accounts'
                  : 'Customer Directory & Accounts'
              )
            }
            disabled={customers.length === 0}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap disabled:opacity-40"
            title="Export Customers or Debt Ledger to PDF"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Customer List / Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800"
            />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <Card className="text-center py-12 space-y-2">
          <Users className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm font-semibold text-zinc-300">No customers found</p>
          <p className="text-xs text-zinc-500">
            {searchQuery || filterType !== 'all'
              ? 'Try changing your search or filter options.'
              : 'Add customer profiles to track repeat sales and store debt.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {customers.map((cust) => {
            const hasDebt = cust.outstanding_balance > 0;

            return (
              <div
                key={cust.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between group ${
                  !cust.is_active
                    ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
                    : hasDebt
                    ? 'bg-zinc-900/90 border-amber-500/30 hover:border-amber-500/60 shadow-sm shadow-amber-950/20'
                    : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      onClick={() => handleOpenCustomerProfile(cust.id)}
                      className="text-sm font-bold text-zinc-100 hover:text-purple-400 cursor-pointer line-clamp-1"
                    >
                      {cust.name}
                    </h3>
                    {!cust.is_active && <Badge variant="zinc">Archived</Badge>}
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-zinc-400">
                    {cust.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{cust.phone}</span>
                      </p>
                    )}
                    {cust.location && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="truncate">{cust.location}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] text-zinc-400">Lifetime Spent</p>
                      <p className="font-bold text-zinc-200">
                        {currencyConfig.format(cust.total_spent)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-zinc-400">Debt Balance</p>
                      {hasDebt ? (
                        <p className="font-extrabold text-rose-400">
                          {currencyConfig.format(cust.outstanding_balance)}
                        </p>
                      ) : (
                        <p className="font-semibold text-emerald-400">Clear ($0)</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleOpenCustomerProfile(cust.id)}
                      className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                    >
                      <span>View Profile & History</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1">
                      {hasDebt && (
                        <button
                          onClick={() => handleOpenSettleDebt(cust)}
                          title="Settle Debt"
                          className="p-1 px-2 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 shadow-sm"
                        >
                          Settle
                        </button>
                      )}
                      <button
                        onClick={() => openEditCustomer(cust)}
                        title="Edit Customer"
                        className="p-1 rounded-lg text-zinc-400 hover:text-purple-400 hover:bg-purple-950/20"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS: Customer Create & Edit Modal                                      */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        title={editingCustomerId ? 'Edit Customer' : 'Add New Customer'}
        description="Register customer account to track purchases and credit orders"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          <Input
            label="Customer Name *"
            placeholder="e.g. John Doe / Grace Enterprise"
            value={custName}
            onChange={(e) => setCustName(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              placeholder="e.g. +237 670 000 000"
              value={custPhone}
              onChange={(e) => setCustPhone(e.target.value)}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="customer@example.com"
              value={custEmail}
              onChange={(e) => setCustEmail(e.target.value)}
            />
          </div>

          <Input
            label="Physical Location / Delivery Address"
            placeholder="e.g. Douala, Bonanjo Market Stall 12"
            value={custLocation}
            onChange={(e) => setCustLocation(e.target.value)}
          />

          <Input
            label="Customer Notes"
            placeholder="e.g. Wholesale buyer, pays on Fridays"
            value={custNotes}
            onChange={(e) => setCustNotes(e.target.value)}
          />

          {customerError && (
            <p className="text-xs text-rose-400 font-medium">{customerError}</p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddCustomerModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!custName.trim() || savingCustomer}
              isLoading={savingCustomer}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              {editingCustomerId ? 'Update Customer' : 'Save Customer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODALS: Customer Profile & Order History Modal                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        maxWidth="lg"
        title={selectedCustomerProfile?.customer.name || 'Customer Profile'}
        description="Purchases, debt status, and payment receipts"
      >
        {loadingProfile ? (
          <div className="py-12 text-center text-zinc-400 animate-pulse">Loading customer profile...</div>
        ) : selectedCustomerProfile ? (
          <div className="space-y-6">
            {/* Customer Contact & Stats Banner */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedCustomerProfile.customer.name}
                  </h3>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-400 mt-1">
                    {selectedCustomerProfile.customer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-zinc-500" />
                        {selectedCustomerProfile.customer.phone}
                      </span>
                    )}
                    {selectedCustomerProfile.customer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-zinc-500" />
                        {selectedCustomerProfile.customer.email}
                      </span>
                    )}
                  </div>
                </div>

                {selectedCustomerProfile.customer.outstanding_balance > 0 ? (
                  <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-right">
                    <span className="text-[10px] uppercase font-bold text-rose-400">
                      Outstanding Debt
                    </span>
                    <p className="text-lg font-black text-rose-300">
                      {currencyConfig.format(selectedCustomerProfile.customer.outstanding_balance)}
                    </p>
                  </div>
                ) : (
                  <Badge variant="emerald" size="md">
                    No Outstanding Debt
                  </Badge>
                )}
              </div>

              {/* Economic Summary Cards */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-zinc-400">Total Spent:</span>
                  <p className="font-extrabold text-sm text-emerald-400">
                    {currencyConfig.format(selectedCustomerProfile.customer.total_spent)}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-400">Completed Orders:</span>
                  <p className="font-bold text-sm text-zinc-200">
                    {selectedCustomerProfile.customer.purchase_count} Sales
                  </p>
                </div>
                <div>
                  <span className="text-zinc-400">Last Purchase:</span>
                  <p className="font-semibold text-xs text-zinc-300">
                    {selectedCustomerProfile.customer.last_purchase_at
                      ? new Date(selectedCustomerProfile.customer.last_purchase_at).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              {/* Settle Debt Button Action */}
              {selectedCustomerProfile.customer.outstanding_balance > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenSettleDebt(selectedCustomerProfile.customer)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 font-bold"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>
                    Record Debt Payment (
                    {currencyConfig.format(selectedCustomerProfile.customer.outstanding_balance)})
                  </span>
                </Button>
              )}

              {/* Statement Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    PDFAndPrintService.printCustomerStatementDirectly(
                      selectedCustomerProfile.customer,
                      selectedCustomerProfile.sales,
                      selectedCustomerProfile.payments,
                      activeBusiness,
                      currencyConfig
                    );
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Print Statement</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    PDFAndPrintService.exportCustomerStatementPDF(
                      selectedCustomerProfile.customer,
                      selectedCustomerProfile.sales,
                      selectedCustomerProfile.payments,
                      activeBusiness,
                      currencyConfig
                    );
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Statement PDF</span>
                </Button>
              </div>
            </div>

            {/* Sales Purchase History Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-zinc-400" /> Order History
              </h4>

              {selectedCustomerProfile.sales.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-xs rounded-xl bg-zinc-900/40 border border-zinc-800">
                  No orders recorded for this customer yet.
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40 max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-800/80 text-zinc-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Paid</th>
                        <th className="py-2.5 px-3 text-right">Due</th>
                        <th className="py-2.5 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {selectedCustomerProfile.sales.map((sale) => (
                        <tr
                          key={sale.id}
                          onClick={async () => {
                            if (!activeBusiness?.id) return;
                            const detail = await SalesService.getSaleDetail(activeBusiness.id, sale.id);
                            setSelectedSaleDetail(detail);
                            setIsSaleDetailOpen(true);
                          }}
                          className="hover:bg-zinc-800/30 cursor-pointer"
                        >
                          <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">
                            {new Date(sale.sold_at).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-zinc-200">
                            {currencyConfig.format(sale.total)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">
                            {currencyConfig.format(sale.amount_paid)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              sale.amount_due > 0 ? 'text-rose-400' : 'text-zinc-500'
                            }`}
                          >
                            {currencyConfig.format(sale.amount_due)}
                          </td>
                          <td className="py-2.5 px-2 text-center">
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment Receipts History */}
            {selectedCustomerProfile.payments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-zinc-400" /> Recorded Payment Receipts
                </h4>
                <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40 max-h-40 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-800/80 text-zinc-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-2">Method</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3">Reference / Memo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {selectedCustomerProfile.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 text-zinc-400">
                            {new Date(p.paid_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-2 uppercase font-bold text-[10px] text-zinc-300">
                            {p.payment_method.replace('_', ' ')}
                          </td>
                          <td className="py-2 px-3 text-right font-extrabold text-emerald-400">
                            {currencyConfig.format(p.amount)}
                          </td>
                          <td className="py-2 px-3 text-zinc-400 truncate max-w-xs">{p.notes || p.reference || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* ========================================================================= */}
      {/* MODALS: Settle Debt Payment Modal                                         */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isSettleDebtModalOpen}
        onClose={() => setIsSettleDebtModalOpen(false)}
        title="Record Debt Settlement Payment"
        description={`Record payment received from ${selectedCustomerProfile?.customer.name}`}
      >
        <form onSubmit={handleProcessDebtPayment} className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex justify-between text-xs">
            <span className="text-amber-300 font-semibold">Current Outstanding Balance:</span>
            <span className="text-amber-200 font-extrabold text-sm">
              {selectedCustomerProfile
                ? currencyConfig.format(selectedCustomerProfile.customer.outstanding_balance)
                : '$0.00'}
            </span>
          </div>

          <Input
            label="Payment Amount Received *"
            type="number"
            min="0.01"
            step="any"
            placeholder="0.00"
            value={debtPaymentAmount}
            onChange={(e) => setDebtPaymentAmount(e.target.value)}
            required
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Payment Method *</label>
            <select
              value={debtPaymentMethod}
              onChange={(e) => setDebtPaymentMethod(e.target.value as PaymentMethodType)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Input
            label="Payment Reference / Transaction ID"
            placeholder="e.g. MoMo ID: TX1029482"
            value={debtPaymentRef}
            onChange={(e) => setDebtPaymentRef(e.target.value)}
          />

          <Input
            label="Notes / Receipt Memo"
            placeholder="e.g. Settle balance for Invoice #8"
            value={debtPaymentNotes}
            onChange={(e) => setDebtPaymentNotes(e.target.value)}
          />

          {debtPaymentError && (
            <p className="text-xs text-rose-400 font-medium">{debtPaymentError}</p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSettleDebtModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!debtPaymentAmount || processingDebtPayment}
              isLoading={processingDebtPayment}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Confirm Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODALS: Sale Detail & Receipt Modal                                       */}
      {/* ========================================================================= */}
      <SaleDetailModal
        isOpen={isSaleDetailOpen}
        onClose={() => setIsSaleDetailOpen(false)}
        sale={selectedSaleDetail}
        onSaleUpdated={() => {
          loadCustomers();
          if (selectedCustomerProfile) {
            handleOpenCustomerProfile(selectedCustomerProfile.customer.id);
          }
        }}
      />
    </div>
  );
};
