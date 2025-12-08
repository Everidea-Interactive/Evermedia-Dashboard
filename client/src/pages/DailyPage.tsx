import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatDate } from '../lib/dateUtils';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
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

// PICs that should have pink background (based on screenshot)
const PINK_BACKGROUND_PICS = ['Tata', 'Averus', 'Desi', 'Siti Nuranisa'];

// Format number with dots as thousand separators (Indonesian format)
const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export default function DailyPage() {
  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pics, setPics] = useState<PicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [countType, setCountType] = useState<'post' | 'edit'>('post');
  const [dateRangeType, setDateRangeType] = useState<'today' | 'thisWeek' | 'thisMonth' | 'lastWeek' | 'lastMonth' | 'lifetime'>('today');

  useEffect(() => {
    if (!token) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const [postsData, picsData] = await Promise.all([
          api('/posts/all', { token }),
          api('/pics?active=true', { token }),
        ]);
        setPosts(postsData as Post[]);
        setPics(picsData as PicOption[]);
      } catch (error) {
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

  if (loading) {
    return (
      <div>
        <div className="mb-4">
          <h1 className="page-title">Daily</h1>
        </div>
        <div className="skeleton h-10 w-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        backPath="/campaigns"
        backLabel="Back to campaigns"
        title={<h2 className="page-title">Daily</h2>}
        action={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Range:
              </label>
              <Select
                value={dateRangeType}
                onChange={(e) => setDateRangeType(e.target.value as 'today' | 'thisWeek' | 'thisMonth' | 'lastWeek' | 'lastMonth' | 'lifetime')}
                className="text-sm py-1.5 min-w-[140px]"
              >
                <option value="today">Today</option>
                <option value="thisWeek">This Week</option>
                <option value="thisMonth">This Month</option>
                <option value="lastWeek">Last Week</option>
                <option value="lastMonth">Last Month</option>
                <option value="lifetime">Lifetime</option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Count Type:
              </label>
              <Select
                value={countType}
                onChange={(e) => setCountType(e.target.value as 'post' | 'edit')}
                className="text-sm py-1.5 min-w-[120px]"
              >
                <option value="post">Post</option>
                <option value="edit">Edit</option>
              </Select>
            </div>
          </div>
        }
      />

      {relevantPics.length === 0 ? (
        <Card>
          <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            No {countType === 'post' ? 'Posting' : 'Editor'} PICs found. Please add PICs with {countType === 'post' ? 'POSTING' : 'EDITOR'} role.
          </div>
        </Card>
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH style={{ minWidth: '60px' }}>NO</TH>
                  <TH style={{ minWidth: '120px' }}>TANGGAL POSTING</TH>
                  {relevantPics.map((pic) => {
                    const hasPinkBg = PINK_BACKGROUND_PICS.includes(pic.name);
                    return (
                      <TH
                        key={pic.id}
                        style={{
                          backgroundColor: hasPinkBg ? 'rgba(251, 191, 36, 0.2)' : 'var(--bg-secondary)',
                          minWidth: '100px',
                        }}
                      >
                        {pic.name}
                      </TH>
                    );
                  })}
                  <TH style={{ minWidth: '120px' }}>TOTAL POST ALL</TH>
                </TR>
              </THead>
              <tbody>
                {/* Summary Row */}
                <TR>
                  <TD
                    className="font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: '#10b981',
                    }}
                  >
                    -
                  </TD>
                  <TD
                    className="font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: '#10b981',
                    }}
                  >
                    TOTAL
                  </TD>
                  {relevantPics.map((pic) => {
                    const count = picTotals.totals[pic.id] || 0;
                    const hasPinkBg = PINK_BACKGROUND_PICS.includes(pic.name);
                    return (
                      <TD
                        key={pic.id}
                        className="font-semibold"
                        style={{
                          backgroundColor: hasPinkBg ? 'rgba(251, 191, 36, 0.1)' : 'var(--bg-tertiary)',
                          color: '#10b981',
                        }}
                      >
                        {formatNumber(count)}
                      </TD>
                    );
                  })}
                  <TD
                    className="font-semibold underline"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: '#10b981',
                    }}
                  >
                    {formatNumber(picTotals.grandTotal)}
                  </TD>
                </TR>
                
                {/* Data Rows */}
                {dailyData.length === 0 ? (
                  <TR>
                    <TD colSpan={relevantPics.length + 3} className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                      No data available
                    </TD>
                  </TR>
                ) : (
                  dailyData.map((day, index) => (
                    <TR key={day.dateKey}>
                      <TD>{index + 1}</TD>
                      <TD>{day.date}</TD>
                      {relevantPics.map((pic) => {
                        const count = day.picCounts[pic.id] || 0;
                        const hasPinkBg = PINK_BACKGROUND_PICS.includes(pic.name);
                        return (
                          <TD
                            key={pic.id}
                            style={{
                              backgroundColor: hasPinkBg ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                            }}
                          >
                            {count > 0 ? formatNumber(count) : '0'}
                          </TD>
                        );
                      })}
                      <TD className="underline">
                        {formatNumber(day.total)}
                      </TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}
