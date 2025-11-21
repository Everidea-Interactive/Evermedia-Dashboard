import { useEffect, useState } from 'react';
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

type Campaign = {
  id: string;
  name: string;
  categories: string[];
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
  const { canManageAccounts, canAddAccount, canEditAccount, canDelete } = usePermissions();
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
    accountType: '' as 'CROSSBRAND' | 'NEW_PERSONA' | 'KOL' | 'PROXY' | '',
    notes: '',
    campaignIds: [] as string[],
  });
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [originalCampaignIds, setOriginalCampaignIds] = useState<string[]>([]);

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
    setOriginalCampaignIds([]);
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
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Filters</h2>
          <RequirePermission permission={canAddAccount}>
            <Button variant="primary" color="green" onClick={() => setShowAddForm(!showAddForm)} disabled={!!editingId}>
              {showAddForm ? 'Cancel' : 'Add Account'}
            </Button>
          </RequirePermission>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2"><Input label="Search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or handle" /></div>
          <Select label="Type" value={type} onChange={e => setType(e.target.value)}>
            <option value="">All</option>
            <option>CROSSBRAND</option>
            <option>NEW_PERSONA</option>
            <option>KOL</option>
            <option>PROXY</option>
          </Select>
          <Select label="Crossbrand" value={crossbrand} onChange={e => setCrossbrand(e.target.value)}>
            <option value="">All</option>
            <option value="true">Only Crossbrand</option>
            <option value="false">Only Single-brand</option>
          </Select>
        </div>
      </Card>
      {(showAddForm || editingId) && (
        <RequirePermission permission={editingId ? canEditAccount : canAddAccount}>
          <Card className="mt-4">
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{editingId ? 'Edit Account' : 'Add Account'}</h2>
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
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} className="flex-1" color={editingId ? 'blue' : 'green'}>
                {submitting ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Account' : 'Add Account')}
              </Button>
              <Button type="button" variant="outline" onClick={editingId ? handleCancelEdit : () => setShowAddForm(false)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
          </Card>
        </RequirePermission>
      )}
      <div className="mt-4">
        {loading ? <div className="skeleton h-10 w-full" /> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(a => (
              <Card key={a.id} className="h-full">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between">
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{a.name}</div>
                    {a.isCrossbrand && <span className="badge" style={{ color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' }}>Crossbrand</span>}
                  </div>
                  {a.tiktokHandle && <div className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{a.tiktokHandle}</div>}
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Type: {a.accountType}</div>
                  {a.campaigns && a.campaigns.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Campaigns:</div>
                      <div className="flex flex-wrap gap-1">
                        {a.campaigns.map(campaign => (
                          <span key={campaign.id} className="text-xs px-2 py-0.5 rounded border" style={{ color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' }}>
                            {campaign.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.notes && <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{a.notes}</div>}
                  <div className="mt-auto pt-3">
                    <div className="flex gap-2">
                      <RequirePermission permission={canEditAccount}>
                        <Button variant="outline" color="blue" onClick={() => handleEditAccount(a)} className="flex-1 text-sm py-1.5">
                          Edit
                        </Button>
                      </RequirePermission>
                      <RequirePermission permission={canDelete}>
                        <Button 
                          variant="outline" 
                          color="red"
                          onClick={() => handleDeleteClick(a.id, a.name)} 
                          disabled={deletingIds.has(a.id) || (a.postCount ?? 0) > 0 || (a.kpiCount ?? 0) > 0} 
                          className="flex-1 text-sm py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingIds.has(a.id) ? 'Deleting...' : 'Delete'}
                        </Button>
                      </RequirePermission>
                    </div>
                    <RequirePermission permission={canDelete}>
                      <div className="mt-2 text-xs min-h-[1.25rem]" style={{ color: '#dc2626' }}>
                        {((a.postCount ?? 0) > 0 || (a.kpiCount ?? 0) > 0) && (
                          <>
                            {(a.postCount ?? 0) > 0 && (a.kpiCount ?? 0) > 0 && `Cannot delete: ${a.postCount} post(s) and ${a.kpiCount} KPI(s) associated`}
                            {(a.postCount ?? 0) > 0 && (a.kpiCount ?? 0) === 0 && `Cannot delete: ${a.postCount} post(s) associated`}
                            {(a.postCount ?? 0) === 0 && (a.kpiCount ?? 0) > 0 && `Cannot delete: ${a.kpiCount} KPI(s) associated`}
                          </>
                        )}
                      </div>
                    </RequirePermission>
                  </div>
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
            <Button variant="primary" color="red" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete <strong>"{deleteConfirm?.name}"</strong>?
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
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
