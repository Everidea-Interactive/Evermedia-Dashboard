import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import Input from './ui/Input';
import Toast from './ui/Toast';

// Helper function to remove leading zeros from number input
const sanitizeNumberInput = (value: string): string => {
  if (value === '' || value === '0') return value;
  // Remove leading zeros but keep the number
  const num = value.replace(/^0+/, '');
  return num === '' ? '0' : num;
};

type AccountGmvEditModalProps = {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  accountId: string;
  onSuccess?: () => void;
};

export default function AccountGmvEditModal({ open, onClose, campaignId, accountId, onSuccess }: AccountGmvEditModalProps) {
  const { token } = useAuth();
  const [account, setAccount] = useState<any>(null);
  const [gmvKpi, setGmvKpi] = useState<any>(null);
  const [actualGmv, setActualGmv] = useState<string>('');
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
        const gmvKpiData = (kpiData as any[]).find((k) => k.category === 'GMV_IDR');
        setGmvKpi(gmvKpiData);
        setActualGmv(gmvKpiData ? String(gmvKpiData.actual ?? '') : '');
      })
      .catch((error) => {
        console.error('Failed to load account or KPI data:', error);
        setToast({ message: 'Failed to load data', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [open, campaignId, accountId, token]);

  const handleActualGmvChange = (value: string) => {
    const sanitizedValue = sanitizeNumberInput(value);
    setActualGmv(sanitizedValue);
  };

  const handleSave = async () => {
    if (!campaignId || !accountId) return;
    
    // Validate input
    const actualValue = actualGmv === '' || actualGmv === undefined ? 0 : Number(actualGmv);
    if (isNaN(actualValue) || actualValue < 0) {
      setToast({ message: 'Invalid GMV value. Please enter a valid number.', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      if (gmvKpi) {
        // Update existing KPI
        await api(`/kpis/${gmvKpi.id}`, {
          method: 'PUT',
          body: { actual: actualValue },
          token,
        });
      } else {
        // Create new KPI if it doesn't exist
        await api('/kpis', {
          method: 'POST',
          body: {
            campaignId,
            accountId,
            category: 'GMV_IDR',
            target: 0,
            actual: actualValue,
          },
          token,
        });
      }
      
      setToast({ message: 'GMV updated successfully', type: 'success' });
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to update GMV', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`Edit GMV for ${account?.name || 'Account'}`}
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" color="blue" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save GMV'}
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
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Update the actual GMV (IDR) value for this account in this campaign.
            </p>
            <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>GMV (IDR)</div>
              <Input
                type="number"
                value={actualGmv}
                placeholder="Enter actual GMV"
                onChange={(e) => handleActualGmvChange(e.target.value)}
                min="0"
                label="Actual GMV (IDR)"
              />
              {gmvKpi && (
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Target: {gmvKpi.target?.toLocaleString() ?? 0}
                </div>
              )}
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

