import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Toast from '../components/ui/Toast';
import PageHeader from '../components/PageHeader';
import RequirePermission from '../components/RequirePermission';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';

type Campaign = {
  id: string;
  name: string;
  categories: string[];
  status?: string;
};

type Account = {
  id: string;
  name: string;
  tiktokHandle?: string;
  accountType: 'CROSSBRAND' | 'NEW_PERSONA' | 'KOL' | 'PROXY';
  brand?: string;
  notes?: string;
  campaigns?: Campaign[];
  postCount?: number;
  kpiCount?: number;
  isCrossbrand?: boolean;
};

export default function AccountsPage() {
  const { token } = useAuth();
  const { canAddAccount, canEditAccount, canDelete } = usePermissions();
  const [items, setItems] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accountKpiMap, setAccountKpiMap] = useState<Map<string, Record<string, { target: number; actual: number }>>>(new Map());
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [crossbrand, setCrossbrand] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; hasBlockers: boolean; blockerMessage?: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [form, setForm] = useState({
    name: '',
    tiktokHandle: '',
    accountType: '' as 'CROSSBRAND' | 'NEW_PERSONA' | 'KOL' | 'PROXY' | '',
    notes: '',
    campaignIds: [] as string[],
  });
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [originalCampaignIds, setOriginalCampaignIds] = useState<string[]>([]);
  type SortKey = 'name' | 'accountType' | 'postCount' | 'campaignCount' | 'views' | 'qtyPost' | 'fypCount';
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  const kpiDisplayCategories: Array<'VIEWS' | 'QTY_POST' | 'FYP_COUNT'> = ['VIEWS', 'QTY_POST', 'FYP_COUNT'];
  const kpiLabels: Record<string, string> = {
    VIEWS: 'KPI Views',
    QTY_POST: 'KPI Qty Post',
    FYP_COUNT: 'KPI FYP Count',
  };

  const applyClientFilters = useCallback((accounts: Account[]) => {
    let filtered = accounts;
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      filtered = filtered.filter(acc =>
        acc.name.toLowerCase().includes(query) ||
        (acc.tiktokHandle || '').toLowerCase().includes(query)
      );
    }
    if (type) {
      filtered = filtered.filter(acc => acc.accountType === type);
    }
    if (crossbrand) {
      filtered = filtered.filter(acc => {
        const isCross = acc.isCrossbrand ?? false;
        return crossbrand === 'true' ? isCross : !isCross;
      });
    }
    if (campaignFilter) {
      filtered = filtered.filter(acc => {
        const accountCampaign = (acc.campaigns || []).find(c => c.id === campaignFilter);
        if (!accountCampaign) return false;
        const campaign = campaigns.find(cmp => cmp.id === campaignFilter);
        return campaign?.status === 'ACTIVE';
      });
    }
    return filtered;
  }, [search, type, crossbrand, campaignFilter, campaigns]);

  const sortAccounts = useCallback((accounts: Account[]) => {
    const getSortValue = (a: Account, key: SortKey) => {
      switch (key) {
        case 'name':
          return a.name || '';
        case 'accountType':
          return a.accountType || '';
        case 'postCount':
          return a.postCount ?? 0;
        case 'campaignCount':
          return (a.campaigns || []).filter(c => {
            const campaign = campaigns.find(cmp => cmp.id === c.id);
            return campaign?.status === 'ACTIVE';
          }).length;
        case 'views':
          return accountKpiMap.get(a.id)?.VIEWS?.actual ?? 0;
        case 'qtyPost':
          return accountKpiMap.get(a.id)?.QTY_POST?.actual ?? 0;
        case 'fypCount':
          return accountKpiMap.get(a.id)?.FYP_COUNT?.actual ?? 0;
        default:
          return '';
      }
    };

    return [...accounts].sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key);
      const bVal = getSortValue(b, sortConfig.key);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const comparison = aVal.toString().localeCompare(bVal.toString(), undefined, { sensitivity: 'base', numeric: true });
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [sortConfig, accountKpiMap, campaigns]);

  const fetchAccountKpis = async (accountsList: Account[]) => {
    // First, collect all campaign IDs from accounts
    const allCampaignIds = new Set<string>();
    accountsList.forEach((account) => {
      (account.campaigns || []).forEach((c) => allCampaignIds.add(c.id));
    });

    if (allCampaignIds.size === 0) {
      setAccountKpiMap(new Map());
      return;
    }

    // Fetch campaign details to filter for active campaigns only
    let activeCampaignIds: string[] = [];
    try {
      const allCampaigns = await api('/campaigns', { token });
      const activeCampaigns = (allCampaigns || []).filter((c: any) => c.status === 'ACTIVE');
      activeCampaignIds = activeCampaigns.map((c: any) => c.id);
    } catch (error) {
      console.error('Failed to fetch campaigns for status filtering:', error);
      // If we can't fetch campaigns, fall back to empty array (no KPIs will be shown)
      setAccountKpiMap(new Map());
      return;
    }

    // Filter to only include active campaigns that are associated with accounts
    const campaignIds = Array.from(allCampaignIds).filter(id => activeCampaignIds.includes(id));

    if (campaignIds.length === 0) {
      setAccountKpiMap(new Map());
      return;
    }

    const nextMap = new Map<string, Record<string, { target: number; actual: number }>>();
    const promises = campaignIds.map(async (campaignId) => {
      try {
        const kpis = await api(`/campaigns/${campaignId}/kpis`, { token });
        (kpis || []).forEach((k: any) => {
          if (!k.accountId) return;
          const accountId = k.accountId as string;
          const category = k.category as string;
          const target = Number(k.target ?? 0);
          const actual = Number(k.actual ?? 0);
          if (!nextMap.has(accountId)) {
            nextMap.set(accountId, {});
          }
          const existing = nextMap.get(accountId)![category] || { target: 0, actual: 0 };
          nextMap.get(accountId)![category] = {
            target: existing.target + target,
            actual: existing.actual + actual,
          };
        });
      } catch (error) {
        console.error(`Failed to fetch KPIs for campaign ${campaignId}:`, error);
      }
    });

    await Promise.allSettled(promises);
    setAccountKpiMap(nextMap);
  };

  const fetchAccounts = async () => {
    setLoading(true);
    setKpiLoading(true);
    try {
      const data = await api(`/accounts`, { token });
      setAllAccounts(data);
      setItems(sortAccounts(applyClientFilters(data)));
      await fetchAccountKpis(data);
    } catch (error) {
      console.error('Failed to fetch accounts', error);
      setAllAccounts([]);
      setItems([]);
      setAccountKpiMap(new Map());
    } finally {
      setLoading(false);
      setKpiLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [token]);

  useEffect(() => {
    setItems(sortAccounts(applyClientFilters(allAccounts)));
  }, [applyClientFilters, sortAccounts, allAccounts]);

  useEffect(() => {
    api('/campaigns', { token }).then(setCampaigns).catch(() => setCampaigns([]));
  }, [token]);

  const resetForm = () => {
    setForm({
      name: '',
      tiktokHandle: '',
      accountType: '',
      notes: '',
      campaignIds: [],
    });
    setSelectedCampaign('');
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.accountType) {
      setToast({ message: 'Name and account type are required', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await api('/accounts', {
        method: 'POST',
        token,
        body: {
          name: form.name,
          tiktokHandle: form.tiktokHandle || undefined,
          accountType: form.accountType,
          notes: form.notes || undefined,
          campaignIds: form.campaignIds.length > 0 ? form.campaignIds : undefined,
        },
      });
      resetForm();
      setShowAddForm(false);
      fetchAccounts();
      setToast({ message: 'Account added successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.error || 'Failed to add account', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAccount = (account: Account) => {
    const existingCampaignIds = account.campaigns?.map(c => c.id) || [];
    setEditingId(account.id);
    setOriginalCampaignIds(existingCampaignIds);
    setForm({
      name: account.name,
      tiktokHandle: account.tiktokHandle || '',
      accountType: account.accountType,
      notes: account.notes || '',
      campaignIds: existingCampaignIds,
    });
    setSelectedCampaign('');
    setShowAddForm(false);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !form.name.trim() || !form.accountType) {
      setToast({ message: 'Name and account type are required', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      // Only send newly added campaigns (campaigns not in originalCampaignIds)
      const newCampaignIds = form.campaignIds.filter(id => !originalCampaignIds.includes(id));
      await api(`/accounts/${editingId}`, {
        method: 'PUT',
        token,
        body: {
          name: form.name,
          tiktokHandle: form.tiktokHandle || undefined,
          accountType: form.accountType,
          notes: form.notes || undefined,
          campaignIds: newCampaignIds.length > 0 ? newCampaignIds : undefined,
        },
      });
      resetForm();
      setEditingId(null);
      setOriginalCampaignIds([]);
      fetchAccounts();
      setToast({ message: 'Account updated successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.error || 'Failed to update account', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (account: Account) => {
    const postCount = account.postCount ?? 0;
    const kpiCount = account.kpiCount ?? 0;
    const hasBlockers = postCount > 0 || kpiCount > 0;
    let blockerMessage: string | undefined;
    if (hasBlockers) {
      if (postCount > 0 && kpiCount > 0) blockerMessage = `Cannot delete: ${postCount} post(s) and ${kpiCount} KPI(s) associated`;
      else if (postCount > 0) blockerMessage = `Cannot delete: ${postCount} post(s) associated`;
      else if (kpiCount > 0) blockerMessage = `Cannot delete: ${kpiCount} KPI(s) associated`;
    }
    setDeleteConfirm({ id: account.id, name: account.name, hasBlockers, blockerMessage });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm || deleteConfirm.hasBlockers) return;
    const { id } = deleteConfirm;
    setDeletingIds(prev => new Set(prev).add(id));
    setDeleteConfirm(null);
    try {
      await api(`/accounts/${id}`, { method: 'DELETE', token });
      fetchAccounts();
      setToast({ message: 'Account deleted successfully', type: 'success' });
    } catch (error: any) {
      const errorMessage = error?.error || error?.message || 'Failed to delete account';
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCancelEdit = () => {
    if (submitting) return;
    resetForm();
    setEditingId(null);
    setOriginalCampaignIds([]);
  };

  const handleSortToggle = (key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDir = key === 'postCount' || key === 'campaignCount' || key === 'views' || key === 'qtyPost' || key === 'fypCount' ? 'desc' : 'asc';
      return { key, direction: defaultDir };
    });
  };

  const renderSortableHeader = (label: string, key: SortKey, className?: string, keyProp?: string) => {
    const isActive = sortConfig.key === key;
    const indicator = isActive ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕';
    return (
      <TH className={className} key={keyProp ?? key}>
        <button
          type="button"
          onClick={() => handleSortToggle(key)}
          className="flex items-center gap-1 w-full text-left select-none hover:text-emerald-600 transition-colors"
        >
          <span className="truncate">{label}</span>
          <span className={`text-xs ${isActive ? 'text-emerald-600' : 'opacity-40'}`}>
            {indicator}
          </span>
        </button>
      </TH>
    );
  };

  const hasAccountFilters = Boolean(
    search.trim() ||
    type ||
    crossbrand ||
    campaignFilter
  );

  const AccountFormFields = () => (
    <>
      <Input
        label="Name"
        value={form.name}
        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
        required
      />
      <Input
        label="TikTok Handle"
        value={form.tiktokHandle}
        onChange={e => setForm(prev => ({ ...prev, tiktokHandle: e.target.value }))}
        placeholder="@username"
      />
      <Select
        label="Account Type"
        value={form.accountType}
        onChange={e => setForm(prev => ({ ...prev, accountType: e.target.value as 'CROSSBRAND' | 'NEW_PERSONA' | 'KOL' | 'PROXY' }))}
        required
      >
        <option value="">Select type</option>
        <option value="CROSSBRAND">CROSSBRAND</option>
        <option value="NEW_PERSONA">New Persona</option>
        <option value="KOL">KOL</option>
        <option value="PROXY">Proxy</option>
      </Select>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Campaigns</label>
        <Select
          value={selectedCampaign}
          onChange={e => {
            const campaignId = e.target.value;
            if (campaignId && !form.campaignIds.includes(campaignId)) {
              setForm(prev => ({ ...prev, campaignIds: [...prev.campaignIds, campaignId] }));
            }
            setSelectedCampaign('');
          }}
        >
          <option value="">Select a campaign to add</option>
          {campaigns
            .filter(c => !form.campaignIds.includes(c.id))
            .map(campaign => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} ({Array.isArray(campaign.categories) ? campaign.categories.join(', ') : ''})
              </option>
            ))}
        </Select>
        {form.campaignIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {form.campaignIds.map(campaignId => {
              const campaign = campaigns.find(c => c.id === campaignId);
              const isOriginalCampaign = editingId ? originalCampaignIds.includes(campaignId) : false;
              return campaign ? (
                <span
                  key={campaignId}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm border"
                  style={{ color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' }}
                >
                  {campaign.name}
                  {!isOriginalCampaign && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, campaignIds: prev.campaignIds.filter(id => id !== campaignId) }))}
                    className="transition-colors"
                    style={{ color: '#2563eb' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#1e40af'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#2563eb'; }}
                  >
                    ×
                  </button>
                  )}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>
      <Input
        label="Notes"
        value={form.notes}
        onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
      />
    </>
  );

  return (
    <div>
      <PageHeader
        backPath="/campaigns"
        backLabel="Back to campaigns"
        title={<h2 className="page-title">Accounts</h2>}
      />
      <Card>
        <div className="card-inner-table">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 sm:gap-3 mb-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-1.5 sm:gap-2 w-full">
              <Input
                label={<span className="text-xs">Search</span>}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name or handle"
                className="text-sm py-1.5"
              />
              <Select
                label={<span className="text-xs">Type</span>}
                value={type}
                onChange={e => setType(e.target.value)}
                className="text-sm py-1.5"
              >
                <option value="">All</option>
                <option value="CROSSBRAND">CROSSBRAND</option>
                <option value="NEW_PERSONA">NEW_PERSONA</option>
                <option value="KOL">KOL</option>
                <option value="PROXY">PROXY</option>
              </Select>
              <Select
                label={<span className="text-xs">Crossbrand</span>}
                value={crossbrand}
                onChange={e => setCrossbrand(e.target.value)}
                className="text-sm py-1.5"
              >
                <option value="">All</option>
                <option value="true">Only Crossbrand</option>
                <option value="false">Only Single-brand</option>
              </Select>
              <Select
                label={<span className="text-xs">Campaign</span>}
                value={campaignFilter}
                onChange={e => setCampaignFilter(e.target.value)}
                className="text-sm py-1.5"
              >
                <option value="">All campaigns</option>
                {campaigns.filter(c => c.status === 'ACTIVE').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" onClick={() => {
                setSearch('');
                setType('');
                setCrossbrand('');
                setCampaignFilter('');
              }} className="text-sm py-1 px-2">
                Reset Filters
              </Button>
              <RequirePermission permission={canAddAccount}>
                <Button variant="primary" color="green" onClick={() => setShowAddForm(!showAddForm)} disabled={!!editingId} className="text-sm py-1 px-2">
                  {showAddForm ? 'Cancel' : 'Add Account'}
                </Button>
              </RequirePermission>
            </div>
          </div>
          {loading ? <div className="skeleton h-10 w-full" /> : (
            items.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-500 text-lg">No accounts found</p>
                <p className="text-gray-400 text-sm mt-2">
                  {hasAccountFilters
                    ? 'Try adjusting your filters to see more results.'
                    : 'There are no accounts available.'}
                </p>
              </div>
            ) : (
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      {renderSortableHeader('Account', 'name', 'max-w-xs')}
                      {renderSortableHeader('Campaigns', 'campaignCount', 'w-48')}
                      {kpiDisplayCategories.map(cat =>
                        renderSortableHeader(
                          kpiLabels[cat],
                          cat === 'VIEWS' ? 'views' : cat === 'QTY_POST' ? 'qtyPost' : 'fypCount',
                          undefined,
                          cat
                        )
                      )}
                      {renderSortableHeader('Type', 'accountType')}
                      {renderSortableHeader('Posts', 'postCount')}
                      <TH className="!text-center">Actions</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {items.map(a => {
                      const kpiData = accountKpiMap.get(a.id);
                      const getKpiEntry = (category: string) => kpiData?.[category] || { target: 0, actual: 0 };
                      const postCount = a.postCount ?? 0;
                      const kpiCount = a.kpiCount ?? 0;

                      return (
                        <TR key={a.id}>
                          <TD className="max-w-xs">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div 
                                  className="font-medium truncate" 
                                  style={{ color: 'var(--text-primary)' }}
                                  title={a.name}
                                >
                                  {a.name}
                                </div>
                                {a.tiktokHandle && <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }} title={a.tiktokHandle}>{a.tiktokHandle}</div>}
                                {a.notes && <div className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-tertiary)' }} title={a.notes}>{a.notes}</div>}
                              </div>
                            </div>
                          </TD>
                          <TD className="w-48 align-middle text-left">
                            {(() => {
                              const activeCampaigns = (a.campaigns || []).filter(c => {
                                const campaign = campaigns.find(cmp => cmp.id === c.id);
                                return campaign?.status === 'ACTIVE';
                              });
                              return activeCampaigns.length > 0 ? (
                                <div className="flex flex-wrap gap-1 justify-start">
                                  {activeCampaigns.map(campaign => (
                                    <span key={campaign.id} className="text-xs px-2 py-0.5 rounded border" style={{ color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' }}>
                                      {campaign.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No active campaigns</span>
                              );
                            })()}
                          </TD>
                          {kpiDisplayCategories.map(cat => {
                            const entry = getKpiEntry(cat);
                            return (
                              <TD key={cat} className="align-middle">
                                {kpiLoading ? (
                                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Loading…</span>
                                ) : (
                                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {entry.actual.toLocaleString()}/{entry.target.toLocaleString()}
                                  </span>
                                )}
                              </TD>
                            );
                          })}
                          <TD>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full border inline-block" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                              {a.accountType}
                            </span>
                          </TD>
                          <TD>
                            <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{postCount} post(s)</div>
                            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{kpiCount} KPI(s)</div>
                          </TD>
                          <TD>
                            <div className="flex gap-2 justify-center">
                              <RequirePermission permission={canEditAccount}>
                                <Button variant="outline" color="blue" onClick={() => handleEditAccount(a)} className="text-sm px-3 py-1.5">
                                  Edit
                                </Button>
                              </RequirePermission>
                              <RequirePermission permission={canDelete}>
                                <Button 
                                  variant="outline" 
                                  color="red"
                                  onClick={() => handleDeleteClick(a)} 
                                  disabled={deletingIds.has(a.id)} 
                                  className="text-sm px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {deletingIds.has(a.id) ? 'Deleting...' : 'Delete'}
                                </Button>
                              </RequirePermission>
                            </div>
                          </TD>
                        </TR>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )
          )}
        </div>
      </Card>
      {showAddForm && (
        <RequirePermission permission={canAddAccount}>
          <Card className="mt-4">
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Add Account</h2>
            <form onSubmit={handleAddAccount} className="space-y-3">
              <AccountFormFields />
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="flex-1" color="green">
                  {submitting ? 'Adding...' : 'Add Account'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </RequirePermission>
      )}
      <RequirePermission permission={canEditAccount}>
        <Dialog
          open={!!editingId}
          onClose={handleCancelEdit}
          title="Edit Account"
          footer={
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" form="edit-account-form" disabled={submitting} color="blue">
                {submitting ? 'Updating...' : 'Update Account'}
              </Button>
            </>
          }
        >
          <form id="edit-account-form" onSubmit={handleUpdateAccount} className="space-y-3">
            <AccountFormFields />
          </form>
        </Dialog>
      </RequirePermission>
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Account"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              color="red"
              onClick={handleDeleteConfirm}
              disabled={!deleteConfirm || deleteConfirm.hasBlockers || deletingIds.has(deleteConfirm.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete <strong>"{deleteConfirm?.name}"</strong>?
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          This action cannot be undone. {deleteConfirm?.hasBlockers ? 'This account cannot be deleted while posts or KPIs are associated.' : 'All related links will be removed.'}
        </p>
      </Dialog>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
