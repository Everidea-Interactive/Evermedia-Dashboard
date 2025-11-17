import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Toast from '../components/ui/Toast';
import PageHeader from '../components/PageHeader';

type Campaign = {
  id: string;
  name: string;
  category: string;
};

type Account = {
  id: string;
  name: string;
  tiktokHandle?: string;
  accountType: 'BRAND_SPECIFIC'|'CROSSBRAND';
  brand?: string;
  notes?: string;
  campaigns?: Campaign[];
  postCount?: number;
  kpiCount?: number;
  isCrossbrand?: boolean;
};

export default function AccountsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Account[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [crossbrand, setCrossbrand] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [form, setForm] = useState({
    name: '',
    tiktokHandle: '',
    accountType: '' as 'BRAND_SPECIFIC' | 'CROSSBRAND' | '',
    notes: '',
    campaignIds: [] as string[],
  });
  const [selectedCampaign, setSelectedCampaign] = useState('');

  const fetchAccounts = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('accountType', type);
    if (crossbrand) params.set('crossbrand', crossbrand);
    api(`/accounts?${params.toString()}`, { token })
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAccounts();
  }, [token, search, type, crossbrand]);

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
    setEditingId(account.id);
    setForm({
      name: account.name,
      tiktokHandle: account.tiktokHandle || '',
      accountType: account.accountType,
      notes: account.notes || '',
      campaignIds: account.campaigns?.map(c => c.id) || [],
    });
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
      await api(`/accounts/${editingId}`, {
        method: 'PUT',
        token,
        body: {
          name: form.name,
          tiktokHandle: form.tiktokHandle || undefined,
          accountType: form.accountType,
          notes: form.notes || undefined,
          campaignIds: form.campaignIds,
        },
      });
      resetForm();
      setEditingId(null);
      fetchAccounts();
      setToast({ message: 'Account updated successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.error || 'Failed to update account', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    const account = items.find(a => a.id === id);
    if (account && ((account.postCount ?? 0) > 0 || (account.kpiCount ?? 0) > 0)) {
      return; // Don't open dialog if account has posts or KPIs
    }
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    const account = items.find(a => a.id === id);
    if (account && ((account.postCount ?? 0) > 0 || (account.kpiCount ?? 0) > 0)) {
      setDeleteConfirm(null);
      return;
    }
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
    resetForm();
    setEditingId(null);
  };

  return (
    <div>
      <PageHeader
        backPath="/campaigns"
        backLabel="Back to campaigns"
        title={<h2 className="page-title">Accounts</h2>}
      />
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Filters</h2>
          <Button variant="primary" onClick={() => setShowAddForm(!showAddForm)} disabled={!!editingId}>
            {showAddForm ? 'Cancel' : 'Add Account'}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2"><Input label="Search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or handle" /></div>
          <Select label="Type" value={type} onChange={e => setType(e.target.value)}>
            <option value="">All</option>
            <option>BRAND_SPECIFIC</option>
            <option>CROSSBRAND</option>
          </Select>
          <Select label="Crossbrand" value={crossbrand} onChange={e => setCrossbrand(e.target.value)}>
            <option value="">All</option>
            <option value="true">Only Crossbrand</option>
            <option value="false">Only Single-brand</option>
          </Select>
        </div>
      </Card>
      {(showAddForm || editingId) && (
        <Card className="mt-4">
          <h2 className="text-lg font-semibold mb-3">{editingId ? 'Edit Account' : 'Add Account'}</h2>
          <form onSubmit={editingId ? handleUpdateAccount : handleAddAccount} className="space-y-3">
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
              onChange={e => setForm(prev => ({ ...prev, accountType: e.target.value as 'BRAND_SPECIFIC' | 'CROSSBRAND' }))}
              required
            >
              <option value="">Select type</option>
              <option value="BRAND_SPECIFIC">BRAND_SPECIFIC</option>
              <option value="CROSSBRAND">CROSSBRAND</option>
            </Select>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaigns</label>
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
                      {campaign.name} ({campaign.category})
                    </option>
                  ))}
              </Select>
              {form.campaignIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.campaignIds.map(campaignId => {
                    const campaign = campaigns.find(c => c.id === campaignId);
                    return campaign ? (
                      <span
                        key={campaignId}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-sm"
                      >
                        {campaign.name}
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, campaignIds: prev.campaignIds.filter(id => id !== campaignId) }))}
                          className="hover:text-indigo-900"
                        >
                          ×
                        </button>
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
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Account' : 'Add Account')}
              </Button>
              <Button type="button" variant="outline" onClick={editingId ? handleCancelEdit : () => setShowAddForm(false)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
      <div className="mt-4">
        {loading ? <div className="skeleton h-10 w-full" /> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(a => (
              <Card key={a.id}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{a.name}</div>
                  {a.isCrossbrand && <span className="badge text-indigo-700 bg-indigo-50 border-indigo-100">Crossbrand</span>}
                </div>
                {a.tiktokHandle && <div className="text-sm text-gray-600 mt-2">{a.tiktokHandle}</div>}
                <div className="text-xs text-gray-500 mt-1">Type: {a.accountType}</div>
                {a.campaigns && a.campaigns.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">Campaigns:</div>
                    <div className="flex flex-wrap gap-1">
                      {a.campaigns.map(campaign => (
                        <span key={campaign.id} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">
                          {campaign.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {a.notes && <div className="text-xs text-gray-500 mt-1">{a.notes}</div>}
                <div className="mt-3">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleEditAccount(a)} className="flex-1 text-sm py-1.5">
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleDeleteClick(a.id, a.name)} 
                      disabled={deletingIds.has(a.id) || (a.postCount ?? 0) > 0 || (a.kpiCount ?? 0) > 0} 
                      className="flex-1 text-sm py-1.5 text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingIds.has(a.id) ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                  {((a.postCount ?? 0) > 0 || (a.kpiCount ?? 0) > 0) && (
                    <div className="mt-2 text-xs text-red-600">
                      {a.postCount > 0 && a.kpiCount > 0 && `Cannot delete: ${a.postCount} post(s) and ${a.kpiCount} KPI(s) associated`}
                      {a.postCount > 0 && a.kpiCount === 0 && `Cannot delete: ${a.postCount} post(s) associated`}
                      {a.postCount === 0 && a.kpiCount > 0 && `Cannot delete: ${a.kpiCount} KPI(s) associated`}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Account"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-700">
          Are you sure you want to delete <strong>"{deleteConfirm?.name}"</strong>?
        </p>
        <p className="text-sm text-gray-500 mt-2">
          This action cannot be undone. If this account has posts or KPIs associated with it, the deletion will fail.
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
