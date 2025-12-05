import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../lib/api';
import { scrapeTikTokUrlsBatchWithOriginals, isTikTokUrl } from '../lib/tiktokScraper';
import { formatDate } from '../lib/dateUtils';
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
import Papa from 'papaparse';

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

type EngagementUpdateError = {
  row: number;
  postId: string;
  postTitle: string;
  contentLink: string;
  reason: string;
};

type EngagementUpdateResult = {
  updatedCount: number;
  totalCount: number;
  errors: EngagementUpdateError[];
  type: 'success' | 'error' | 'partial';
};

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
  const { canManageCampaigns, canDelete, canDeletePost } = usePermissions();
  const [campaign, setCampaign] = useState<any>(null);
  const [engagement, setEngagement] = useState<any>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]); // All posts fetched from server
  const [categoryOverview, setCategoryOverview] = useState<{ category: string; posts: number; views: number }[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [accountRemoving, setAccountRemoving] = useState<Record<string, boolean>>({});
  const [editingCell, setEditingCell] = useState<{ postId: string; field: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const selectChangeInProgressRef = useRef<string | null>(null);
  const initialCellValueRef = useRef<string>('');
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
  const [updatingEngagement, setUpdatingEngagement] = useState(false);
  const [engagementUpdateProgress, setEngagementUpdateProgress] = useState<{ current: number; total: number } | null>(null);
  const [engagementUpdateResult, setEngagementUpdateResult] = useState<EngagementUpdateResult | null>(null);
  const [retryingUpdateRows, setRetryingUpdateRows] = useState<Record<string, boolean>>({});

  type SortKey =
    | 'postDate'
    | 'account'
    | 'postTitle'
    | 'totalView'
    | 'totalLike'
    | 'totalComment'
    | 'totalShare'
    | 'totalSaved'
    | 'contentType'
    | 'contentCategory'
    | 'campaignCategory'
    | 'status'
    | 'picTalent'
    | 'picEditor'
    | 'picPosting'
    | 'adsOnMusic'
    | 'yellowCart'
    | 'engagementRate';

  type SortConfig = {
    key: SortKey;
    direction: 'asc' | 'desc';
  };

  const DESC_SORT_KEYS: SortKey[] = ['postDate', 'totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved', 'engagementRate', 'adsOnMusic', 'yellowCart'];
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'postDate', direction: 'desc' });

  const refreshDashboardMetrics = useCallback(async () => {
    if (!id) return;
    const [kpisResult, engagementResult, categoriesResult] = await Promise.allSettled([
      api(`/campaigns/${id}/kpis`, { token }),
      api(`/campaigns/${id}/dashboard/engagement`, { token }),
      api(`/campaigns/${id}/dashboard/categories`, { token }),
    ]);

    if (kpisResult.status === 'fulfilled') {
      setKpis(kpisResult.value);
    } else {
      console.error('Failed to refresh KPIs:', kpisResult.reason);
    }

    if (engagementResult.status === 'fulfilled') {
      setEngagement(engagementResult.value);
    } else {
      console.error('Failed to refresh engagement:', engagementResult.reason);
    }

    if (categoriesResult.status === 'fulfilled') {
      setCategoryOverview(Array.isArray(categoriesResult.value) ? categoriesResult.value : []);
    } else {
      console.error('Failed to refresh category overview:', categoriesResult.reason);
      setCategoryOverview([]);
    }
  }, [id, token]);

  useEffect(() => {
    if (!id) return;
    api(`/campaigns/${id}`, { token }).then(setCampaign);
    void refreshDashboardMetrics();
    api('/pics?active=true', { token }).then(setPics).catch(() => {});
    api('/accounts', { token }).then(setAccounts).catch(() => {});
  }, [id, token, refreshDashboardMetrics]);

  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setPostsLoading(true);
    try {
      // Fetch all posts without filters or pagination for client-side filtering
      const response = await api(`/campaigns/${id}/posts`, { token });
      if (response.posts) {
        setAllPosts(response.posts);
      } else {
        // Fallback for old API format
        setAllPosts(Array.isArray(response) ? response : []);
      }
    } catch (error: any) {
      console.error('Failed to fetch posts:', error);
      setAllPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [id, token]);

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

  // Client-side filtering
  const filteredPosts = useMemo(() => {
    return allPosts.filter((post: any) => {
      // Account filter
      if (postFilters.accountId && post.accountId !== postFilters.accountId) {
        return false;
      }

      // Status filter
      if (postFilters.status && post.status !== postFilters.status) {
        return false;
      }

      // Content type filter
      if (postFilters.contentType && post.contentType !== postFilters.contentType) {
        return false;
      }

      // Content category filter
      if (postFilters.contentCategory && post.contentCategory !== postFilters.contentCategory) {
        return false;
      }

      // Date range filters
      if (postFilters.dateFrom || postFilters.dateTo) {
        const postDate = post.postDate ? new Date(post.postDate) : null;
        if (!postDate) return false;

        if (postFilters.dateFrom) {
          const fromDate = new Date(postFilters.dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (postDate < fromDate) return false;
        }

        if (postFilters.dateTo) {
          const toDate = new Date(postFilters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (postDate > toDate) return false;
        }
      }

      return true;
    });
  }, [allPosts, postFilters]);

  // Client-side pagination
  const paginatedPosts = useMemo(() => {
    const start = postPagination.offset;
    const end = start + postPagination.limit;
    return filteredPosts.slice(start, end);
  }, [filteredPosts, postPagination]);

  const postsTotal = filteredPosts.length;

  const accountNameMap = useMemo(() => new Map(accounts.map((account: any) => [account.id, account.name || ''])), [accounts]);
  const picNameMap = useMemo(() => new Map(pics.map((pic: any) => [pic.id, pic.name || ''])), [pics]);

  const getAccountName = useCallback((post: any) => {
    if (post.account?.name) return post.account.name;
    if (post.accountId) {
      return accountNameMap.get(post.accountId) || '';
    }
    return '';
  }, [accountNameMap]);

  const getPicName = useCallback((id?: string, pic?: { id: string; name: string } | null) => {
    if (pic?.name) return pic.name;
    if (id) {
      return picNameMap.get(id) || '';
    }
    return '';
  }, [picNameMap]);

  const sortedPosts = useMemo(() => {
    const toTimestamp = (value?: string) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? time : 0;
    };

    const normalize = (value: string) => value.toLowerCase();

    const getSortValue = (post: any, key: SortKey): string | number => {
      switch (key) {
        case 'postDate':
          return toTimestamp(post.postDate);
        case 'account':
          return normalize(getAccountName(post));
        case 'postTitle':
          return normalize(post.postTitle || '');
        case 'totalView':
          return post.totalView ?? 0;
        case 'totalLike':
          return post.totalLike ?? 0;
        case 'totalComment':
          return post.totalComment ?? 0;
        case 'totalShare':
          return post.totalShare ?? 0;
        case 'totalSaved':
          return post.totalSaved ?? 0;
        case 'contentType':
          return normalize(post.contentType || '');
        case 'contentCategory':
          return normalize(post.contentCategory || '');
        case 'campaignCategory':
          return normalize(post.campaignCategory || '');
        case 'status':
          return normalize(post.status || '');
        case 'picTalent':
          return normalize(getPicName(post.picTalentId, post.picTalent));
        case 'picEditor':
          return normalize(getPicName(post.picEditorId, post.picEditor));
        case 'picPosting':
          return normalize(getPicName(post.picPostingId, post.picPosting));
        case 'adsOnMusic':
          return post.adsOnMusic ? 1 : 0;
        case 'yellowCart':
          return post.yellowCart ? 1 : 0;
        case 'engagementRate':
          return post.engagementRate ?? 0;
        default:
          return '';
      }
    };

    const compareValues = (a: string | number, b: string | number) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
      }
      return a.toString().localeCompare(b.toString(), undefined, { sensitivity: 'base', numeric: true });
    };

    const nextPosts = [...paginatedPosts];
    nextPosts.sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);
      const comparison = compareValues(aValue, bValue);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
    return nextPosts;
  }, [paginatedPosts, sortConfig, getAccountName, getPicName]);

  const handleSortToggle = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDirection = DESC_SORT_KEYS.includes(key) ? 'desc' : 'asc';
      return { key, direction: defaultDirection };
    });
  };

  const handleExportCampaign = useCallback(() => {
    if (!campaign || allPosts.length === 0) {
      setToast({ message: 'No posts to export', type: 'error' });
      return;
    }

    // Sort posts by postDate descending (most recent first) for export
    const sortedPostsForExport = [...allPosts].sort((a: any, b: any) => {
      const dateA = a.postDate ? new Date(a.postDate).getTime() : 0;
      const dateB = b.postDate ? new Date(b.postDate).getTime() : 0;
      return dateB - dateA;
    });

    // Create CSV rows matching the image format
    const csvRows = sortedPostsForExport.map((post: any, index: number) => {
      const accountName = getAccountName(post);
      const postDateFormatted = post.postDate ? formatDate(post.postDate) : '';
      
      return {
        NO: (index + 1).toString(),
        'TANGGAL POSTING': postDateFormatted,
        'NAMA AKUN': accountName || '',
        JUDUL: post.postTitle || '',
        JENIS: post.contentType || '',
        'LINK KONTEN': post.contentLink || '',
        STATUS: post.status || '',
        VIEWS: (post.totalView || 0).toString(),
        LIKE: (post.totalLike || 0).toString(),
        COMMENT: (post.totalComment || 0).toString(),
        SHARE: (post.totalShare || 0).toString(),
        SAVED: (post.totalSaved || 0).toString(),
        CATEGORY: post.campaignCategory || '',
      };
    });

    // Define column order matching the image
    const csvColumns = [
      'NO',
      'TANGGAL POSTING',
      'NAMA AKUN',
      'JUDUL',
      'JENIS',
      'LINK KONTEN',
      'STATUS',
      'VIEWS',
      'LIKE',
      'COMMENT',
      'SHARE',
      'SAVED',
      'CATEGORY',
    ];

    // Generate CSV string
    const csvString = Papa.unparse(csvRows, {
      columns: csvColumns,
      header: true,
    });

    // Create blob and download
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${campaign.name || 'campaign'}-posts-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast({ message: 'Campaign exported successfully', type: 'success' });
  }, [campaign, allPosts, getAccountName]);

  const renderSortableHeader = (label: string, key: SortKey, className?: string) => {
    const isActive = sortConfig.key === key;
    const indicator = isActive 
      ? (sortConfig.direction === 'asc' ? '▲' : '▼')
      : '↕';

    return (
      <TH className={className}>
        <button
          type="button"
          onClick={() => handleSortToggle(key)}
          className="flex items-center gap-1 w-full text-left select-none hover:text-emerald-600 transition-colors"
        >
          <span className="truncate">{label}</span>
          <span className={`text-xs ${isActive ? 'text-emerald-600' : 'opacity-40'}`}>
            {indicator}
          </span>
        </button>
      </TH>
    );
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
    initialCellValueRef.current = valueToEdit;
  };

  const handleFypTypeToggle = async (postId: string, clickedType: 'ORG' | 'ADS', currentType: string | null | undefined) => {
    // If clicking the already checked type, uncheck it. Otherwise, check the clicked type.
    const newType = currentType === clickedType ? null : clickedType;
    setSavingCell(`${postId}-fypType`);
    try {
      const updatedPost = await api(`/posts/${postId}`, {
        method: 'PUT',
        token,
        body: { fypType: newType },
      });

      // Update the post in the list
      setAllPosts((prevPosts: any[]) => prevPosts.map((p: any) => {
        if (p.id === postId) {
          return { ...updatedPost, account: p.account, picTalent: p.picTalent, picEditor: p.picEditor, picPosting: p.picPosting };
        }
        return p;
      }));

      // Refresh KPIs and engagement
      await refreshDashboardMetrics();

      setToast({ message: 'FYP type updated successfully', type: 'success' });
    } catch (error) {
      console.error('Failed to update FYP type:', error);
      setToast({ message: 'Failed to update FYP type', type: 'error' });
    } finally {
      setSavingCell('');
    }
  };

  const handleCellBlur = async (postId: string, field: string, skipClose?: boolean, overrideValue?: string): Promise<any | null> => {
    if (!editingCell || editingCell.postId !== postId || editingCell.field !== field) return null;
    
    const post = allPosts.find((p: any) => p.id === postId);
    if (!post) return null;

    // Use override value if provided (for immediate saves from onChange), otherwise use state
    const valueToUse = overrideValue !== undefined ? overrideValue : cellEditValue;

    // Check if value actually changed
    let hasChanged = false;
    let newValue: any = valueToUse;

    if (field === 'postDate') {
      const currentDate = post.postDate ? new Date(post.postDate).toISOString().split('T')[0] : '';
      hasChanged = valueToUse !== currentDate;
      if (!hasChanged) {
        if (!skipClose) setEditingCell(null);
        return null;
      }
    } else if (field === 'accountId') {
      hasChanged = valueToUse !== post.accountId;
    } else if (field === 'postTitle' || field === 'contentLink') {
      hasChanged = valueToUse !== (post[field] || '');
    } else if (field === 'contentType' || field === 'contentCategory' || field === 'status' || field === 'campaignCategory') {
      hasChanged = valueToUse !== (post[field] || '');
    } else if (field === 'picTalentId' || field === 'picEditorId' || field === 'picPostingId') {
      const currentId = post[field] || '';
      hasChanged = valueToUse !== currentId;
    } else if (field === 'adsOnMusic' || field === 'yellowCart') {
      const currentBool = post[field] ? 'true' : 'false';
      hasChanged = valueToUse !== currentBool;
      newValue = valueToUse === 'true';
    } else if (field === 'fypType') {
      const currentType = post.fypType || '';
      hasChanged = valueToUse !== currentType;
      newValue = valueToUse === 'ORG' || valueToUse === 'ADS' ? valueToUse : null;
    } else if (['totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved'].includes(field)) {
      const currentNum = post[field] || 0;
      const newNum = parseInt(valueToUse || '0', 10) || 0;
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
        updatePayload.postDate = new Date(valueToUse).toISOString();
      } else if (field === 'accountId') {
        updatePayload.accountId = valueToUse || undefined;
      } else if (field === 'postTitle') {
        updatePayload.postTitle = valueToUse;
      } else if (field === 'contentLink') {
        updatePayload.contentLink = valueToUse;
      } else if (field === 'contentType') {
        updatePayload.contentType = valueToUse;
      } else if (field === 'contentCategory') {
        updatePayload.contentCategory = valueToUse;
      } else if (field === 'campaignCategory') {
        updatePayload.campaignCategory = valueToUse;
      } else if (field === 'status') {
        updatePayload.status = valueToUse;
      } else if (field === 'picTalentId') {
        updatePayload.picTalentId = valueToUse || undefined;
      } else if (field === 'picEditorId') {
        updatePayload.picEditorId = valueToUse || undefined;
      } else if (field === 'picPostingId') {
        updatePayload.picPostingId = valueToUse || undefined;
      } else if (field === 'adsOnMusic') {
        updatePayload.adsOnMusic = newValue;
      } else if (field === 'yellowCart') {
        updatePayload.yellowCart = newValue;
      } else if (field === 'fypType') {
        updatePayload.fypType = newValue;
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
      setAllPosts((prevPosts: any[]) => prevPosts.map((p: any) => {
        if (p.id === postId) {
          return updatedPostWithRelations;
        }
        return p;
      }));

      // Refresh KPIs and engagement
      await refreshDashboardMetrics();

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
      if (currentPostIndex < paginatedPosts.length - 1) {
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
      const currentPostIndex = paginatedPosts.findIndex((p: any) => p.id === postId);
      
      if (currentPostIndex === -1) {
        setEditingCell(null);
        return;
      }
      
      // Optimistically update the current post with the edited value for navigation
      const post = paginatedPosts.find((p: any) => p.id === postId);
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
      
      const optimisticPosts = paginatedPosts.map((p: any) => p.id === postId ? optimisticPost : p);
      
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
      await refreshDashboardMetrics();
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
      await refreshDashboardMetrics();
      
      setToast({ message: 'Post deleted successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to delete post', type: 'error' });
    } finally {
      setDeletingPost(false);
      setDeletePostConfirm(null);
    }
  };

  const handleUpdateEngagementStats = async () => {
    if (!id) return;
    
    setUpdatingEngagement(true);
    setEngagementUpdateProgress(null);
    setEngagementUpdateResult(null);
    
    try {
      // Fetch all posts for the campaign (not just filtered ones) - use endpoint without pagination
      const allPosts = await api(`/posts/campaign/${id}`, { token });
      
      // Filter posts with TikTok URLs
      const postsWithTikTokUrls = (Array.isArray(allPosts) ? allPosts : []).filter((post: any) => 
        post.contentLink && isTikTokUrl(post.contentLink)
      );
      
      if (postsWithTikTokUrls.length === 0) {
        setToast({ 
          message: 'No posts with TikTok URLs found in this campaign', 
          type: 'info' 
        });
        setUpdatingEngagement(false);
        return;
      }
      
      setEngagementUpdateProgress({ current: 0, total: postsWithTikTokUrls.length });
      
      // Extract URLs - keep track of which post corresponds to which URL
      const urlToPostMap = new Map<string, any>();
      const urls = postsWithTikTokUrls.map((post: any) => {
        urlToPostMap.set(post.contentLink, post);
        return post.contentLink;
      });
      
      // Scrape engagement data with original URL tracking
      const scrapeResult = await scrapeTikTokUrlsBatchWithOriginals(urls, 1000);
      
      // Create a map of original URL to engagement data
      const engagementMap = new Map<string, any>();
      scrapeResult.results.forEach((result) => {
        // Map by original URL (which matches post.contentLink)
        engagementMap.set(result.originalUrl, result.data);
        // Also map by resolved URL in case we need it
        if (result.resolvedUrl !== result.originalUrl) {
          engagementMap.set(result.resolvedUrl, result.data);
        }
      });
      
      // Map errors by URL for debugging
      const errorMap = new Map<string, string>();
      scrapeResult.errors.forEach((error) => {
        errorMap.set(error.url, error.error);
      });
      
      // Update each post
      let updatedCount = 0;
      let failedCount = 0;
      const updateErrors: EngagementUpdateError[] = [];
      
      for (let i = 0; i < postsWithTikTokUrls.length; i++) {
        const post = postsWithTikTokUrls[i];
        const engagementData = engagementMap.get(post.contentLink);
        
        setEngagementUpdateProgress({ current: i + 1, total: postsWithTikTokUrls.length });
        
        if (engagementData) {
          try {
            await api(`/posts/${post.id}`, {
              method: 'PUT',
              token,
              body: {
                totalView: engagementData.views,
                totalLike: engagementData.likes,
                totalComment: engagementData.comments,
                totalShare: engagementData.shares,
                totalSaved: engagementData.bookmarks,
              },
            });
            updatedCount++;
          } catch (error: any) {
            console.error(`Failed to update post ${post.id}:`, error);
            failedCount++;
            updateErrors.push({
              row: i + 1,
              postId: post.id,
              postTitle: post.postTitle,
              contentLink: post.contentLink || '',
              reason: error?.message || error?.error || 'Failed to update post',
            });
          }
        } else {
          // Check if there's an error for this URL
          const errorMsg = errorMap.get(post.contentLink);
          if (errorMsg) {
            console.warn(`Failed to scrape ${post.contentLink}: ${errorMsg}`);
          }
          failedCount++;
          updateErrors.push({
            row: i + 1,
            postId: post.id,
            postTitle: post.postTitle,
            contentLink: post.contentLink || '',
            reason: errorMsg || 'No engagement data returned from scraper',
          });
        }
      }
      
      const updateType: EngagementUpdateResult['type'] = failedCount === 0 ? 'success' : updatedCount === 0 ? 'error' : 'partial';
      setEngagementUpdateResult({
        updatedCount,
        totalCount: postsWithTikTokUrls.length,
        errors: updateErrors,
        type: updateType,
      });

      // Refresh posts, KPIs, and engagement (best-effort)
      try {
        await fetchPosts();
        await refreshDashboardMetrics();
      } catch (refreshError) {
        console.error('Failed to refresh campaign data after updating engagement:', refreshError);
      }
      
      // Show success message with details
      const successMessage = `Updated ${updatedCount} post${updatedCount !== 1 ? 's' : ''}`;
      const errorMessage = failedCount > 0 ? ` (${failedCount} failed)` : '';
      setToast({ 
        message: `${successMessage}${errorMessage}`, 
        type: failedCount > 0 ? 'info' : 'success' 
      });
      
      // Only log errors if there are actual failures that couldn't be retried
      // (Errors that were retried successfully are not logged)
      if (failedCount > 0 && scrapeResult.errors.length > 0) {
        const failedUrls = scrapeResult.errors
          .filter(e => !engagementMap.has(e.url))
          .map(e => e.url);
        if (failedUrls.length > 0) {
          console.warn('Failed to scrape URLs after retries:', failedUrls.join(', '));
        }
      }
    } catch (error: any) {
      console.error('Failed to update engagement stats:', error);
      setEngagementUpdateResult((prev) => prev ?? {
        updatedCount: 0,
        totalCount: 0,
        errors: [{
          row: 0,
          postId: '',
          postTitle: '',
          contentLink: '',
          reason: error?.message || 'Failed to update engagement stats. Please try again.',
        }],
        type: 'error',
      });
      setToast({ 
        message: error?.message || 'Failed to update engagement stats. Please try again.', 
        type: 'error' 
      });
    } finally {
      setUpdatingEngagement(false);
      setEngagementUpdateProgress(null);
    }
  };

  const handleRetryUpdateRow = async (errorEntry: EngagementUpdateError) => {
    if (!errorEntry.contentLink) {
      setToast({ message: 'Content link is missing for this post.', type: 'error' });
      return;
    }

    setRetryingUpdateRows((prev) => ({ ...prev, [errorEntry.postId]: true }));

    try {
      const scrapeResult = await scrapeTikTokUrlsBatchWithOriginals([errorEntry.contentLink], 1000);
      const matchedResult = scrapeResult.results.find(
        (result) =>
          result.originalUrl === errorEntry.contentLink || result.resolvedUrl === errorEntry.contentLink
      );

      const engagementData = matchedResult?.data;

      if (!engagementData) {
        const scrapeError = scrapeResult.errors.find((err) => err.url === errorEntry.contentLink);
        const reason = scrapeError?.error || 'No engagement data returned from scraper';
        setEngagementUpdateResult((prev) =>
          prev
            ? {
                ...prev,
                errors: prev.errors.map((err) =>
                  err.postId === errorEntry.postId ? { ...err, reason } : err
                ),
              }
            : prev
        );
        setToast({ message: reason, type: 'error' });
        return;
      }

      await api(`/posts/${errorEntry.postId}`, {
        method: 'PUT',
        token,
        body: {
          totalView: engagementData.views,
          totalLike: engagementData.likes,
          totalComment: engagementData.comments,
          totalShare: engagementData.shares,
          totalSaved: engagementData.bookmarks,
        },
      });

      setEngagementUpdateResult((prev) => {
        if (!prev) return prev;
        const updatedErrors = prev.errors.filter((err) => err.postId !== errorEntry.postId);
        const updatedCount = Math.min(prev.updatedCount + 1, prev.totalCount);
        const nextType: EngagementUpdateResult['type'] =
          updatedErrors.length === 0 ? 'success' : updatedCount === 0 ? 'error' : 'partial';

        return {
          ...prev,
          updatedCount,
          errors: updatedErrors,
          type: nextType,
        };
      });

      try {
        await fetchPosts();
        await refreshDashboardMetrics();
      } catch (refreshError) {
        console.error('Failed to refresh posts after retrying update:', refreshError);
      }

      setToast({ message: `Row ${errorEntry.row} updated successfully.`, type: 'success' });
    } catch (error: any) {
      const message = error?.message || error?.error || 'Retry failed';
      setEngagementUpdateResult((prev) =>
        prev
          ? {
              ...prev,
              errors: prev.errors.map((err) =>
                err.postId === errorEntry.postId ? { ...err, reason: message } : err
              ),
            }
          : prev
      );
      setToast({ message, type: 'error' });
    } finally {
      setRetryingUpdateRows((prev) => {
        const next = { ...prev };
        delete next[errorEntry.postId];
        return next;
      });
    }
  };

  const handleCloseEngagementResult = () => {
    setEngagementUpdateResult(null);
    setRetryingUpdateRows({});
  };

  const totalViews = useMemo(() => allPosts.reduce((acc, p) => acc + (p.totalView ?? 0), 0), [allPosts]);
  const totalLikes = useMemo(() => allPosts.reduce((acc, p) => acc + (p.totalLike ?? 0), 0), [allPosts]);
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
        const postCount = allPosts.filter((p: any) => p.accountId === k.accountId).length;
        map.get(k.accountId)![k.category] = { target: k.target ?? 0, actual: postCount };
      } else {
        map.get(k.accountId)![k.category] = { target: k.target ?? 0, actual: k.actual ?? 0 };
      }
    });
    return map;
  }, [kpis, allPosts]);

  const categoryOverviewRows = useMemo(() => {
    const totals = new Map<string, { posts: number; views: number }>();
    const campaignCategories = (Array.isArray(campaign?.categories)
      ? campaign.categories.filter(Boolean)
      : []) as string[];

    campaignCategories.forEach((cat: string) => totals.set(cat, { posts: 0, views: 0 }));

    categoryOverview.forEach((entry) => {
      const current = totals.get(entry.category) ?? { posts: 0, views: 0 };
      totals.set(entry.category, {
        posts: current.posts + (entry.posts ?? 0),
        views: current.views + (entry.views ?? 0),
      });
    });

    const extraCategories = Array.from(totals.keys()).filter((cat) => !campaignCategories.includes(cat) && cat !== 'Uncategorized').sort((a, b) => a.localeCompare(b));
    const ordered = [...campaignCategories, ...extraCategories];
    if (totals.has('Uncategorized')) ordered.push('Uncategorized');

    return ordered.map((cat) => ({
      category: cat,
      posts: totals.get(cat)?.posts ?? 0,
      views: totals.get(cat)?.views ?? 0,
    }));
  }, [campaign?.categories, categoryOverview]);

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

  const isEngagementUpdating = updatingEngagement;
  const engagementProcessingTitle = 'Updating post table';
  const engagementProcessingDescription =
    'Refreshing engagement stats for the posts table. Please keep this tab open and avoid refreshing until the update completes.';
  const engagementProcessingProgress = engagementUpdateProgress
    ? `Processed ${engagementUpdateProgress.current}/${engagementUpdateProgress.total} posts.`
    : null;

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
            <span
              className="badge border text-xs sm:text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-secondary)'
              }}
            >
              Quotation: {campaign.quotationNumber || '—'}
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
            <RequirePermission permission={canManageCampaigns}>
              <Button
                variant="outline"
                color="blue"
                onClick={handleExportCampaign}
                className="text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-none"
              >
                Export Campaign
              </Button>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 px-2 sm:px-0">
              <h2 className="text-base sm:text-lg font-semibold leading-none m-0">Campaign KPIs</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-2 sm:px-0 pb-2 sm:pb-0">
              {accountCategoryOrder.map((cat) => {
                const kpi = campaignKpiSummary.get(cat);
                const target = kpi?.target ?? 0;
                const actual = kpi?.actual ?? 0;
                const isAchieved = target > 0 && actual >= target;
                return (
                  <div 
                    key={cat} 
                    className="rounded-lg border p-3 sm:p-3.5 text-center min-h-[88px] flex flex-col items-center justify-center gap-1" 
                    style={{ 
                      borderColor: isAchieved ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)', 
                      backgroundColor: isAchieved ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)' 
                    }}
                  >
                    <div className="text-[10px] sm:text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{categoryLabels[cat]}</div>
                    <div className="text-sm sm:text-base font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>{actual.toLocaleString()}/{target.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-3 px-2 sm:px-0">
              <div className="flex items-center">
                <h2 className="text-base sm:text-lg font-semibold leading-none m-0">Category Overview</h2>
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap leading-none self-center" style={{ color: 'var(--text-tertiary)' }}>
                {categoryOverviewRows.length} categories
              </span>
            </div>
            <div
              className="grid gap-3 overflow-y-auto pr-1 px-2 sm:px-0 pb-2 sm:pb-0 scrollable-y"
              style={{ maxHeight: '200px' }}
            >
              {categoryOverviewRows.length === 0 ? (
                <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  No category data yet.
                </div>
              ) : (
                categoryOverviewRows.map((row) => {
                  const metrics = [
                    { label: 'Posts', value: row.posts.toLocaleString() },
                    { label: 'Views', value: row.views.toLocaleString() },
                  ];

                  return (
                    <div
                      key={row.category}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 border border-dashed rounded-lg px-3 sm:px-4 py-3"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex-1 min-w-0 sm:min-w-[150px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-sm sm:text-base truncate">{row.category}</div>
                        {row.posts === 0 && (
                          <span
                            className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border"
                            style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
                          >
                            No posts yet
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-nowrap items-center sm:justify-end gap-2 text-[10px] uppercase tracking-wide sm:flex-1 sm:min-w-0" style={{ color: 'var(--text-tertiary)' }}>
                        {metrics.map((metric) => (
                          <div
                            key={metric.label}
                            className="flex min-w-[90px] sm:min-w-[110px] flex-col items-center rounded-lg border px-1.5 sm:px-2 py-1 text-center"
                            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
                          >
                            <div className="text-[8px] sm:text-[9px] whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                              {metric.label}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {metric.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
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
            <EngagementVisualizer engagement={engagement} posts={allPosts} />
          </div>
        </Card>
      </section>

      <section className="mb-4 sm:mb-6">
        <Card>
          <div className="flex items-center justify-between mb-3 px-2 sm:px-0">
            <h2 className="text-base sm:text-lg font-semibold">Accounts</h2>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{(campaign.accounts || []).length}</span>
          </div>
          <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-1 px-2 sm:px-0 pb-2 sm:pb-0 scrollable-y">
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
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <RequirePermission permission={canManageCampaigns}>
              <Button
                variant="outline"
                color="blue"
                onClick={handleUpdateEngagementStats}
                disabled={updatingEngagement}
                className="text-xs sm:text-sm whitespace-nowrap px-2.5 py-1.5 sm:px-3 sm:py-2 flex-1 sm:flex-none"
              >
                {updatingEngagement 
                  ? (engagementUpdateProgress 
                      ? (
                        <>
                          <span className="hidden sm:inline">Updating... ({engagementUpdateProgress.current}/{engagementUpdateProgress.total})</span>
                          <span className="sm:hidden">{engagementUpdateProgress.current}/{engagementUpdateProgress.total}</span>
                        </>
                      )
                      : 'Updating...')
                  : (
                    <>
                      <span className="hidden sm:inline">Update Engagement Stats</span>
                      <span className="sm:hidden">Update Stats</span>
                    </>
                  )}
              </Button>
            </RequirePermission>
            <Link 
              to={`/campaigns/${campaign.id}/posts`} 
              className="btn btn-outline-blue text-xs sm:text-sm whitespace-nowrap px-2.5 py-1.5 sm:px-3 sm:py-2 no-underline hover:no-underline flex-1 sm:flex-none text-center"
            >
              View all posts
            </Link>
          </div>
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
            ) : filteredPosts.length === 0 ? (
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
                        <TH className="!text-center">FYP TYPE</TH>
                        {renderSortableHeader('Account', 'account')}
                        {renderSortableHeader('Post Date', 'postDate')}
                        {renderSortableHeader('Title', 'postTitle', 'w-48')}
                        <TH>Link</TH>
                        {renderSortableHeader('Views', 'totalView')}
                        {renderSortableHeader('Likes', 'totalLike')}
                        {renderSortableHeader('Comments', 'totalComment')}
                        {renderSortableHeader('Shares', 'totalShare')}
                        {renderSortableHeader('Saved', 'totalSaved')}
                        {renderSortableHeader('Type', 'contentType')}
                        {renderSortableHeader('Content Category', 'contentCategory')}
                        {renderSortableHeader('Campaign Category', 'campaignCategory')}
                        {renderSortableHeader('PIC Talent', 'picTalent')}
                        {renderSortableHeader('PIC Editor', 'picEditor')}
                        {renderSortableHeader('PIC Posting', 'picPosting')}
                        {renderSortableHeader('Ads on Music', 'adsOnMusic')}
                        {renderSortableHeader('Yellow Cart', 'yellowCart')}
                        {renderSortableHeader('Status', 'status')}
                        {renderSortableHeader('Engagement', 'engagementRate')}
                        <TH className="!text-center">Actions</TH>
                      </TR>
                    </THead>
                    <tbody>
                      {sortedPosts.map((p: any, index) => {
                        const isEditing = editingCell?.postId === p.id;
                        const isSaving = savingCell?.startsWith(`${p.id}-`);
                        const postCampaignCategoryOptions = Array.isArray(campaign?.categories) 
                          ? campaign.categories.filter((cat: string) => cat).sort() 
                          : [];
                        
                        return (
                          <TR key={p.id}>
                            
                            <TD>{postPagination.offset + index + 1}</TD>
                            <TD className="!text-center">
                              {p.totalView >= 10000 ? (
                                <div className="flex items-center justify-center gap-3">
                                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={p.fypType === 'ORG'}
                                      onChange={() => {
                                        void handleFypTypeToggle(p.id, 'ORG', p.fypType);
                                      }}
                                      disabled={isSaving && savingCell?.endsWith('-fypType')}
                                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-600 dark:text-green-500 focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <span className={`text-xs ${p.fypType === 'ORG' ? 'font-semibold text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                      ORG
                                    </span>
                                  </label>
                                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={p.fypType === 'ADS'}
                                      onChange={() => {
                                        void handleFypTypeToggle(p.id, 'ADS', p.fypType);
                                      }}
                                      disabled={isSaving && savingCell?.endsWith('-fypType')}
                                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-500 focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <span className={`text-xs ${p.fypType === 'ADS' ? 'font-semibold text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                      ADS
                                    </span>
                                  </label>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-3">
                                  <span className={`text-xs ${p.fypType === 'ORG' ? 'font-semibold text-green-700 dark:text-green-300' : 'text-gray-400 dark:text-gray-600'}`}>
                                    {p.fypType === 'ORG' ? '✓ ORG' : 'ORG'}
                                  </span>
                                  <span className={`text-xs ${p.fypType === 'ADS' ? 'font-semibold text-red-700 dark:text-red-300' : 'text-gray-400 dark:text-gray-600'}`}>
                                    {p.fypType === 'ADS' ? '✓ ADS' : 'ADS'}
                                  </span>
                                </div>
                              )}
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'accountId', p.accountId)}
                              >
                                {isEditing && editingCell?.field === 'accountId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-accountId`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'accountId', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-accountId`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'accountId');
                                    }}
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
                                    {formatDate(p.postDate)}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-[12rem] overflow-hidden whitespace-nowrap rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'postTitle', p.postTitle)}
                                title={p.postTitle}
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
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'contentType', p.contentType)}
                              >
                                {isEditing && editingCell?.field === 'contentType' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-contentType`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'contentType', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-contentType`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'contentType');
                                    }}
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
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-contentCategory`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'contentCategory', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-contentCategory`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'contentCategory');
                                    }}
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
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-campaignCategory`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'campaignCategory', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-campaignCategory`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'campaignCategory');
                                    }}
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
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-picTalentId`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'picTalentId', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-picTalentId`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'picTalentId');
                                    }}
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
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-picEditorId`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'picEditorId', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-picEditorId`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'picEditorId');
                                    }}
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
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-picPostingId`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'picPostingId', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-picPostingId`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'picPostingId');
                                    }}
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
                                onClick={() => handleCellClick(p.id, 'adsOnMusic', p.adsOnMusic)}
                              >
                                {isEditing && editingCell?.field === 'adsOnMusic' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-adsOnMusic`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'adsOnMusic', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-adsOnMusic`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'adsOnMusic');
                                    }}
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
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-yellowCart`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'yellowCart', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-yellowCart`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'yellowCart');
                                    }}
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
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-status`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'status', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-status`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'status');
                                    }}
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
        open={!!engagementUpdateResult}
        onClose={handleCloseEngagementResult}
        title={
          engagementUpdateResult?.type === 'success'
            ? 'Update Successful'
            : engagementUpdateResult?.type === 'error'
            ? 'Update Failed'
            : 'Update Completed with Errors'
        }
        footer={
          <Button
            variant="primary"
            color={engagementUpdateResult?.type === 'error' ? 'red' : 'blue'}
            onClick={handleCloseEngagementResult}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {engagementUpdateResult?.type === 'success' && (
            <div
              className="flex items-center gap-3 p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
            >
              <div className="text-2xl">✓</div>
              <div>
                <p className="font-semibold" style={{ color: '#10b981' }}>
                  Engagement data refreshed
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Updated {engagementUpdateResult.updatedCount} post{engagementUpdateResult.updatedCount !== 1 ? 's' : ''} successfully.
                </p>
              </div>
            </div>
          )}

          {engagementUpdateResult?.type === 'error' && (
            <div
              className="flex items-center gap-3 p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              <div className="text-2xl">✗</div>
              <div>
                <p className="font-semibold" style={{ color: '#ef4444' }}>
                  Update failed
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  No posts were updated. Review the errors below and retry.
                </p>
              </div>
            </div>
          )}

          {engagementUpdateResult?.type === 'partial' && (
            <div
              className="flex items-center gap-3 p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
            >
              <div className="text-2xl">⚠</div>
              <div>
                <p className="font-semibold" style={{ color: '#3b82f6' }}>
                  Partial update
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Updated {engagementUpdateResult.updatedCount} of {engagementUpdateResult.totalCount} posts. {engagementUpdateResult.errors.length} issue{engagementUpdateResult.errors.length !== 1 ? 's' : ''} need attention.
                </p>
              </div>
            </div>
          )}

          {engagementUpdateResult && (
            <div
              className="p-4 rounded-lg border"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Updated {engagementUpdateResult.updatedCount} of {engagementUpdateResult.totalCount} post{engagementUpdateResult.totalCount !== 1 ? 's' : ''}.
              </p>
            </div>
          )}

          {engagementUpdateResult && engagementUpdateResult.errors.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Issues ({engagementUpdateResult.errors.length}):
              </h4>
              <div className="max-h-96 overflow-y-auto border rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th className="px-4 py-2 text-left border-b" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Row</th>
                      <th className="px-4 py-2 text-left border-b" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Details</th>
                      <th className="px-4 py-2 text-left border-b" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagementUpdateResult.errors.map((error) => (
                      <tr key={error.postId || `${error.row}-${error.contentLink}`} className="border-b align-top" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="px-4 py-2 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{error.row || '—'}</td>
                        <td className="px-4 py-2 space-y-1" style={{ color: 'var(--text-secondary)' }}>
                          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{error.postTitle || 'Untitled post'}</div>
                          <div className="text-xs break-all">{error.contentLink || 'No content link available'}</div>
                          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{error.reason}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Button
                            variant="outline"
                            color="blue"
                            className="text-xs"
                            onClick={() => handleRetryUpdateRow(error)}
                            disabled={!!retryingUpdateRows[error.postId]}
                          >
                            {retryingUpdateRows[error.postId] ? 'Retrying...' : 'Retry'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
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
      <Dialog
        open={isEngagementUpdating}
        onClose={() => {}}
        title={engagementProcessingTitle}
      >
        <div className="space-y-2">
          <p style={{ color: 'var(--text-secondary)' }}>{engagementProcessingDescription}</p>
          {engagementProcessingProgress && (
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {engagementProcessingProgress}
            </p>
          )}
        </div>
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
