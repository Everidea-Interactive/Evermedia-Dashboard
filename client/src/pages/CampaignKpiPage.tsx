import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';
import PageHeader from '../components/PageHeader';

type KPI = { id: string; accountId?: string | null; category: string; target: number; actual: number; remaining: number };

export default function CampaignKpiPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [items, setItems] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api(`/campaigns/${id}/kpis`, { token }).then(setItems).finally(() => setLoading(false));
  }, [id, token]);

  const paginatedItems = useMemo(() => {
    const start = pagination.offset;
    const end = start + pagination.limit;
    return items.slice(start, end);
  }, [items, pagination]);

  const totalPages = Math.ceil(items.length / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  useEffect(() => {
    if (items.length === 0) {
      if (pagination.offset !== 0) {
        setPagination((prev) => ({ ...prev, offset: 0 }));
      }
      return;
    }
    const maxOffset = Math.max(0, Math.floor((items.length - 1) / pagination.limit) * pagination.limit);
    if (pagination.offset > maxOffset) {
      setPagination((prev) => ({ ...prev, offset: maxOffset }));
    }
  }, [items.length, pagination.limit, pagination.offset]);

  const handleRowsPerPageChange = (newLimit: number) => {
    setPagination({ limit: newLimit, offset: 0 });
  };

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
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              No KPI data available.
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, items.length)} of {items.length}
                  {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Rows per page:
                  </label>
                  <Select
                    value={pagination.limit.toString()}
                    onChange={e => handleRowsPerPageChange(Number(e.target.value))}
                    className="text-sm py-1 px-2 w-20"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </Select>
                </div>
              </div>
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
                    {paginatedItems.map(k => (
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
              {totalPages > 1 && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                    disabled={pagination.offset === 0}
                    className="text-sm"
                  >
                    Previous
                  </Button>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                    disabled={pagination.offset + pagination.limit >= items.length}
                    className="text-sm"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
