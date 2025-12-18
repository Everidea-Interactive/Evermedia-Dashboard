import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { formatDateForChart } from '../lib/dateUtils';

interface EngagementVisualizerProps {
  engagement: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    engagementRate: number;
  } | null;
  posts: Array<{
    postDate: string;
    totalView: number;
    totalLike: number;
    totalComment: number;
    totalShare: number;
    totalSaved: number;
  }>;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export default function EngagementVisualizer({ engagement, posts }: EngagementVisualizerProps) {
  const barChartData = useMemo(() => {
    if (!engagement) return [];
    return [
      { name: 'Views', value: engagement.views },
      { name: 'Likes', value: engagement.likes },
      { name: 'Comments', value: engagement.comments },
      { name: 'Shares', value: engagement.shares },
      { name: 'Saved', value: engagement.saves },
    ];
  }, [engagement]);

  const pieChartData = useMemo(() => {
    if (!engagement) return [];
    // Exclude views from pie chart as it's usually much larger
    return [
      { name: 'Likes', value: engagement.likes },
      { name: 'Comments', value: engagement.comments },
      { name: 'Shares', value: engagement.shares },
      { name: 'Saved', value: engagement.saves },
    ].filter(item => item.value > 0);
  }, [engagement]);

  const timeSeriesData = useMemo(() => {
    if (!posts || posts.length === 0) return [];
    
    // Group posts by date
    const groupedByDate = new Map<string, {
      date: string;
      dateKey: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      saved: number;
    }>();

    posts.forEach((post) => {
      const postDate = new Date(post.postDate);
      const dateKey = postDate.toISOString().split('T')[0]; // YYYY-MM-DD for sorting
      const dateDisplay = formatDateForChart(postDate, 'numeric');
      
      const existing = groupedByDate.get(dateKey);
      if (existing) {
        existing.views += post.totalView || 0;
        existing.likes += post.totalLike || 0;
        existing.comments += post.totalComment || 0;
        existing.shares += post.totalShare || 0;
        existing.saved += post.totalSaved || 0;
      } else {
        groupedByDate.set(dateKey, {
          date: dateDisplay,
          dateKey,
          views: post.totalView || 0,
          likes: post.totalLike || 0,
          comments: post.totalComment || 0,
          shares: post.totalShare || 0,
          saved: post.totalSaved || 0,
        });
      }
    });

    // Sort by date key (YYYY-MM-DD format)
    return Array.from(groupedByDate.values()).sort((a, b) => {
      return a.dateKey.localeCompare(b.dateKey);
    });
  }, [posts]);

  if (!engagement) {
    return (
      <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        No engagement data available
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
      {/* Bar Chart - All Metrics */}
      <div className="rounded-lg border p-2 sm:p-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4" style={{ color: 'var(--text-primary)' }}>
          Engagement Metrics Comparison
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={barChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis 
              dataKey="name" 
              stroke="var(--text-secondary)"
              style={{ fontSize: '10px' }}
              className="sm:text-xs"
            />
            <YAxis 
              stroke="var(--text-secondary)"
              style={{ fontSize: '10px' }}
              className="sm:text-xs"
              tickFormatter={formatNumber}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)'
              }}
              formatter={(value: number | undefined) => value?.toLocaleString() ?? ''}
            />
            <Legend />
            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart - Engagement Breakdown */}
      {pieChartData.length > 0 && (
        <div className="rounded-lg border p-2 sm:p-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <h3 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4" style={{ color: 'var(--text-primary)' }}>
            Engagement Breakdown (Excluding Views)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Line Chart - Time Series */}
      {timeSeriesData.length > 0 && (
        <div className="rounded-lg border p-2 sm:p-4 lg:col-span-2" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <h3 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4" style={{ color: 'var(--text-primary)' }}>
            Engagement Over Time
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey="date" 
                stroke="var(--text-secondary)"
                style={{ fontSize: '10px' }}
                className="sm:text-xs"
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="var(--text-secondary)"
                style={{ fontSize: '10px' }}
                className="sm:text-xs"
                tickFormatter={formatNumber}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2} name="Views" />
              <Line type="monotone" dataKey="likes" stroke="#10b981" strokeWidth={2} name="Likes" />
              <Line type="monotone" dataKey="comments" stroke="#f59e0b" strokeWidth={2} name="Comments" />
              <Line type="monotone" dataKey="shares" stroke="#ef4444" strokeWidth={2} name="Shares" />
              <Line type="monotone" dataKey="saved" stroke="#8b5cf6" strokeWidth={2} name="Saved" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

