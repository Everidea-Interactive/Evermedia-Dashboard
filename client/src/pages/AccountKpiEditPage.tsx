import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Toast from '../components/ui/Toast';
import PageHeader from '../components/PageHeader';

const categories = ['VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR', 'YELLOW_CART'];
const labels: Record<string, string> = {
  VIEWS: 'Views',
  QTY_POST: 'Qty Post',
  FYP_COUNT: 'FYP Count',
  VIDEO_COUNT: 'Video Count',
  GMV_IDR: 'GMV (IDR)',
  YELLOW_CART: 'Yellow Cart',
};

export default function AccountKpiEditPage() {
  const { campaignId, accountId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [account, setAccount] = useState<any>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((cat) => [cat, '']))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!campaignId || !accountId) return;
    setLoading(true);
    Promise.all([
      api(`/accounts/${accountId}`, { token }),
      api(`/kpis?campaignId=${campaignId}&accountId=${accountId}`, { token }),
    ])
      .then(([accountData, kpiData]) => {
        setAccount(accountData);
        setKpis(kpiData);
        const map = Object.fromEntries(
          (kpiData as any[]).map((k) => [k.category, String(k.target ?? '')])
        );
        setTargets((prev) => ({ ...prev, ...map }));
      })
      .finally(() => setLoading(false));
  }, [campaignId, accountId, token]);

  const handleTargetChange = (category: string, value: string) => {
    setTargets((prev) => ({ ...prev, [category]: value }));
  };

  const handleSave = async () => {
    if (!campaignId || !accountId) return;
    setSaving(true);
    try {
      const promises: Promise<any>[] = [];
      
      // Update existing KPIs
      for (const kpi of kpis) {
        const targetValue = Number(targets[kpi.category]) || 0;
        promises.push(
          api(`/kpis/${kpi.id}`, {
            method: 'PUT',
            body: { target: targetValue },
            token,
          })
        );
      }
      
      // Create KPIs that don't exist yet if a target value is provided
      for (const cat of categories) {
        const existingKpi = kpis.find((k) => k.category === cat);
        if (!existingKpi) {
          const targetValue = Number(targets[cat]) || 0;
          // Only create if target value is provided (non-zero or explicitly set)
          if (targets[cat] !== '' && targets[cat] !== undefined) {
            promises.push(
              api('/kpis', {
                method: 'POST',
                body: {
                  campaignId,
                  accountId,
                  category: cat,
                  target: targetValue,
                },
                token,
              })
            );
          }
        }
      }
      
      await Promise.all(promises);
      navigate(`/campaigns/${campaignId}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!campaignId || !accountId) return;
    setRemoving(true);
    try {
      await api(`/campaigns/${campaignId}/accounts/${accountId}`, { method: 'DELETE', token });
      navigate(`/campaigns/${campaignId}`);
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to remove account', type: 'error' });
    } finally {
      setRemoving(false);
    }
  };

  const backPath = campaignId ? `/campaigns/${campaignId}/accounts` : '/campaigns';

  if (loading) {
    return (
      <div>
        <PageHeader backPath={backPath} backLabel="Back to accounts" title={<div className="page-title">Loading…</div>} />
        <div className="mt-3">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backPath={backPath}
        backLabel="Back to accounts"
        title={<h1 className="page-title">Account KPIs</h1>}
      />
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Editing KPIs for {account?.name}</h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{account?.tiktokHandle}</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Update target values; actuals are system-calculated.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          {categories.map((cat) => {
            const kpi = kpis.find((k) => k.category === cat);
            return (
              <div key={cat} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{labels[cat]}</div>
                <Input
                  type="number"
                  value={targets[cat]}
                  placeholder="Target"
                  onChange={(e) => handleTargetChange(cat, e.target.value)}
                />
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Actual: {kpi?.actual ?? 0}</div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Button variant="primary" color="blue" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save targets'}
          </Button>
          <Button variant="ghost" color="red" onClick={handleRemove} disabled={removing}>
            {removing ? 'Removing…' : 'Remove account'}
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
