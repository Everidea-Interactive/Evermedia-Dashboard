import { useEffect, useMemo, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Toast from '../components/ui/Toast';
import RequirePermission from '../components/RequirePermission';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';
import PageHeader from '../components/PageHeader';
import EngagementVisualizer from '../components/EngagementVisualizer';
import AccountKpiEditModal from '../components/AccountKpiEditModal';

const statusPills: Record<string, { bg: string; border: string; text: string }> = {
  ACTIVE: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
  PLANNED: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' },
  PAUSED: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' },
  COMPLETED: { bg: 'var(--bg-tertiary)', border: 'var(--border-color)', text: 'var(--text-secondary)' },
};

const accountCategoryOrder = ['VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR', 'YELLOW_CART'];
const categoryLabels: Record<string, string> = {
  VIEWS: 'Views',
  QTY_POST: 'Qty Post',
  FYP_COUNT: 'FYP Count',
  VIDEO_COUNT: 'Video Count',
  GMV_IDR: 'GMV (IDR)',
  YELLOW_CART: 'Yellow Cart',
};

const CONTENT_CATEGORY_OPTIONS = ['Hardsell product', 'Trend/FOMO', 'Berita/Event', 'Topik Sensitive', 'Sosok/Quotes/Film', 'Storytell', 'Edukasi Product'];
const CONTENT_TYPE_OPTIONS = ['Slide', 'Video'];
const STATUS_OPTIONS = ['On Going', 'Upload', 'Archive', 'Take Down'];

// Helper function to remove leading zeros from number input
const sanitizeNumberInput = (value: string): string => {
  if (value === '' || value === '0') return value;
  // Remove leading zeros but keep the number
  const num = value.replace(/^0+/, '');
  return num === '' ? '0' : num;
};

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { canManageCampaigns, canDelete, canEditPost, canDeletePost } = usePermissions();
  const [campaign, setCampaign] = useState<any>(null);
  const [engagement, setEngagement] = useState<any>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [postsLoading, setPostsLoading] = useState(false);
  const [accountRemoving, setAccountRemoving] = useState<Record<string, boolean>>({});
  const [editingCell, setEditingCell] = useState<{ postId: string; field: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [pics, setPics] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePostConfirm, setDeletePostConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [editingAccountKpi, setEditingAccountKpi] = useState<string | null>(null);
  const [removeAccountConfirm, setRemoveAccountConfirm] = useState<{ id: string; name: string } | null>(null);
  const [postFilters, setPostFilters] = useState({
    accountId: '',
    status: '',
    contentType: '',
    contentCategory: '',
    dateFrom: '',
    dateTo: '',
  });
  const [postPagination, setPostPagination] = useState({
    limit: 5,
    offset: 0,
  });

  useEffect(() => {
    if (!id) return;
    api(`/campaigns/${id}`, { token }).then(setCampaign);
    api(`/campaigns/${id}/dashboard/engagement`, { token }).then(setEngagement);
    api(`/campaigns/${id}/kpis`, { token }).then(setKpis);
    api('/pics?active=true', { token }).then(setPics).catch(() => {});
    api('/accounts', { token }).then(setAccounts).catch(() => {});
  }, [id, token]);

  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setPostsLoading(true);
    try {
      const params = new URLSearchParams();
      if (postFilters.accountId) params.append('accountId', postFilters.accountId);
      if (postFilters.status) params.append('status', postFilters.status);
      if (postFilters.contentType) params.append('contentType', postFilters.contentType);
      if (postFilters.contentCategory) params.append('category', postFilters.contentCategory);
      if (postFilters.dateFrom) params.append('dateFrom', postFilters.dateFrom);
      if (postFilters.dateTo) params.append('dateTo', postFilters.dateTo);
      params.append('limit', String(postPagination.limit));
      params.append('offset', String(postPagination.offset));

      const response = await api(`/campaigns/${id}/posts?${params.toString()}`, { token });
      if (response.posts) {
        setPosts(response.posts);
        setPostsTotal(response.total || 0);
      } else {
        // Fallback for old API format
        setPosts(Array.isArray(response) ? response : []);
        setPostsTotal(Array.isArray(response) ? response.length : 0);
      }
    } catch (error: any) {
      console.error('Failed to fetch posts:', error);
      setPosts([]);
      setPostsTotal(0);
    } finally {
      setPostsLoading(false);
    }
  }, [id, token, postFilters, postPagination]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleFilterChange = (key: string, value: string) => {
    setPostFilters((prev) => ({ ...prev, [key]: value }));
    setPostPagination((prev) => ({ ...prev, offset: 0 })); // Reset to first page when filtering
  };

  const handleResetFilters = () => {
    setPostFilters({
      accountId: '',
      status: '',
      contentType: '',
      contentCategory: '',
      dateFrom: '',
      dateTo: '',
    });
    setPostPagination((prev) => ({ ...prev, offset: 0 }));
  };

  // Define the order of editable columns
  const EDITABLE_FIELDS = [
    'accountId',
    'postDate',
    'postTitle',
    'contentType',
    'contentCategory',
    'campaignCategory',
    'picTalentId',
    'picEditorId',
    'picPostingId',
    'contentLink',
    'adsOnMusic',
    'yellowCart',
    'status',
    'totalView',
    'totalLike',
    'totalComment',
    'totalShare',
    'totalSaved',
  ] as const;

  const talentPics = useMemo(() => pics.filter((pic: any) => pic.roles?.some((role: string) => role.toUpperCase() === 'TALENT')), [pics]);
  const editorPics = useMemo(() => pics.filter((pic: any) => pic.roles?.some((role: string) => role.toUpperCase() === 'EDITOR')), [pics]);
  const postingPics = useMemo(() => pics.filter((pic: any) => pic.roles?.some((role: string) => role.toUpperCase() === 'POSTING')), [pics]);

  const handleCellClick = (postId: string, field: string, currentValue: string | number | boolean) => {
    let valueToEdit = '';
    if (typeof currentValue === 'boolean') {
      valueToEdit = currentValue ? 'true' : 'false';
    } else if (field === 'postDate' && currentValue) {
      // Format date as YYYY-MM-DD for date input
      valueToEdit = new Date(currentValue).toISOString().split('T')[0];
    } else if (currentValue !== null && currentValue !== undefined) {
      valueToEdit = String(currentValue);
    }
    setEditingCell({ postId, field });
    setCellEditValue(valueToEdit);
  };

  const handleCellBlur = async (postId: string, field: string, skipClose?: boolean): Promise<any | null> => {
    if (!editingCell || editingCell.postId !== postId || editingCell.field !== field) return null;
    
    const post = posts.find((p: any) => p.id === postId);
    if (!post) return null;

    // Check if value actually changed
    let hasChanged = false;
    let newValue: any = cellEditValue;

    if (field === 'postDate') {
      const currentDate = post.postDate ? new Date(post.postDate).toISOString().split('T')[0] : '';
      hasChanged = cellEditValue !== currentDate;
      if (!hasChanged) {
        if (!skipClose) setEditingCell(null);
        return null;
      }
    } else if (field === 'accountId') {
      hasChanged = cellEditValue !== post.accountId;
    } else if (field === 'postTitle' || field === 'contentLink') {
      hasChanged = cellEditValue !== (post[field] || '');
    } else if (field === 'contentType' || field === 'contentCategory' || field === 'status' || field === 'campaignCategory') {
      hasChanged = cellEditValue !== (post[field] || '');
    } else if (field === 'picTalentId' || field === 'picEditorId' || field === 'picPostingId') {
      const currentId = post[field] || '';
      hasChanged = cellEditValue !== currentId;
    } else if (field === 'adsOnMusic' || field === 'yellowCart') {
      const currentBool = post[field] ? 'true' : 'false';
      hasChanged = cellEditValue !== currentBool;
      newValue = cellEditValue === 'true';
    } else if (['totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved'].includes(field)) {
      const currentNum = post[field] || 0;
      const newNum = parseInt(cellEditValue || '0', 10) || 0;
      hasChanged = newNum !== currentNum;
      newValue = newNum;
    }

    if (!hasChanged) {
      if (!skipClose) setEditingCell(null);
      return null;
    }

    setSavingCell(`${postId}-${field}`);
    try {
      const updatePayload: any = {};
      
      if (field === 'postDate') {
        updatePayload.postDate = new Date(cellEditValue).toISOString();
      } else if (field === 'accountId') {
        updatePayload.accountId = cellEditValue || undefined;
      } else if (field === 'postTitle') {
        updatePayload.postTitle = cellEditValue;
      } else if (field === 'contentLink') {
        updatePayload.contentLink = cellEditValue;
      } else if (field === 'contentType') {
        updatePayload.contentType = cellEditValue;
      } else if (field === 'contentCategory') {
        updatePayload.contentCategory = cellEditValue;
      } else if (field === 'campaignCategory') {
        updatePayload.campaignCategory = cellEditValue;
      } else if (field === 'status') {
        updatePayload.status = cellEditValue;
      } else if (field === 'picTalentId') {
        updatePayload.picTalentId = cellEditValue || undefined;
      } else if (field === 'picEditorId') {
        updatePayload.picEditorId = cellEditValue || undefined;
      } else if (field === 'picPostingId') {
        updatePayload.picPostingId = cellEditValue || undefined;
      } else if (field === 'adsOnMusic') {
        updatePayload.adsOnMusic = newValue;
      } else if (field === 'yellowCart') {
        updatePayload.yellowCart = newValue;
      } else if (['totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved'].includes(field)) {
        updatePayload[field] = newValue;
      }

      const updatedPost = await api(`/posts/${postId}`, {
        method: 'PUT',
        token,
        body: updatePayload,
      });

      // Helper functions to get related objects
      const getPicObject = (picId: string | undefined) => {
        if (!picId) return null;
        const pic = pics.find((p: any) => p.id === picId);
        return pic ? { id: pic.id, name: pic.name } : null;
      };
      
      const getAccountObject = (accountId: string | undefined) => {
        if (!accountId) return null;
        const account = accounts.find((a: any) => a.id === accountId);
        return account ? { id: account.id, name: account.name } : null;
      };
      
      // Build updated post with relations
      const updatedPostWithRelations: any = {
        ...updatedPost,
        account: updatedPost.accountId ? getAccountObject(updatedPost.accountId) : post.account,
        picTalent: updatedPost.picTalentId ? getPicObject(updatedPost.picTalentId) : post.picTalent,
        picEditor: updatedPost.picEditorId ? getPicObject(updatedPost.picEditorId) : post.picEditor,
        picPosting: updatedPost.picPostingId ? getPicObject(updatedPost.picPostingId) : post.picPosting,
      };

      // Update the post in the list
      setPosts((prevPosts: any[]) => prevPosts.map((p: any) => {
        if (p.id === postId) {
          return updatedPostWithRelations;
        }
        return p;
      }));

      // Refresh KPIs and engagement
      const [refreshedKpis, refreshedEngagement] = await Promise.all([
        api(`/campaigns/${id}/kpis`, { token }),
        api(`/campaigns/${id}/dashboard/engagement`, { token }),
      ]);
      setKpis(refreshedKpis);
      setEngagement(refreshedEngagement);

      setToast({ message: 'Post updated successfully', type: 'success' });
      return updatedPostWithRelations;
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to update post', type: 'error' });
      return null;
    } finally {
      setSavingCell(null);
      if (!skipClose) {
        setEditingCell(null);
      }
    }
  };

  const findNextEditableCell = (currentPostIndex: number, currentField: string, direction: 'next' | 'prev'): { postIndex: number; field: string } | null => {
    const currentFieldIndex = EDITABLE_FIELDS.indexOf(currentField as typeof EDITABLE_FIELDS[number]);
    
    if (direction === 'next') {
      // Try next field in same row
      if (currentFieldIndex < EDITABLE_FIELDS.length - 1) {
        return { postIndex: currentPostIndex, field: EDITABLE_FIELDS[currentFieldIndex + 1] };
      }
      // Move to first field of next row
      if (currentPostIndex < posts.length - 1) {
        return { postIndex: currentPostIndex + 1, field: EDITABLE_FIELDS[0] };
      }
    } else {
      // Try previous field in same row
      if (currentFieldIndex > 0) {
        return { postIndex: currentPostIndex, field: EDITABLE_FIELDS[currentFieldIndex - 1] };
      }
      // Move to last field of previous row
      if (currentPostIndex > 0) {
        return { postIndex: currentPostIndex - 1, field: EDITABLE_FIELDS[EDITABLE_FIELDS.length - 1] };
      }
    }
    
    return null;
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, postId: string, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleCellBlur(postId, field);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      
      // Save current cell in background (don't wait for it)
      void handleCellBlur(postId, field, true);
      
      // Navigate immediately using current data
      const currentPostIndex = posts.findIndex((p: any) => p.id === postId);
      
      if (currentPostIndex === -1) {
        setEditingCell(null);
        return;
      }
      
      // Optimistically update the current post with the edited value for navigation
      const post = posts.find((p: any) => p.id === postId);
      if (!post) {
        setEditingCell(null);
        return;
      }
      
      // Create optimistic update for navigation
      const optimisticPost: any = { ...post };
      if (field === 'postDate') {
        optimisticPost.postDate = new Date(cellEditValue).toISOString();
      } else if (field === 'accountId') {
        optimisticPost.accountId = cellEditValue || post.accountId;
      } else if (field === 'postTitle' || field === 'contentLink') {
        optimisticPost[field] = cellEditValue;
      } else if (field === 'contentType' || field === 'contentCategory' || field === 'status' || field === 'campaignCategory') {
        optimisticPost[field] = cellEditValue;
      } else if (field === 'picTalentId' || field === 'picEditorId' || field === 'picPostingId') {
        optimisticPost[field] = cellEditValue || undefined;
      } else if (field === 'adsOnMusic' || field === 'yellowCart') {
        optimisticPost[field] = cellEditValue === 'true';
      } else if (['totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved'].includes(field)) {
        optimisticPost[field] = parseInt(cellEditValue || '0', 10) || 0;
      }
      
      const optimisticPosts = posts.map((p: any) => p.id === postId ? optimisticPost : p);
      
      const direction = e.shiftKey ? 'prev' : 'next';
      const nextCell = findNextEditableCell(currentPostIndex, field, direction);
      
      if (nextCell) {
        const nextPost = optimisticPosts[nextCell.postIndex];
        if (nextPost) {
          // Get the current value for the next field
          let currentValue: string | number | boolean = '';
          
          if (nextCell.field === 'accountId') {
            currentValue = nextPost.accountId || '';
          } else if (nextCell.field === 'picTalentId') {
            currentValue = nextPost.picTalentId || '';
          } else if (nextCell.field === 'picEditorId') {
            currentValue = nextPost.picEditorId || '';
          } else if (nextCell.field === 'picPostingId') {
            currentValue = nextPost.picPostingId || '';
          } else if (nextCell.field === 'postDate') {
            currentValue = nextPost.postDate ? new Date(nextPost.postDate).toISOString().split('T')[0] : '';
          } else if (nextCell.field === 'adsOnMusic' || nextCell.field === 'yellowCart') {
            currentValue = nextPost[nextCell.field];
          } else {
            const fieldValue = nextPost[nextCell.field];
            if (typeof fieldValue === 'boolean') {
              currentValue = fieldValue;
            } else if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
              currentValue = fieldValue;
            }
          }
          
          // Navigate immediately
          handleCellClick(nextPost.id, nextCell.field, currentValue);
        }
      } else {
        // No next cell, close editing
        setEditingCell(null);
      }
    }
  };

  const handleAccountRemove = async () => {
    if (!id || !removeAccountConfirm) return;
    const { id: accountId } = removeAccountConfirm;
    setAccountRemoving((prev) => ({ ...prev, [accountId]: true }));
    try {
      await api(`/campaigns/${id}/accounts/${accountId}`, { method: 'DELETE', token });
      const refreshed = await api(`/campaigns/${id}`, { token });
      setCampaign(refreshed);
      setToast({ message: 'Account removed successfully', type: 'success' });
      setRemoveAccountConfirm(null);
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to remove account', type: 'error' });
    } finally {
      setAccountRemoving((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const handleRefreshCampaign = async () => {
    if (!id) return;
    try {
      const refreshed = await api(`/campaigns/${id}`, { token });
      setCampaign(refreshed);
      const refreshedKpis = await api(`/campaigns/${id}/kpis`, { token });
      setKpis(refreshedKpis);
    } catch (error: any) {
      console.error('Failed to refresh campaign:', error);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api(`/campaigns/${id}`, { method: 'DELETE', token });
      navigate('/campaigns');
    } catch (error: any) {
      alert(error?.error || 'Failed to delete campaign');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const handleDeletePostClick = (post: any) => {
    setDeletePostConfirm({ id: post.id, title: post.postTitle });
  };

  const handleDeletePostConfirm = async () => {
    if (!deletePostConfirm || !id) return;
    const { id: postId } = deletePostConfirm;
    setDeletingPost(true);
    try {
      await api(`/posts/${postId}`, { method: 'DELETE', token });
      await fetchPosts();
      
      // Refresh KPIs and engagement after deletion
      const [refreshedKpis, refreshedEngagement] = await Promise.all([
        api(`/campaigns/${id}/kpis`, { token }),
        api(`/campaigns/${id}/dashboard/engagement`, { token }),
      ]);
      setKpis(refreshedKpis);
      setEngagement(refreshedEngagement);
      
      setToast({ message: 'Post deleted successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to delete post', type: 'error' });
    } finally {
      setDeletingPost(false);
      setDeletePostConfirm(null);
    }
  };

  const totalViews = useMemo(() => posts.reduce((acc, p) => acc + (p.totalView ?? 0), 0), [posts]);
  const totalLikes = useMemo(() => posts.reduce((acc, p) => acc + (p.totalLike ?? 0), 0), [posts]);
  const campaignKpiSummary = useMemo(() => {
    const map = new Map<string, { target: number; actual: number }>();
    // Only include campaign-level KPIs (where accountId is null)
    kpis.filter((k) => !k.accountId).forEach((k) => {
      const existing = map.get(k.category) ?? { target: 0, actual: 0 };
      map.set(k.category, { target: existing.target + (k.target ?? 0), actual: existing.actual + (k.actual ?? 0) });
    });
    return map;
  }, [kpis]);

  const accountKpiMap = useMemo(() => {
    const map = new Map<string, Record<string, { target: number; actual: number }>>();
    kpis.forEach((k) => {
      if (!k.accountId) return;
      if (!map.has(k.accountId)) map.set(k.accountId, {});
      
      // For QTY_POST, calculate actual from posts for current campaign only
      if (k.category === 'QTY_POST') {
        const postCount = posts.filter((p: any) => p.accountId === k.accountId).length;
        map.get(k.accountId)![k.category] = { target: k.target ?? 0, actual: postCount };
      } else {
        map.get(k.accountId)![k.category] = { target: k.target ?? 0, actual: k.actual ?? 0 };
      }
    });
    return map;
  }, [kpis, posts]);

  const backPath = '/campaigns';

  if (!campaign) {
    return (
      <div>
        <PageHeader backPath={backPath} backLabel="Back to campaigns" title={<div className="page-title">Loading…</div>} />
        <div className="mt-3">Loading…</div>
      </div>
    );
  }

  const headerMeta = (
    <div className="flex flex-wrap gap-1">
      {Array.isArray(campaign.categories) && campaign.categories.length > 0 ? (
        campaign.categories.map((cat: string, idx: number) => (
          <span key={idx} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#6366f1' }}>
            {cat}
          </span>
        ))
      ) : (
        <span style={{ color: 'var(--text-tertiary)' }}>No categories</span>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        backPath={backPath}
        backLabel="Back to campaigns"
        title={
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-start">
            <h1 className="page-title text-xl sm:text-2xl">{campaign.name}</h1>
            <span 
              className="badge border text-xs sm:text-sm" 
              style={statusPills[campaign.status] ? {
                backgroundColor: statusPills[campaign.status].bg,
                borderColor: statusPills[campaign.status].border,
                color: statusPills[campaign.status].text
              } : {}}
            >
              {campaign.status}
            </span>
          </div>
        }
        meta={headerMeta}
        action={
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <RequirePermission permission={canManageCampaigns}>
              <Link
                to={`/campaigns/${campaign.id}/edit`}
                className="btn btn-outline-blue text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-none"
              >
                Edit campaign
              </Link>
            </RequirePermission>
            <RequirePermission permission={canDelete}>
              <Button
                variant="outline"
                color="red"
                onClick={() => setDeleteConfirm(true)}
                disabled={deleting}
                className="text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-none"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </RequirePermission>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Card>
          <div className="section-title text-xs sm:text-sm">Views</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.views?.toLocaleString() ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Likes</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.likes?.toLocaleString() ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Comments</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.comments?.toLocaleString() ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Shares</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.shares?.toLocaleString() ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Saved</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.saves?.toLocaleString() ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Engagement Rate</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.engagementRate ? (engagement.engagementRate * 100).toFixed(2) + '%' : '-'}</div>
        </Card>
      </div>

      <section className="mb-4 sm:mb-6">
        <Card>
          <div className="flex items-center justify-between mb-3 px-2 sm:px-0">
            <h2 className="text-base sm:text-lg font-semibold">Campaign KPIs</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 px-2 sm:px-0 pb-2 sm:pb-0">
            {accountCategoryOrder.map((cat) => {
              const kpi = campaignKpiSummary.get(cat);
              const target = kpi?.target ?? 0;
              const actual = kpi?.actual ?? 0;
              const isAchieved = target > 0 && actual >= target;
              return (
                <div 
                  key={cat} 
                  className="rounded-lg border p-2 text-center" 
                  style={{ 
                    borderColor: isAchieved ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)', 
                    backgroundColor: isAchieved ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)' 
                  }}
                >
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{categoryLabels[cat]}</div>
                  <div className="text-xs sm:text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>{actual.toLocaleString()}/{target.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="mb-4 sm:mb-6">
        <Card>
          <div className="mb-3 sm:mb-4 px-2 sm:px-0">
            <h2 className="text-base sm:text-lg font-semibold">Engagement Analytics</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Visual breakdown of campaign engagement metrics
            </p>
          </div>
          <div className="px-2 sm:px-0 pb-2 sm:pb-0">
            <EngagementVisualizer engagement={engagement} posts={posts} />
          </div>
        </Card>
      </section>

      <section className="mb-4 sm:mb-6">
        <Card>
          <div className="flex items-center justify-between mb-3 px-2 sm:px-0">
            <h2 className="text-base sm:text-lg font-semibold">Accounts</h2>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{(campaign.accounts || []).length}</span>
          </div>
          <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-1 px-2 sm:px-0 pb-2 sm:pb-0">
            {(campaign.accounts || []).map((account: any) => (
              <div key={account.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 border border-dashed rounded-lg px-3 sm:px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex-1 min-w-0 sm:min-w-[150px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm sm:text-base truncate">{account.name}</div>
                    <span className="text-[10px] sm:text-[11px] uppercase tracking-wide whitespace-nowrap flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{account.accountType}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{account.tiktokHandle ?? '—'}</div>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-nowrap items-center sm:justify-end gap-2 text-[10px] uppercase tracking-wide sm:flex-1 sm:min-w-0" style={{ color: 'var(--text-tertiary)' }}>
                  {accountCategoryOrder.map((cat) => {
                    const entry = accountKpiMap.get(account.id)?.[cat];
                    const isAchieved = entry && entry.target > 0 && entry.actual >= entry.target;
                    return (
                      <div 
                        key={cat} 
                        className="flex min-w-[70px] sm:min-w-[80px] flex-col items-center rounded-lg border px-1.5 sm:px-2 py-1 text-center" 
                        style={{ 
                          borderColor: isAchieved ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)', 
                          backgroundColor: isAchieved ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)' 
                        }}
                      >
                        <div className="text-[8px] sm:text-[9px] whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{categoryLabels[cat]}</div>
                        <div className="text-xs sm:text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{entry ? `${entry.actual}/${entry.target}` : '0 / 0'}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-stretch sm:items-center gap-2 sm:whitespace-nowrap sm:flex-shrink-0">
                  <Button variant="outline" color="blue" className="text-xs px-2 sm:px-3 py-1.5 sm:py-1 flex-1 sm:flex-none" onClick={() => setEditingAccountKpi(account.id)}>
                    Edit KPIs
                  </Button>
                  <Button variant="ghost" color="red" className="text-xs px-2 sm:px-3 py-1.5 sm:py-1 flex-1 sm:flex-none" onClick={() => setRemoveAccountConfirm({ id: account.id, name: account.name })} disabled={accountRemoving[account.id]}>
                    {accountRemoving[account.id] ? 'Removing…' : 'Remove'}
                  </Button>
                </div>
              </div>
            ))}
            {(campaign.accounts || []).length === 0 && <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No linked accounts.</div>}
          </div>
        </Card>
      </section>

      <section className="mt-4 sm:mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold">Posts overview</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{postsTotal} posts · {totalViews.toLocaleString()} views · {totalLikes.toLocaleString()} likes</p>
          </div>
          <Link to={`/campaigns/${campaign.id}/posts`} className="text-xs sm:text-sm hover:underline transition-colors self-start sm:self-auto" style={{ color: '#6366f1' }}>
            View all posts
          </Link>
        </div>
        <Card>
          <div className="mb-4 px-2 sm:px-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
              <Select
                label="Account"
                value={postFilters.accountId}
                onChange={(e) => handleFilterChange('accountId', e.target.value)}
              >
                <option value="">All Accounts</option>
                {(campaign?.accounts || []).map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Status"
                value={postFilters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="On Going">On Going</option>
                <option value="Upload">Upload</option>
                <option value="Archive">Archive</option>
                <option value="Take Down">Take Down</option>
              </Select>
              <Select
                label="Content Type"
                value={postFilters.contentType}
                onChange={(e) => handleFilterChange('contentType', e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Slide">Slide</option>
                <option value="Video">Video</option>
              </Select>
              <Select
                label="Content Category"
                value={postFilters.contentCategory}
                onChange={(e) => handleFilterChange('contentCategory', e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="Hardsell product">Hardsell product</option>
                <option value="Trend/FOMO">Trend/FOMO</option>
                <option value="Berita/Event">Berita/Event</option>
                <option value="Topik Sensitive">Topik Sensitive</option>
                <option value="Sosok/Quotes/Film">Sosok/Quotes/Film</option>
                <option value="Storytell">Storytell</option>
                <option value="Edukasi Product">Edukasi Product</option>
              </Select>
              <Input
                label="Date From"
                type="date"
                value={postFilters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
              <Input
                label="Date To"
                type="date"
                value={postFilters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="text-xs sm:text-sm"
              >
                Reset Filters
              </Button>
            </div>
          </div>
          <div className="card-inner-table">
            {postsLoading ? (
              <div className="skeleton h-10 w-full" />
            ) : posts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-500 text-lg">No posts found</p>
                <p className="text-gray-400 text-sm mt-2">
                  {Object.values(postFilters).some(f => f !== '') 
                    ? 'Try adjusting your filters to see more results.'
                    : 'There are no posts available for this campaign.'}
                </p>
              </div>
            ) : (
              <>
              <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>NO</TH>
                        <TH>Account</TH>
                        <TH>Post Date</TH>
                        <TH>Title</TH>
                        <TH>Type</TH>
                        <TH>Content Category</TH>
                        <TH>Campaign Category</TH>
                        <TH>PIC Talent</TH>
                        <TH>PIC Editor</TH>
                        <TH>PIC Posting</TH>
                        <TH>Content Link</TH>
                        <TH>Ads on Music</TH>
                        <TH>Yellow Cart</TH>
                        <TH>Status</TH>
                        <TH>Views</TH>
                        <TH>Likes</TH>
                        <TH>Comments</TH>
                        <TH>Shares</TH>
                        <TH>Saved</TH>
                        <TH>Engagement</TH>
                        <TH>Actions</TH>
                      </TR>
                    </THead>
                    <tbody>
                      {posts.map((p: any, index) => {
                        const isEditing = editingCell?.postId === p.id;
                        const isSaving = savingCell?.startsWith(`${p.id}-`);
                        const postCampaignCategoryOptions = Array.isArray(campaign?.categories) 
                          ? campaign.categories.filter((cat: string) => cat).sort() 
                          : [];
                        
                        return (
                          <TR key={p.id}>
                            <TD>{postPagination.offset + index + 1}</TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'accountId', p.accountId)}
                              >
                                {isEditing && editingCell?.field === 'accountId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'accountId')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'accountId')}
                                    autoFocus
                                  >
                                    {accounts.map((account) => (
                                      <option key={account.id} value={account.id}>{account.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-accountId') ? 'opacity-50' : ''}>
                                    {p.account?.name || '—'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'postDate', p.postDate)}
                              >
                                {isEditing && editingCell?.field === 'postDate' ? (
                                  <input
                                    type="date"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'postDate')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'postDate')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-postDate') ? 'opacity-50' : ''}>
                                    {new Date(p.postDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'postTitle', p.postTitle)}
                              >
                                {isEditing && editingCell?.field === 'postTitle' ? (
                                  <input
                                    type="text"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'postTitle')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'postTitle')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-postTitle') ? 'opacity-50' : ''}>
                                    {p.postTitle}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'contentType', p.contentType)}
                              >
                                {isEditing && editingCell?.field === 'contentType' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'contentType')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'contentType')}
                                    autoFocus
                                  >
                                    {CONTENT_TYPE_OPTIONS.map((type) => (
                                      <option key={type} value={type}>{type}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-contentType') ? 'opacity-50' : ''}>
                                    {p.contentType}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'contentCategory', p.contentCategory)}
                              >
                                {isEditing && editingCell?.field === 'contentCategory' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'contentCategory')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'contentCategory')}
                                    autoFocus
                                  >
                                    {CONTENT_CATEGORY_OPTIONS.map((cat) => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-contentCategory') ? 'opacity-50' : ''}>
                                    {p.contentCategory || '—'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'campaignCategory', p.campaignCategory || '')}
                              >
                                {isEditing && editingCell?.field === 'campaignCategory' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'campaignCategory')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'campaignCategory')}
                                    autoFocus
                                  >
                                    {postCampaignCategoryOptions.map((cat: string) => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-campaignCategory') ? 'opacity-50' : ''}>
                                    {p.campaignCategory || '—'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'picTalentId', p.picTalentId || '')}
                              >
                                {isEditing && editingCell?.field === 'picTalentId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'picTalentId')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'picTalentId')}
                                    autoFocus
                                  >
                                    {talentPics.map((pic: any) => (
                                      <option key={pic.id} value={pic.id}>{pic.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-picTalentId') ? 'opacity-50' : ''}>
                                    {p.picTalent?.name || '—'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'picEditorId', p.picEditorId || '')}
                              >
                                {isEditing && editingCell?.field === 'picEditorId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'picEditorId')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'picEditorId')}
                                    autoFocus
                                  >
                                    {editorPics.map((pic: any) => (
                                      <option key={pic.id} value={pic.id}>{pic.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-picEditorId') ? 'opacity-50' : ''}>
                                    {p.picEditor?.name || '—'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'picPostingId', p.picPostingId || '')}
                              >
                                {isEditing && editingCell?.field === 'picPostingId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'picPostingId')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'picPostingId')}
                                    autoFocus
                                  >
                                    {postingPics.map((pic: any) => (
                                      <option key={pic.id} value={pic.id}>{pic.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-picPostingId') ? 'opacity-50' : ''}>
                                    {p.picPosting?.name || '—'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'contentLink', p.contentLink || '')}
                              >
                                {isEditing && editingCell?.field === 'contentLink' ? (
                                  <input
                                    type="text"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'contentLink')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'contentLink')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-contentLink') ? 'opacity-50' : ''}>
                                    {p.contentLink ? (
                                      <a href={p.contentLink} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 dark:text-blue-400 transition-colors" style={{ color: '#6366f1' }}>
                                        Link
                                      </a>
                                    ) : '—'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'adsOnMusic', p.adsOnMusic)}
                              >
                                {isEditing && editingCell?.field === 'adsOnMusic' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'adsOnMusic')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'adsOnMusic')}
                                    autoFocus
                                  >
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-adsOnMusic') ? 'opacity-50' : ''}>
                                    {p.adsOnMusic ? 'Yes' : 'No'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'yellowCart', p.yellowCart)}
                              >
                                {isEditing && editingCell?.field === 'yellowCart' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'yellowCart')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'yellowCart')}
                                    autoFocus
                                  >
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-yellowCart') ? 'opacity-50' : ''}>
                                    {p.yellowCart ? 'Yes' : 'No'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'status', p.status)}
                              >
                                {isEditing && editingCell?.field === 'status' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'status')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'status')}
                                    autoFocus
                                  >
                                    {STATUS_OPTIONS.map((status) => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={`badge ${isSaving && savingCell?.endsWith('-status') ? 'opacity-50' : ''}`}>
                                    {p.status}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'totalView', p.totalView)}
                              >
                                {isEditing && editingCell?.field === 'totalView' ? (
                                  <input
                                    type="number"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(sanitizeNumberInput(e.target.value))}
                                    onBlur={() => handleCellBlur(p.id, 'totalView')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'totalView')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-totalView') ? 'opacity-50' : ''}>
                                    {p.totalView}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'totalLike', p.totalLike)}
                              >
                                {isEditing && editingCell?.field === 'totalLike' ? (
                                  <input
                                    type="number"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(sanitizeNumberInput(e.target.value))}
                                    onBlur={() => handleCellBlur(p.id, 'totalLike')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'totalLike')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-totalLike') ? 'opacity-50' : ''}>
                                    {p.totalLike}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'totalComment', p.totalComment)}
                              >
                                {isEditing && editingCell?.field === 'totalComment' ? (
                                  <input
                                    type="number"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(sanitizeNumberInput(e.target.value))}
                                    onBlur={() => handleCellBlur(p.id, 'totalComment')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'totalComment')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-totalComment') ? 'opacity-50' : ''}>
                                    {p.totalComment}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'totalShare', p.totalShare)}
                              >
                                {isEditing && editingCell?.field === 'totalShare' ? (
                                  <input
                                    type="number"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(sanitizeNumberInput(e.target.value))}
                                    onBlur={() => handleCellBlur(p.id, 'totalShare')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'totalShare')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-totalShare') ? 'opacity-50' : ''}>
                                    {p.totalShare}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'totalSaved', p.totalSaved)}
                              >
                                {isEditing && editingCell?.field === 'totalSaved' ? (
                                  <input
                                    type="number"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(sanitizeNumberInput(e.target.value))}
                                    onBlur={() => handleCellBlur(p.id, 'totalSaved')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'totalSaved')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-totalSaved') ? 'opacity-50' : ''}>
                                    {p.totalSaved}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>{((p.engagementRate ?? 0) * 100).toFixed(2)}%</TD>
                            <TD>
                              <div className="flex gap-1.5 justify-center">
                                <RequirePermission permission={canDeletePost}>
                                  <Button
                                    onClick={() => handleDeletePostClick(p)}
                                    variant="ghost"
                                    color="red"
                                    className="text-xs px-2 py-1"
                                    type="button"
                                  >
                                    Delete
                                  </Button>
                                </RequirePermission>
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
                {Math.ceil(postsTotal / postPagination.limit) > 1 && (
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-2 sm:px-0 pb-2 sm:pb-0">
                    <div className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Showing {postPagination.offset + 1} - {Math.min(postPagination.offset + postPagination.limit, postsTotal)} of {postsTotal}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setPostPagination((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                        disabled={postPagination.offset === 0 || postsLoading}
                        className="text-xs sm:text-sm"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setPostPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }))}
                        disabled={postPagination.offset + postPagination.limit >= postsTotal || postsLoading}
                        className="text-xs sm:text-sm"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </section>

      {/* Edit Post Dialog removed - using inline editing */}

      <Dialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Delete Campaign"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="primary" color="red" onClick={handleDeleteCampaign} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete <strong>"{campaign?.name}"</strong>?
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          This action cannot be undone. All associated posts, KPIs, and account links will also be deleted.
        </p>
      </Dialog>

      <Dialog
        open={!!deletePostConfirm}
        onClose={() => setDeletePostConfirm(null)}
        title="Delete Post"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeletePostConfirm(null)}
              disabled={deletingPost}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              color="red"
              onClick={handleDeletePostConfirm}
              disabled={deletingPost}
            >
              {deletingPost ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete <strong>"{deletePostConfirm?.title}"</strong>?
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          This action cannot be undone. KPIs will be recalculated automatically after deletion.
        </p>
      </Dialog>

      <Dialog
        open={!!removeAccountConfirm}
        onClose={() => setRemoveAccountConfirm(null)}
        title="Remove Account"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setRemoveAccountConfirm(null)}
              disabled={removeAccountConfirm ? accountRemoving[removeAccountConfirm.id] : false}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              color="red"
              onClick={handleAccountRemove}
              disabled={removeAccountConfirm ? accountRemoving[removeAccountConfirm.id] : false}
            >
              {removeAccountConfirm && accountRemoving[removeAccountConfirm.id] ? 'Removing...' : 'Remove'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to remove <strong>"{removeAccountConfirm?.name}"</strong> from this campaign?
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          This action cannot be undone. KPIs will be recalculated automatically after removal.
        </p>
      </Dialog>
      {id && editingAccountKpi && (
        <AccountKpiEditModal
          open={!!editingAccountKpi}
          onClose={() => setEditingAccountKpi(null)}
          campaignId={id}
          accountId={editingAccountKpi}
          onSuccess={handleRefreshCampaign}
        />
      )}
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
