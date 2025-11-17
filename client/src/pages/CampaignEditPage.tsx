import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
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
  const [form, setForm] = useState({
    name: '',
    category: '',
    status: 'PLANNED',
    startDate: '',
    endDate: '',
    accountIds: [] as string[],
  });
  const [pendingAccount, setPendingAccount] = useState('');
  const [pendingKpis, setPendingKpis] = useState<Record<string, { target: string }>>(() =>
    Object.fromEntries(accountCategoryOrder.map((cat) => [cat, { target: '' }]))
  );
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [savingGlobalKpis, setSavingGlobalKpis] = useState(false);
  const [campaignKpiEdits, setCampaignKpiEdits] = useState<Record<string, { id: string; target: string; actual: number }>>({});

  useEffect(() => {
    if (!id) return;
    api(`/campaigns/${id}`, { token }).then(setCampaign);
    api('/accounts', { token }).then(setAccounts);
    api(`/campaigns/${id}/kpis`, { token }).then(setKpis);
  }, [id, token]);

  useEffect(() => {
    if (!campaign) return;
    setForm({
      name: campaign.name,
      category: campaign.category,
      status: campaign.status,
      startDate: campaign.startDate ? campaign.startDate.split('T')[0] : '',
      endDate: campaign.endDate ? campaign.endDate.split('T')[0] : '',
      accountIds: (campaign.accounts || []).map((a: any) => a.id),
    });
  }, [campaign]);

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
        category: form.category,
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
          <Input label="Category" value={form.category} onChange={(e) => handleFormChange('category', e.target.value)} />
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

    </div>
  );
}
