import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Toast from '../components/ui/Toast';
import PageHeader from '../components/PageHeader';

const statusOptions = ['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED'];
const accountCategoryOrder = ['VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR'];
const categoryLabels: Record<string, string> = {
  VIEWS: 'Views',
  QTY_POST: 'Qty Post',
  FYP_COUNT: 'FYP Count',
  VIDEO_COUNT: 'Video Count',
  GMV_IDR: 'GMV (IDR)',
};

export default function CampaignEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [campaign, setCampaign] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    categories: [] as string[],
    status: 'PLANNED',
    startDate: '',
    endDate: '',
    accountIds: [] as string[],
  });
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pendingAccount, setPendingAccount] = useState('');
  const [pendingKpis, setPendingKpis] = useState<Record<string, { target: string }>>(() =>
    Object.fromEntries(accountCategoryOrder.map((cat) => [cat, { target: '' }]))
  );
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [savingGlobalKpis, setSavingGlobalKpis] = useState(false);
  const [campaignKpiEdits, setCampaignKpiEdits] = useState<Record<string, { id: string; target: string; actual: number }>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!id) return;
    api(`/campaigns/${id}`, { token }).then(setCampaign);
    api('/accounts', { token }).then(setAccounts);
    api(`/campaigns/${id}/kpis`, { token }).then(setKpis);
    api('/campaigns', { token }).then(setAllCampaigns).catch(() => setAllCampaigns([]));
  }, [id, token]);

  useEffect(() => {
    if (!campaign) return;
    setForm({
      name: campaign.name,
      categories: Array.isArray(campaign.categories) ? campaign.categories : [],
      status: campaign.status,
      startDate: campaign.startDate ? campaign.startDate.split('T')[0] : '',
      endDate: campaign.endDate ? campaign.endDate.split('T')[0] : '',
      accountIds: (campaign.accounts || []).map((a: any) => a.id),
    });
  }, [campaign]);

  useEffect(() => {
    // Extract unique categories from all campaigns
    const allCategories = new Set<string>();
    allCampaigns.forEach(c => {
      if (Array.isArray(c.categories)) {
        c.categories.forEach(cat => allCategories.add(cat));
      }
    });
    setAvailableCategories(Array.from(allCategories).sort());
  }, [allCampaigns]);

  useEffect(() => {
    const global = Object.fromEntries(
      kpis
        .filter((k) => !k.accountId)
        .map((k) => [k.category, { id: k.id, target: String(k.target ?? ''), actual: k.actual }])
    );
    setCampaignKpiEdits(global);
  }, [kpis]);

  const availableAccounts = useMemo(() => {
    return accounts.filter((account) => !form.accountIds.includes(account.id));
  }, [accounts, form.accountIds]);

  const handleFormChange = (field: keyof typeof form, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    setSavingCampaign(true);
    try {
      const payload = {
        name: form.name,
        categories: form.categories,
        status: form.status,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        accountIds: form.accountIds,
      };
      const updated = await api(`/campaigns/${id}`, { method: 'PUT', body: payload, token });
      setCampaign(updated);
      navigate(`/campaigns/${id}`);
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleAddAccount = async () => {
    if (!id || !pendingAccount) return;
    setAddingAccount(true);
    try {
      const updatedAccounts = [...form.accountIds, pendingAccount];
      await api(`/campaigns/${id}`, { method: 'PUT', body: { accountIds: updatedAccounts }, token });
      await Promise.all(
        accountCategoryOrder.map((cat) =>
          api('/kpis', {
            method: 'POST',
            body: {
              campaignId: id,
              accountId: pendingAccount,
              category: cat,
              target: Number(pendingKpis[cat].target) || 0,
            },
            token,
          })
        )
      );
      const refreshed = await api(`/campaigns/${id}`, { token });
      setCampaign(refreshed);
      setForm((prev) => ({ ...prev, accountIds: [...prev.accountIds, pendingAccount] }));
      setPendingAccount('');
      setPendingKpis(Object.fromEntries(accountCategoryOrder.map((cat) => [cat, { target: '' }])));
    } finally {
      setAddingAccount(false);
    }
  };

  const handleGlobalKpiField = (category: string, value: string) => {
    setCampaignKpiEdits((prev) => ({
      ...prev,
      [category]: { ...(prev[category] ?? { id: '', target: '', actual: 0 }), target: value },
    }));
  };

  const handleGlobalKpiSave = async () => {
    if (!id) return;
    setSavingGlobalKpis(true);
    try {
      await Promise.all(
        Object.values(campaignKpiEdits).map((entry) =>
          api(`/kpis/${entry.id}`, {
            method: 'PUT',
            body: { target: Number(entry.target) || 0 },
            token,
          })
        )
      );
      const refreshed = await api(`/campaigns/${id}/kpis`, { token });
      setKpis(refreshed);
    } finally {
      setSavingGlobalKpis(false);
    }
  };

  const backPath = id ? `/campaigns/${id}` : '/campaigns';

  if (!campaign) {
    return (
      <div>
        <PageHeader backPath={backPath} backLabel="Back to campaign" title={<div className="page-title">Loading…</div>} />
        <div className="mt-3">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backPath={backPath}
        backLabel="Back to campaign"
        title={<h1 className="page-title">Edit campaign</h1>}
      />
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Edit campaign metadata</h2>
          <span className="text-xs text-gray-500">Save to persist</span>
        </div>
        <form className="space-y-3" onSubmit={handleSaveCampaign}>
          <Input label="Campaign name" value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categories</label>
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
                          handleFormChange('categories', [...form.categories, category]);
                          setNewCategory('');
                          setShowSuggestions(false);
                        }
                      }
                    }
                  }}
                />
                {showSuggestions && newCategory.trim().length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                    {availableCategories
                      .filter(cat => 
                        !form.categories.includes(cat) &&
                        cat.toLowerCase().includes(newCategory.toLowerCase())
                      )
                      .map(cat => (
                        <button
                          key={cat}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 text-sm"
                          onClick={() => {
                            if (form.categories.includes(cat)) {
                              setToast({ message: `Category "${cat}" is already added`, type: 'error' });
                            } else {
                              handleFormChange('categories', [...form.categories, cat]);
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
                      <div className="px-3 py-2 text-sm text-gray-500">
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
                      className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-sm"
                    >
                      {category}
                      <button
                        type="button"
                        onClick={() => handleFormChange('categories', form.categories.filter(c => c !== category))}
                        className="hover:text-indigo-900"
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
            <Input label="Start date" type="date" value={form.startDate} onChange={(e) => handleFormChange('startDate', e.target.value)} />
            <Input label="End date" type="date" value={form.endDate} onChange={(e) => handleFormChange('endDate', e.target.value)} />
          </div>
          <Select label="Status" value={form.status} onChange={(e) => handleFormChange('status', e.target.value)}>
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </Select>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Linked accounts</label>
            <div className="text-xs text-gray-500">{form.accountIds.length} accounts</div>
          </div>
          <Button disabled={savingCampaign} className="w-full" type="submit">
            {savingCampaign ? 'Saving…' : 'Save campaign'}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Edit campaign KPIs</h2>
          <Button variant="outline" onClick={handleGlobalKpiSave} disabled={savingGlobalKpis}>
            {savingGlobalKpis ? 'Saving…' : 'Save KPI targets'}
          </Button>
        </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {accountCategoryOrder.map((cat) => {
              const entry = campaignKpiEdits[cat];
              return (
                <div key={cat} className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-gray-500">{categoryLabels[cat]}</div>
                  <Input
                    label="Target"
                    type="number"
                    value={entry?.target ?? ''}
                    onChange={(e) => handleGlobalKpiField(cat, e.target.value)}
                  />
                  <div className="text-xs text-gray-500">Actual: {entry?.actual ?? 0}</div>
                </div>
              );
            })}
          </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Add account with KPIs</h2>
          <span className="text-xs text-gray-500">Select account and set KPI targets before linking</span>
        </div>
        <div className="grid gap-3">
          <Select value={pendingAccount} onChange={(e) => setPendingAccount(e.target.value)} label="Account">
            <option value="">Pick account</option>
            {availableAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} {account.tiktokHandle ? `(${account.tiktokHandle})` : ''}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accountCategoryOrder.map((cat) => (
              <div key={cat} className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-gray-500">{categoryLabels[cat]}</div>
                <Input
                  type="number"
                  placeholder="Target"
                  value={pendingKpis[cat].target}
                  onChange={(e) => setPendingKpis((prev) => ({ ...prev, [cat]: { target: e.target.value } }))}
                />
              </div>
            ))}
          </div>
          <Button variant="primary" disabled={addingAccount || !pendingAccount} onClick={handleAddAccount} className="w-full">
            {addingAccount ? 'Adding account…' : 'Add account with KPIs'}
          </Button>
        </div>
      </Card>
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
