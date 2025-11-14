import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';

const categories = ['VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR'];
const labels: Record<string, string> = {
  VIEWS: 'Views',
  QTY_POST: 'Qty Post',
  FYP_COUNT: 'FYP Count',
  VIDEO_COUNT: 'Video Count',
  GMV_IDR: 'GMV (IDR)',
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
      await Promise.all(
        kpis.map((kpi) =>
          api(`/kpis/${kpi.id}`, {
            method: 'PUT',
            body: { target: Number(targets[kpi.category]) || 0 },
            token,
          })
        )
      );
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
    } finally {
      setRemoving(false);
    }
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Editing KPIs for {account?.name}</h2>
          <span className="text-xs text-gray-500">{account?.tiktokHandle}</span>
        </div>
        <p className="text-sm text-gray-600">Update target values; actuals are system-calculated.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          {categories.map((cat) => {
            const kpi = kpis.find((k) => k.category === cat);
            return (
              <div key={cat} className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-gray-500">{labels[cat]}</div>
                <Input
                  type="number"
                  value={targets[cat]}
                  placeholder="Target"
                  onChange={(e) => handleTargetChange(cat, e.target.value)}
                />
                <div className="text-xs text-gray-500">Actual: {kpi?.actual ?? 0}</div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save targets'}
          </Button>
          <Button variant="ghost" onClick={handleRemove} disabled={removing}>
            {removing ? 'Removing…' : 'Remove account'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
