import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import Input from './ui/Input';
import Toast from './ui/Toast';

const categories = ['VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR', 'YELLOW_CART'];
const labels: Record<string, string> = {
  VIEWS: 'Views',
  QTY_POST: 'Qty Post',
  FYP_COUNT: 'FYP Count',
  VIDEO_COUNT: 'Video Count',
  GMV_IDR: 'GMV (IDR)',
  YELLOW_CART: 'Yellow Cart',
};

// Helper function to remove leading zeros from number input
const sanitizeNumberInput = (value: string): string => {
  if (value === '' || value === '0') return value;
  // Remove leading zeros but keep the number
  const num = value.replace(/^0+/, '');
  return num === '' ? '0' : num;
};

type AccountKpiEditModalProps = {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  accountId: string;
  onSuccess?: () => void;
};

export default function AccountKpiEditModal({ open, onClose, campaignId, accountId, onSuccess }: AccountKpiEditModalProps) {
  const { token } = useAuth();
  const [account, setAccount] = useState<any>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((cat) => [cat, '']))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!open || !campaignId || !accountId) return;
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
  }, [open, campaignId, accountId, token]);

  const handleTargetChange = (category: string, value: string) => {
    const sanitizedValue = sanitizeNumberInput(value);
    setTargets((prev) => ({ ...prev, [category]: sanitizedValue }));
  };

  const handleSave = async () => {
    if (!campaignId || !accountId) return;
    setSaving(true);
    try {
      const promises: Promise<any>[] = [];
      
      // Update existing KPIs
      for (const kpi of kpis) {
        const targetStr = targets[kpi.category];
        // Allow 0 as a valid value, only default to 0 if empty/undefined
        const targetValue = targetStr === '' || targetStr === undefined 
          ? 0 
          : Number(targetStr);
        if (isNaN(targetValue) || targetValue < 0) {
          setToast({ message: `Invalid target value for ${labels[kpi.category]}`, type: 'error' });
          setSaving(false);
          return;
        }
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
          const targetStr = targets[cat];
          // Only create if target value is provided (including 0)
          if (targetStr !== '' && targetStr !== undefined) {
            const targetValue = Number(targetStr);
            if (isNaN(targetValue) || targetValue < 0) {
              setToast({ message: `Invalid target value for ${labels[cat]}`, type: 'error' });
              setSaving(false);
              return;
            }
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
      setToast({ message: 'KPIs saved successfully', type: 'success' });
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to save KPIs', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`Edit KPIs for ${account?.name || 'Account'}`}
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" color="blue" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save targets'}
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="text-center py-8">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{account?.tiktokHandle}</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Update target values; actuals are system-calculated.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                      min="0"
                    />
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Actual: {kpi?.actual ?? 0}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Dialog>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

