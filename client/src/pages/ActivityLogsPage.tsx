import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/dateUtils';
import { shouldIgnoreRequestError } from '../lib/requestUtils';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import PageHeader from '../components/PageHeader';
import { Table, TableWrap, THead, TH, TR, TD } from '../components/ui/Table';
import Button from '../components/ui/Button';

type ActivityLog = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'Campaign' | 'Account' | 'Post' | 'User' | 'KPI' | 'PIC';
  entityId: string;
  entityName?: string;
  oldValues?: any;
  newValues?: any;
  description?: string;
  createdAt: string;
};

type ActivityLogsResponse = {
  logs: ActivityLog[];
  total: number;
  limit: number;
  offset: number;
};

export default function ActivityLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    userId: '',
    entityType: '',
    entityId: '',
    action: '',
    dateFrom: '',
    dateTo: '',
  });
  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
  });

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.entityType) params.append('entityType', filters.entityType);
    if (filters.entityId) params.append('entityId', filters.entityId);
    if (filters.action) params.append('action', filters.action);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    params.append('limit', String(pagination.limit));
    params.append('offset', String(pagination.offset));

    api(`/activity-logs?${params.toString()}`, { token })
      .then((data: ActivityLogsResponse) => {
        setLogs(data.logs);
        setTotal(data.total);
      })
      .catch((error: any) => {
        if (shouldIgnoreRequestError(error)) {
          return;
        }
        console.error('Failed to fetch activity logs:', error);
        setLogs([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [token, filters, pagination]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset to first page when filtering
  };

  const handleResetFilters = () => {
    setFilters({
      userId: '',
      entityType: '',
      entityId: '',
      action: '',
      dateFrom: '',
      dateTo: '',
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const handleRowsPerPageChange = (newLimit: number) => {
    setPagination({ limit: newLimit, offset: 0 });
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return { color: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.1)', borderColor: '#86efac' };
      case 'UPDATE':
        return { color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' };
      case 'DELETE':
        return { color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)', borderColor: '#fca5a5' };
      default:
        return { color: '#6b7280', backgroundColor: 'rgba(107, 114, 128, 0.1)', borderColor: '#d1d5db' };
    }
  };


  const totalPages = Math.ceil(total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  useEffect(() => {
    if (total === 0) {
      if (pagination.offset !== 0) {
        setPagination((prev) => ({ ...prev, offset: 0 }));
      }
      return;
    }
    const maxOffset = Math.max(0, Math.floor((total - 1) / pagination.limit) * pagination.limit);
    if (pagination.offset > maxOffset) {
      setPagination((prev) => ({ ...prev, offset: maxOffset }));
    }
  }, [total, pagination.limit, pagination.offset]);

  return (
    <div>
      <PageHeader
        backPath="/campaigns"
        backLabel="Back to campaigns"
        title={<h2 className="page-title">Activity Logs</h2>}
      />
      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Filters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Select
              label="Action"
              value={filters.action}
              onChange={e => handleFilterChange('action', e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </Select>
            <Select
              label="Entity Type"
              value={filters.entityType}
              onChange={e => handleFilterChange('entityType', e.target.value)}
            >
              <option value="">All Types</option>
              <option value="Campaign">Campaign</option>
              <option value="Account">Account</option>
              <option value="Post">Post</option>
              <option value="User">User</option>
              <option value="KPI">KPI</option>
              <option value="PIC">PIC</option>
            </Select>
            <Input
              label="Entity ID"
              value={filters.entityId}
              onChange={e => handleFilterChange('entityId', e.target.value)}
              placeholder="Filter by entity ID"
            />
            <Input
              label="User ID"
              value={filters.userId}
              onChange={e => handleFilterChange('userId', e.target.value)}
              placeholder="Filter by user ID"
            />
            <Input
              label="Date From"
              type="date"
              value={filters.dateFrom}
              onChange={e => handleFilterChange('dateFrom', e.target.value)}
            />
            <Input
              label="Date To"
              type="date"
              value={filters.dateTo}
              onChange={e => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>
      <Card className="mt-4">
        <div className="mb-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Activity History ({total} total)
          </h2>
        </div>
        {loading ? (
          <div className="skeleton h-10 w-full" />
        ) : logs.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
            No activity logs found
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, total)} of {total}
                {totalPages > 1 && ` (Page ${currentPage} of ${totalPages || 1})`}
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
                    <TH>Timestamp</TH>
                    <TH>User</TH>
                    <TH>Action</TH>
                    <TH>Entity Type</TH>
                    <TH>Description</TH>
                    <TH>Entity ID</TH>
                  </TR>
                </THead>
                <tbody>
                  {logs.map(log => {
                    const badgeStyle = getActionBadgeColor(log.action);
                    return (
                      <TR key={log.id}>
                        <TD>
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            {formatDateTime(log.createdAt)}
                          </span>
                        </TD>
                        <TD>
                          <div>
                            <div style={{ color: 'var(--text-primary)' }}>{log.userName}</div>
                            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {log.userEmail}
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <span className="text-xs px-2 py-1 rounded border" style={badgeStyle}>
                            {log.action}
                          </span>
                        </TD>
                        <TD>
                          <span style={{ color: 'var(--text-secondary)' }}>{log.entityType}</span>
                        </TD>
                        <TD>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {log.description || (
                              <span style={{ color: 'var(--text-tertiary)' }}>
                                {log.action} {log.entityType}{log.entityName ? ` "${log.entityName}"` : ''}
                              </span>
                            )}
                          </span>
                        </TD>
                        <TD>
                          <code className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {log.entityId}
                          </code>
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
            {totalPages > 1 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                  disabled={pagination.offset === 0}
                >
                  Previous
                </Button>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Page {currentPage} of {totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                  disabled={pagination.offset + pagination.limit >= total}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

