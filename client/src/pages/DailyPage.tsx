import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatDate } from '../lib/dateUtils';
import { getApiCacheKey, getCachedValue } from '../lib/cache';
import { shouldIgnoreRequestError } from '../lib/requestUtils';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';

type Post = {
  id: string;
  postDate: string;
  picPostingId?: string;
  picEditorId?: string;
  picPosting?: { id: string; name: string } | null;
  picEditor?: { id: string; name: string } | null;
};

type PicOption = {
  id: string;
  name: string;
  roles: string[];
};

type DailyCount = {
  date: string;
  dateKey: string;
  picCounts: Record<string, number>;
  total: number;
};

// Format number with dots as thousand separators (Indonesian format)
const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const STICKY_NO_WIDTH = 72;
const STICKY_DATE_WIDTH = 160;
const stickyVars = {
  // Used by CSS for sticky widths/offsets so header, summary, and body stay aligned
  '--sticky-no-width': `${STICKY_NO_WIDTH}px`,
  '--sticky-date-width': `${STICKY_DATE_WIDTH}px`,
} as CSSProperties;

export default function DailyPage() {
  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pics, setPics] = useState<PicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [countType, setCountType] = useState<'post' | 'edit'>('post');
  const [dateRangeType, setDateRangeType] = useState<'today' | 'thisWeek' | 'thisMonth' | 'lastWeek' | 'lastMonth' | 'lifetime'>('today');
  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
  });
  const POSTS_CACHE_KEY = getApiCacheKey('/posts/all');
  const PICS_CACHE_KEY = getApiCacheKey('/pics?active=true');

  useEffect(() => {
    if (!token) return;
    
    const fetchData = async () => {
      const cachedPosts = getCachedValue<Post[]>(POSTS_CACHE_KEY);
      const cachedPics = getCachedValue<PicOption[]>(PICS_CACHE_KEY);
      const hasCache = !!cachedPosts;
      if (cachedPosts) setPosts(cachedPosts);
      if (cachedPics) setPics(cachedPics);
      setLoading(!hasCache);
      try {
        const [postsData, picsData] = await Promise.all([
          api('/posts/all', { token }),
          api('/pics?active=true', { token }),
        ]);
        setPosts(postsData as Post[]);
        setPics(picsData as PicOption[]);
      } catch (error) {
        if (shouldIgnoreRequestError(error)) {
          return;
        }
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Filter PICs based on count type
  const relevantPics = useMemo(() => {
    if (countType === 'post') {
      // Get PICs with POSTING role
      return pics.filter((pic) => 
        pic.roles.some((role) => role.toUpperCase() === 'POSTING')
      ).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Get PICs with EDITOR role
      return pics.filter((pic) => 
        pic.roles.some((role) => role.toUpperCase() === 'EDITOR')
      ).sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [pics, countType]);

  // Calculate date range based on current date and range type
  const dateRange = useMemo(() => {
    // Lifetime shows all data without date filtering
    if (dateRangeType === 'lifetime') {
      return { start: null, end: null };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate: Date;
    let endDate: Date;
    
    if (dateRangeType === 'today') {
      startDate = new Date(today);
      endDate = new Date(today);
    } else if (dateRangeType === 'thisWeek') {
      // Start of current week (Sunday)
      startDate = new Date(today);
      const day = startDate.getDay();
      startDate.setDate(startDate.getDate() - day);
      // End of current week (Saturday)
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else if (dateRangeType === 'thisMonth') {
      // Start of current month
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      // End of current month
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (dateRangeType === 'lastWeek') {
      // Start of last week (Sunday)
      startDate = new Date(today);
      const day = startDate.getDay();
      startDate.setDate(startDate.getDate() - day - 7);
      // End of last week (Saturday)
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else if (dateRangeType === 'lastMonth') {
      // Start of last month
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      // End of last month
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
    } else {
      // Default to today
      startDate = new Date(today);
      endDate = new Date(today);
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  }, [dateRangeType]);

  // Group posts by date and count by PIC
  const dailyData = useMemo(() => {
    const dateMap = new Map<string, Map<string, number>>();
    
    posts.forEach((post) => {
      const date = new Date(post.postDate);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Filter by date range if selected
      if (dateRange.start && dateRange.end) {
        if (dateKey < dateRange.start || dateKey > dateRange.end) {
          return;
        }
      }
      
      const picId = countType === 'post' 
        ? (post.picPostingId || post.picPosting?.id)
        : (post.picEditorId || post.picEditor?.id);
      
      if (!picId) return;
      
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, new Map());
      }
      
      const picMap = dateMap.get(dateKey)!;
      const currentCount = picMap.get(picId) || 0;
      picMap.set(picId, currentCount + 1);
    });

    // Convert to array and sort by date (descending)
    const dailyCounts: DailyCount[] = Array.from(dateMap.entries())
      .map(([dateKey, picMap]) => {
        const dateStr = formatDate(dateKey);
        const picCounts: Record<string, number> = {};
        let total = 0;
        
        picMap.forEach((count, picId) => {
          picCounts[picId] = count;
          total += count;
        });
        
        return {
          date: dateStr,
          dateKey,
          picCounts,
          total,
        };
      })
      .sort((a, b) => {
        // Sort by date descending (newest first)
        return new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime();
      });

    return dailyCounts;
  }, [posts, countType, dateRange]);

  // Calculate totals for each PIC
  const picTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    let grandTotal = 0;

    dailyData.forEach((day) => {
      relevantPics.forEach((pic) => {
        const count = day.picCounts[pic.id] || 0;
        totals[pic.id] = (totals[pic.id] || 0) + count;
        grandTotal += count;
      });
    });

    return { totals, grandTotal };
  }, [dailyData, relevantPics]);

  const paginatedDailyData = useMemo(() => {
    const start = pagination.offset;
    const end = start + pagination.limit;
    return dailyData.slice(start, end);
  }, [dailyData, pagination]);

  const totalPages = Math.ceil(dailyData.length / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  useEffect(() => {
    setPagination((prev) => ({ ...prev, offset: 0 }));
  }, [dateRangeType, countType]);

  useEffect(() => {
    if (dailyData.length === 0) {
      if (pagination.offset !== 0) {
        setPagination((prev) => ({ ...prev, offset: 0 }));
      }
      return;
    }
    const maxOffset = Math.max(0, Math.floor((dailyData.length - 1) / pagination.limit) * pagination.limit);
    if (pagination.offset > maxOffset) {
      setPagination((prev) => ({ ...prev, offset: maxOffset }));
    }
  }, [dailyData.length, pagination.limit, pagination.offset]);

  const handleRowsPerPageChange = (newLimit: number) => {
    setPagination({ limit: newLimit, offset: 0 });
  };

  return (
    <div>
      <PageHeader
        backPath="/campaigns"
        backLabel="Back to campaigns"
        title={<h2 className="page-title">Daily</h2>}
      />

      {loading ? (
        <div className="skeleton h-10 w-full" />
      ) : (
        <Card>
          <div className="card-inner-table">
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 w-full">
                  <Select
                    label={<span className="text-xs text-gray-500">Range</span>}
                    value={dateRangeType}
                    onChange={(e) =>
                      setDateRangeType(
                        e.target.value as
                          | 'today'
                          | 'thisWeek'
                          | 'thisMonth'
                          | 'lastWeek'
                          | 'lastMonth'
                          | 'lifetime',
                      )
                    }
                    className="text-sm py-1.5 min-w-[140px]"
                  >
                    <option value="today">Today</option>
                    <option value="thisWeek">This Week</option>
                    <option value="thisMonth">This Month</option>
                    <option value="lastWeek">Last Week</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="lifetime">Lifetime</option>
                  </Select>
                  <Select
                    label={<span className="text-xs text-gray-500">Count Type</span>}
                    value={countType}
                    onChange={(e) => setCountType(e.target.value as 'post' | 'edit')}
                    className="text-sm py-1.5 min-w-[120px]"
                  >
                    <option value="post">Post</option>
                    <option value="edit">Edit</option>
                  </Select>
                </div>
                <p className="text-xs text-gray-500">
                  {countType === 'post'
                    ? 'Counts by posting PIC within the selected date range.'
                    : 'Counts by editor PIC within the selected date range.'}
                </p>
              </div>
            </div>

            {relevantPics.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                No {countType === 'post' ? 'Posting' : 'Editor'} PICs found. Please add PICs with{' '}
                {countType === 'post' ? 'POSTING' : 'EDITOR'} role.
              </div>
            ) : (
              <>
                {dailyData.length > 0 && (
                  <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, dailyData.length)} of {dailyData.length}
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
                )}
                <TableWrap className="sticky-table" style={stickyVars}>
                  <Table>
                    <THead>
                      <TR>
                        <TH className="sticky-col sticky-col--no sticky-col--header">
                          NO
                        </TH>
                        <TH className="sticky-col sticky-col--date sticky-col--header">
                          POSTING DATE
                        </TH>
                        {relevantPics.map((pic) => {
                          return (
                            <TH
                              key={pic.id}
                              style={{
                                backgroundColor: 'var(--bg-secondary)',
                                minWidth: '100px',
                              }}
                            >
                              {pic.name}
                            </TH>
                          );
                        })}
                        <TH className="total-col total-col--header" style={{ minWidth: '120px' }}>
                          TOTAL POST ALL
                        </TH>
                      </TR>
                    </THead>
                    <tbody>
                      {/* Summary Row */}
                      <TR className="summary-row">
                        <TD
                          className="font-semibold sticky-col sticky-col--no sticky-col--summary"
                          style={{
                            color: '#10b981',
                          }}
                        >
                          -
                        </TD>
                        <TD
                          className="font-semibold sticky-col sticky-col--date sticky-col--summary"
                          style={{
                            color: '#10b981',
                          }}
                        >
                          TOTAL
                        </TD>
                        {relevantPics.map((pic) => {
                          const count = picTotals.totals[pic.id] || 0;
                          return (
                            <TD
                              key={pic.id}
                              className="font-semibold"
                              style={{
                                backgroundColor: 'var(--bg-tertiary)',
                                color: '#10b981',
                              }}
                            >
                              {formatNumber(count)}
                            </TD>
                          );
                        })}
                        <TD
                          className="font-semibold underline total-col"
                          style={{ color: '#10b981' }}
                        >
                          {formatNumber(picTotals.grandTotal)}
                        </TD>
                      </TR>

                      {/* Data Rows */}
                      {dailyData.length === 0 ? (
                        <TR>
                          <TD
                            colSpan={relevantPics.length + 3}
                            className="text-center py-8"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            No data available
                          </TD>
                        </TR>
                      ) : (
                        paginatedDailyData.map((day, index) => (
                          <TR key={day.dateKey}>
                            <TD className="sticky-col sticky-col--no">
                              {pagination.offset + index + 1}
                            </TD>
                            <TD className="sticky-col sticky-col--date">
                              {day.date}
                            </TD>
                            {relevantPics.map((pic) => {
                              const count = day.picCounts[pic.id] || 0;
                              return <TD key={pic.id}>{count > 0 ? formatNumber(count) : '0'}</TD>;
                            })}
                            <TD className="underline total-col">
                              {formatNumber(day.total)}
                            </TD>
                          </TR>
                        ))
                      )}
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
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                      disabled={pagination.offset + pagination.limit >= dailyData.length}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
