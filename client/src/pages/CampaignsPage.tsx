import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Link } from 'react-router-dom';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Toast from '../components/ui/Toast';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';

const accountCategoryOrder = ['VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR'];
const categoryLabels: Record<string, string> = {
  VIEWS: 'Views',
  QTY_POST: 'Qty Post',
  FYP_COUNT: 'FYP Count',
  VIDEO_COUNT: 'Video Count',
  GMV_IDR: 'GMV (IDR)',
};

type Campaign = {
  id: string;
  name: string;
  categories: string[];
  startDate: string;
  endDate: string;
  status: string;
};

type Account = {
  id: string;
  name: string;
  tiktokHandle?: string;
};

export default function CampaignsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [form, setForm] = useState({
    name: '',
    categories: [] as string[],
    startDate: '',
    endDate: '',
    status: 'PLANNED',
    description: '',
    accountIds: [] as string[],
  });
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [campaignKpis, setCampaignKpis] = useState<Record<string, string>>(() =>
    Object.fromEntries(accountCategoryOrder.map((cat) => [cat, '']))
  );
  const [accountKpis, setAccountKpis] = useState<Record<string, Record<string, string>>>({});

  const fetchCampaigns = () => {
    setLoading(true);
    api(`/campaigns?status=${encodeURIComponent(status)}&category=${encodeURIComponent(q)}`, { token })
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCampaigns();
  }, [token, status, q]);

  useEffect(() => {
    api('/accounts', { token }).then(setAccounts).catch(() => setAccounts([]));
  }, [token]);

  useEffect(() => {
    // Extract unique categories from all campaigns
    const allCategories = new Set<string>();
    items.forEach(campaign => {
      if (campaign.categories && Array.isArray(campaign.categories)) {
        campaign.categories.forEach(cat => allCategories.add(cat));
      }
    });
    setAvailableCategories(Array.from(allCategories).sort());
  }, [items]);

  const resetForm = () => {
    setForm({
      name: '',
      categories: [],
      startDate: '',
      endDate: '',
      status: 'PLANNED',
      description: '',
      accountIds: [],
    });
    setSelectedAccount('');
    setNewCategory('');
    setCampaignKpis(Object.fromEntries(accountCategoryOrder.map((cat) => [cat, ''])));
    setAccountKpis({});
  };

  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.categories.length === 0 || !form.startDate || !form.endDate) {
      setToast({ message: 'Name, at least one category, start date, and end date are required', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      // Create the campaign
      const campaign = await api('/campaigns', {
        method: 'POST',
        token,
        body: {
          name: form.name,
          categories: form.categories,
          startDate: form.startDate,
          endDate: form.endDate,
          status: form.status,
          description: form.description || undefined,
          accountIds: form.accountIds.length > 0 ? form.accountIds : undefined,
        },
      });

      // Create campaign-level KPIs (no accountId)
      const campaignKpiPromises = accountCategoryOrder
        .filter(cat => campaignKpis[cat] && campaignKpis[cat].trim() !== '')
        .map(cat =>
          api('/kpis', {
            method: 'POST',
            token,
            body: {
              campaignId: campaign.id,
              category: cat,
              target: Number(campaignKpis[cat]) || 0,
            },
          })
        );

      // Create account-level KPIs
      const accountKpiPromises = form.accountIds.flatMap(accountId => {
        const accountKpiData = accountKpis[accountId] || {};
        return accountCategoryOrder
          .filter(cat => accountKpiData[cat] && accountKpiData[cat].trim() !== '')
          .map(cat =>
            api('/kpis', {
              method: 'POST',
              token,
              body: {
                campaignId: campaign.id,
                accountId: accountId,
                category: cat,
                target: Number(accountKpiData[cat]) || 0,
              },
            })
          );
      });

      // Wait for all KPIs to be created
      await Promise.all([...campaignKpiPromises, ...accountKpiPromises]);

      resetForm();
      setShowAddForm(false);
      fetchCampaigns();
      setToast({ message: 'Campaign and KPIs added successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.error || 'Failed to add campaign', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="page-title">Campaigns</h1>
      </div>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Filters</h2>
          <Button variant="primary" color="green" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : 'Add Campaign'}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All</option>
            <option>PLANNED</option>
            <option>ACTIVE</option>
            <option>COMPLETED</option>
            <option>PAUSED</option>
          </Select>
          <div className="sm:col-span-2">
            <Input label="Category" value={q} onChange={e => setQ(e.target.value)} placeholder="Search category" />
          </div>
        </div>
      </Card>
      {showAddForm && (
        <Card className="mt-4">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Add Campaign</h2>
          <form onSubmit={handleAddCampaign} className="space-y-3">
            <Input
              label="Campaign Name"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Categories</label>
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    value={newCategory}
                    onChange={e => {
                      setNewCategory(e.target.value);
                      setShowSuggestions(e.target.value.trim().length > 0);
                    }}
                    onFocus={() => {
                      if (newCategory.trim().length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow clicking on suggestions
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    placeholder="Type category name and press Enter"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const category = newCategory.trim();
                        if (category) {
                          if (form.categories.includes(category)) {
                            setToast({ message: `Category "${category}" is already added`, type: 'error' });
                          } else {
                            setForm(prev => ({ ...prev, categories: [...prev.categories, category] }));
                            setNewCategory('');
                            setShowSuggestions(false);
                          }
                        }
                      }
                    }}
                  />
                  {showSuggestions && newCategory.trim().length > 0 && (
                    <div className="absolute z-10 w-full mt-1 border rounded-md max-h-48 overflow-auto" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
                      {availableCategories
                        .filter(cat => 
                          !form.categories.includes(cat) &&
                          cat.toLowerCase().includes(newCategory.toLowerCase())
                        )
                        .map(cat => (
                          <button
                            key={cat}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm transition-colors"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'; e.currentTarget.style.color = '#2563eb'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onClick={() => {
                              if (form.categories.includes(cat)) {
                                setToast({ message: `Category "${cat}" is already added`, type: 'error' });
                              } else {
                                setForm(prev => ({ ...prev, categories: [...prev.categories, cat] }));
                                setNewCategory('');
                                setShowSuggestions(false);
                              }
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      {availableCategories.filter(cat => 
                        !form.categories.includes(cat) &&
                        cat.toLowerCase().includes(newCategory.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                          Press Enter to create "{newCategory.trim()}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {form.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.categories.map(category => (
                      <span
                        key={category}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm border"
                        style={{ color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' }}
                      >
                        {category}
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, categories: prev.categories.filter(c => c !== category) }))}
                          className="transition-colors"
                          style={{ color: '#2563eb' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#1e40af'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#2563eb'; }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start Date"
                type="date"
                value={form.startDate}
                onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                required
              />
              <Input
                label="End Date"
                type="date"
                value={form.endDate}
                onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>
            <Select
              label="Status"
              value={form.status}
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
              required
            >
              <option value="PLANNED">PLANNED</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="COMPLETED">COMPLETED</option>
            </Select>
            <Input
              label="Description"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            />
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Campaign-Level KPIs</label>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {accountCategoryOrder.map((cat) => (
                  <Input
                    key={cat}
                    label={categoryLabels[cat]}
                    type="number"
                    value={campaignKpis[cat]}
                    onChange={e => setCampaignKpis(prev => ({ ...prev, [cat]: e.target.value }))}
                    placeholder="Target"
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Accounts</label>
              <Select
                value={selectedAccount}
                onChange={e => {
                  const accountId = e.target.value;
                  if (accountId && !form.accountIds.includes(accountId)) {
                    setForm(prev => ({ ...prev, accountIds: [...prev.accountIds, accountId] }));
                    // Initialize KPIs for this account
                    setAccountKpis(prev => ({
                      ...prev,
                      [accountId]: Object.fromEntries(accountCategoryOrder.map((cat) => [cat, ''])),
                    }));
                  }
                  setSelectedAccount('');
                }}
              >
                <option value="">Select an account to add</option>
                {accounts
                  .filter(a => !form.accountIds.includes(a.id))
                  .map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} {account.tiktokHandle ? `(${account.tiktokHandle})` : ''}
                    </option>
                  ))}
              </Select>
              {form.accountIds.length > 0 && (
                <div className="mt-2 space-y-4">
                  {form.accountIds.map(accountId => {
                    const account = accounts.find(a => a.id === accountId);
                    const accountKpiData = accountKpis[accountId] || {};
                    return account ? (
                      <div key={accountId} className="border rounded-lg p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{account.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, accountIds: prev.accountIds.filter(id => id !== accountId) }));
                              setAccountKpis(prev => {
                                const next = { ...prev };
                                delete next[accountId];
                                return next;
                              });
                            }}
                            className="text-sm transition-colors"
                            style={{ color: '#dc2626' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#b91c1c'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                          {accountCategoryOrder.map((cat) => (
                            <Input
                              key={cat}
                              label={categoryLabels[cat]}
                              type="number"
                              value={accountKpiData[cat] || ''}
                              onChange={e => setAccountKpis(prev => ({
                                ...prev,
                                [accountId]: {
                                  ...(prev[accountId] || {}),
                                  [cat]: e.target.value,
                                },
                              }))}
                              placeholder="Target"
                            />
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} className="flex-1" color="green">
                {submitting ? 'Adding...' : 'Add Campaign'}
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                resetForm();
                setShowAddForm(false);
              }} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="skeleton h-10 w-full" />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Category</TH>
                  <TH>Start</TH>
                  <TH>End</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {items.map((c) => (
                  <TR key={c.id}>
                    <TD><Link to={`/campaigns/${c.id}`} className="hover:underline font-medium transition-colors" style={{ color: '#2563eb' }}>{c.name}</Link></TD>
                    <TD>
                      {Array.isArray(c.categories) && c.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.categories.map((cat, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 rounded border" style={{ color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' }}>
                              {cat}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                      )}
                    </TD>
                    <TD>{new Date(c.startDate).toLocaleDateString()}</TD>
                    <TD>{new Date(c.endDate).toLocaleDateString()}</TD>
                    <TD><span className="badge">{c.status}</span></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>
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
