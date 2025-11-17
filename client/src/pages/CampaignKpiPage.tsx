import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';
import PageHeader from '../components/PageHeader';

type KPI = { id: string; accountId?: string | null; category: string; target: number; actual: number; remaining: number };

export default function CampaignKpiPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [items, setItems] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api(`/campaigns/${id}/kpis`, { token }).then(setItems).finally(() => setLoading(false));
  }, [id, token]);

  const backPath = id ? `/campaigns/${id}` : '/campaigns';

  return (
    <div>
      <PageHeader
        backPath={backPath}
        backLabel="Back to campaign"
        title={<h2 className="page-title">KPI</h2>}
      />
      {loading ? <div className="skeleton h-10 w-full" /> : (
        <Card>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Category</TH>
                  <TH>Account</TH>
                  <TH>Target</TH>
                  <TH>Actual</TH>
                  <TH>Remaining</TH>
                </TR>
              </THead>
              <tbody>
                {items.map(k => (
                  <TR key={k.id}>
                    <TD>{k.category}</TD>
                    <TD>{k.accountId || '-'}</TD>
                    <TD>{k.target}</TD>
                    <TD>{k.actual}</TD>
                    <TD>{k.remaining}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}
