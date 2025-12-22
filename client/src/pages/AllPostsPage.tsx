import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../lib/api';
import { getApiCacheKey, getCachedValue } from '../lib/cache';
import { formatDate, parseDate } from '../lib/dateUtils';
import { shouldIgnoreRequestError } from '../lib/requestUtils';
import RequirePermission from '../components/RequirePermission';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Dialog from '../components/ui/Dialog';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';
import PageHeader from '../components/PageHeader';
import AccountDropdownFilter from '../components/AccountDropdownFilter';
import Papa from 'papaparse';

type Post = {
  id: string;
  campaignId: string;
  accountId: string;
  postDate: string;
  postDay: string;
  picTalentId?: string;
  picEditorId?: string;
  picPostingId?: string;
  picTalent?: { id: string; name: string } | null;
  picEditor?: { id: string; name: string } | null;
  picPosting?: { id: string; name: string } | null;
  account?: { id: string; name: string } | null;
  campaign?: { id: string; name: string } | null;
  contentCategory: string;
  campaignCategory?: string;
  adsOnMusic: boolean;
  yellowCart: boolean;
  postTitle: string;
  contentType: string;
  status: string;
  contentLink?: string;
  totalView: number;
  totalLike: number;
  totalComment: number;
  totalShare: number;
  totalSaved: number;
  engagementRate: number;
  fypType?: 'ORG' | 'ADS' | null;
};

type CampaignOption = {
  id: string;
  name: string;
  categories: string[];
};

type PicOption = {
  id: string;
  name: string;
  roles: string[];
};

type AccountOption = {
  id: string;
  name: string;
  accountType?: 'CROSSBRAND' | 'NEW_PERSONA' | 'KOL' | 'PROXY';
};

type FilterState = {
  campaignId: string;
  accountId: string;
  status: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  picTalentId: string;
  picEditorId: string;
  picPostingId: string;
};

type SortKey =
  | 'postDate'
  | 'account'
  | 'postTitle'
  | 'totalView'
  | 'totalLike'
  | 'totalComment'
  | 'totalShare'
  | 'totalSaved'
  | 'campaign'
  | 'campaignCategory'
  | 'postDay'
  | 'contentType'
  | 'contentCategory'
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

const CONTENT_CATEGORY_OPTIONS = ['Hardsell product', 'Trend/FOMO', 'Berita/Event', 'Topik Sensitive', 'Sosok/Quotes/Film', 'Storytell', 'Edukasi Product'];
const CONTENT_TYPE_OPTIONS = ['Slide', 'Video'];
const STATUS_OPTIONS = ['On Going', 'Upload', 'Archive', 'Take Down'];

type CsvRow = Record<string, string>;

const CSV_EXPORT_COLUMNS = [
  { key: 'no', label: 'NO' },
  { key: 'postDay', label: 'Hari Posting' },
  { key: 'postDate', label: 'TANGGAL POSTING' },
  { key: 'picTalent', label: 'PIC Talent' },
  { key: 'picEditor', label: 'PIC Editor' },
  { key: 'picPosting', label: 'PIC Posting' },
  { key: 'accountType', label: 'Tipe Akun' },
  { key: 'contentCategory', label: 'Kategori Konten' },
  { key: 'adsOnMusic', label: 'ADS ON MUSIC' },
  { key: 'yellowCart', label: 'KERANJANG KUNING' },
  { key: 'campaignName', label: 'CAMPAIGN' },
  { key: 'campaignCategory', label: 'CATEGORY' },
  { key: 'accountName', label: 'AKUN POSTING' },
  { key: 'postTitle', label: 'JUDUL' },
  { key: 'contentType', label: 'JENIS' },
  { key: 'status', label: 'STATUS' },
  { key: 'contentLink', label: 'LINK KONTEN' },
  { key: 'totalView', label: 'TOTAL VIEW' },
  { key: 'totalLike', label: 'TOTAL LIKE' },
  { key: 'totalComment', label: 'TOTAL COMMENT' },
  { key: 'totalShare', label: 'TOTAL SHARE' },
  { key: 'totalSaved', label: 'TOTAL SAVED' },
] as const;

const ACCOUNT_TYPES: AccountOption['accountType'][] = ['CROSSBRAND', 'NEW_PERSONA', 'KOL', 'PROXY'];
const CSV_REQUIRED_IMPORT_HEADERS = ['TANGGAL POSTING', 'AKUN POSTING', 'JUDUL', 'JENIS', 'KATEGORI KONTEN', 'STATUS', 'CATEGORY', 'CAMPAIGN'];
const DESC_SORT_KEYS: SortKey[] = ['postDate', 'totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved', 'engagementRate', 'adsOnMusic', 'yellowCart'];

const normalizeCsvHeader = (value?: string) => (value ? value.trim().toUpperCase().replace(/\s+/g, ' ') : '');
const getCsvValue = (row: CsvRow, headerMap: Map<string, string>, headerName: string) => {
  const normalized = normalizeCsvHeader(headerName);
  const actualHeader = headerMap.get(normalized);
  const candidate = actualHeader ? row[actualHeader] : undefined;
  return candidate ? candidate.trim() : '';
};
const parseBooleanFlag = (value?: string) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'yes' || normalized === 'true' || normalized === '1';
};
const parseIntegerField = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return 0;
  // Remove dots and commas (thousand separators) since all values are whole numbers
  // e.g., "131.800" (meaning 131.8k) should become "131800"
  const cleaned = trimmed.replace(/[.,]/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const normalizeAccountType = (value?: string) => {
  if (!value) return '';
  const normalized = value.trim().replace(/[\s-]+/g, '_').toUpperCase();
  return ACCOUNT_TYPES.includes(normalized as AccountOption['accountType']) ? (normalized as AccountOption['accountType']) : '';
};
const normalizeAccountKey = (value?: string) => (value ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '');

// Helper function to remove leading zeros from number input
const sanitizeNumberInput = (value: string): string => {
  if (value === '' || value === '0') return value;
  // Remove leading zeros but keep the number
  const num = value.replace(/^0+/, '');
  return num === '' ? '0' : num;
};

export default function AllPostsPage() {
  const { token } = useAuth();
  const { canAddPost, canDeletePost } = usePermissions();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [pics, setPics] = useState<PicOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [editingCell, setEditingCell] = useState<{ postId: string; field: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [importingCsv, setImportingCsv] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    errors: Array<{ row: number; error: string }>;
    type: 'success' | 'error' | 'partial';
  } | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'postDate', direction: 'desc' });
  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectChangeInProgressRef = useRef<string | null>(null);
  const initialCellValueRef = useRef<string>('');
  const hasHydratedFromCacheRef = useRef(false);

  const [filters, setFilters] = useState<FilterState>({
    campaignId: '',
    accountId: '',
    status: '',
    category: '',
    dateFrom: '',
    dateTo: '',
    picTalentId: '',
    picEditorId: '',
    picPostingId: '',
  });

  const POSTS_CACHE_KEY = getApiCacheKey('/posts/all');
  const CAMPAIGNS_CACHE_KEY = getApiCacheKey('/campaigns');
  const PICS_CACHE_KEY = getApiCacheKey('/pics?active=true');
  const ACCOUNTS_CACHE_KEY = getApiCacheKey('/accounts');

  const fetchPosts = useCallback(async () => {
    if (!token) return;
    const cached = getCachedValue<Post[]>(POSTS_CACHE_KEY);
    const hasCache = !!cached && Array.isArray(cached);
    if (hasCache && !hasHydratedFromCacheRef.current) {
      setPosts(cached!);
      setLoading(false);
      hasHydratedFromCacheRef.current = true;
    } else {
      setLoading(!hasCache);
    }
    try {
      const data = await api('/posts/all', { token });
      setPosts(data as Post[]);
    } catch (error) {
      if (shouldIgnoreRequestError(error)) {
        return;
      }
      console.error('Failed to fetch posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!token) return;
    api('/campaigns', { token }).then(setCampaigns).catch(() => {});
    api('/pics?active=true', { token }).then(setPics).catch(() => {});
    api('/accounts', { token }).then(setAccounts).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || hasHydratedFromCacheRef.current) return;
    const cachedPosts = getCachedValue<Post[]>(POSTS_CACHE_KEY);
    const cachedCampaigns = getCachedValue<CampaignOption[]>(CAMPAIGNS_CACHE_KEY);
    const cachedPics = getCachedValue<PicOption[]>(PICS_CACHE_KEY);
    const cachedAccounts = getCachedValue<AccountOption[]>(ACCOUNTS_CACHE_KEY);

    if (cachedPosts) {
      setPosts(cachedPosts);
      setLoading(false);
      hasHydratedFromCacheRef.current = true;
    }
    if (cachedCampaigns) setCampaigns(cachedCampaigns);
    if (cachedPics) setPics(cachedPics);
    if (cachedAccounts) setAccounts(cachedAccounts);
  }, [token]);

  const accountNameMap = useMemo(() => new Map(accounts.map((account) => [account.id, account.name || ''])), [accounts]);
  const campaignNameMap = useMemo(() => new Map(campaigns.map((campaign) => [campaign.id, campaign.name || ''])), [campaigns]);
  const picNameMap = useMemo(() => new Map(pics.map((pic) => [pic.id, pic.name || ''])), [pics]);

  const getAccountName = useCallback((post: Post) => {
    if (post.account?.name) return post.account.name;
    if (post.accountId) {
      return accountNameMap.get(post.accountId) || '';
    }
    return '';
  }, [accountNameMap]);

  const getCampaignName = useCallback((post: Post) => {
    if (post.campaign?.name) return post.campaign.name;
    if (post.campaignId) {
      return campaignNameMap.get(post.campaignId) || '';
    }
    return '';
  }, [campaignNameMap]);

  const getPicName = useCallback((id?: string, pic?: { id: string; name: string } | null) => {
    if (pic?.name) return pic.name;
    if (id) {
      return picNameMap.get(id) || '';
    }
    return '';
  }, [picNameMap]);

  const talentPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'TALENT')), [pics]);
  const editorPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'EDITOR')), [pics]);
  const postingPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'POSTING')), [pics]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedPostIds(new Set());
  }, [filters]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (filters.campaignId && post.campaignId !== filters.campaignId) return false;
      if (filters.accountId && post.accountId !== filters.accountId) return false;
      if (filters.status && post.status !== filters.status) return false;
      if (filters.category && post.contentCategory !== filters.category) return false;
      if (filters.picTalentId && post.picTalentId !== filters.picTalentId) return false;
      if (filters.picEditorId && post.picEditorId !== filters.picEditorId) return false;
      if (filters.picPostingId && post.picPostingId !== filters.picPostingId) return false;

      if (filters.dateFrom) {
        const postDate = post.postDate ? new Date(post.postDate).getTime() : 0;
        const from = new Date(filters.dateFrom).getTime();
        if (postDate < from) return false;
      }

      if (filters.dateTo) {
        const postDate = post.postDate ? new Date(post.postDate).getTime() : 0;
        const to = new Date(filters.dateTo).getTime();
        if (postDate > to) return false;
      }

      return true;
    });
  }, [posts, filters]);

  const sortedPosts = useMemo(() => {
    const toTimestamp = (value?: string) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? time : 0;
    };

    const normalize = (value: string) => value.toLowerCase();

    const getSortValue = (post: Post, key: SortKey): string | number => {
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
        case 'campaign':
          return normalize(getCampaignName(post));
        case 'campaignCategory':
          return normalize(post.campaignCategory || '');
        case 'postDay':
          return normalize(post.postDay || '');
        case 'contentType':
          return normalize(post.contentType || '');
        case 'contentCategory':
          return normalize(post.contentCategory || '');
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

    const nextPosts = [...filteredPosts];
    nextPosts.sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);
      const comparison = compareValues(aValue, bValue);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
    return nextPosts;
  }, [filteredPosts, sortConfig, getAccountName, getCampaignName, getPicName]);

  // Client-side pagination
  const paginatedPosts = useMemo(() => {
    const start = pagination.offset;
    const end = start + pagination.limit;
    return sortedPosts.slice(start, end);
  }, [sortedPosts, pagination]);

  const totalPages = Math.ceil(sortedPosts.length / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const handleSortToggle = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDirection = DESC_SORT_KEYS.includes(key) ? 'desc' : 'asc';
      return { key, direction: defaultDirection };
    });
  };

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

  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset to first page when filtering
  };

  const handleRowsPerPageChange = (newLimit: number) => {
    setPagination({ limit: newLimit, offset: 0 });
  };

  // Define the order of editable columns
  const EDITABLE_FIELDS = [
    'campaignId',
    'campaignCategory',
    'accountId',
    'postDate',
    'postTitle',
    'contentType',
    'contentCategory',
    'status',
    'picTalentId',
    'picEditorId',
    'picPostingId',
    'contentLink',
    'adsOnMusic',
    'yellowCart',
    'totalView',
    'totalLike',
    'totalComment',
    'totalShare',
    'totalSaved',
  ] as const;

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
      }) as Post;

      // Update the post in the list
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return { ...updatedPost, account: p.account, campaign: p.campaign, picTalent: p.picTalent, picEditor: p.picEditor, picPosting: p.picPosting };
        }
        return p;
      }));

      setToast({ type: 'success', text: 'FYP type updated successfully' });
    } catch (error) {
      console.error('Failed to update FYP type:', error);
      setToast({ type: 'error', text: 'Failed to update FYP type' });
    } finally {
      setSavingCell('');
    }
  };

  const handleCellBlur = async (postId: string, field: string, skipClose?: boolean, overrideValue?: string): Promise<Post | null> => {
    if (!editingCell || editingCell.postId !== postId || editingCell.field !== field) return null;
    
    const post = posts.find(p => p.id === postId);
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
    } else if (field === 'campaignId') {
      hasChanged = valueToUse !== post.campaignId;
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
      const currentNum = post[field as keyof Post] as number;
      const newNum = parseInt(valueToUse || '0', 10) || 0;
      hasChanged = newNum !== currentNum;
      newValue = newNum;
    }

    if (!hasChanged) {
      if (!skipClose) setEditingCell(null);
      return null;
    }

    const getPicObject = (picId: string | undefined) => {
      if (!picId) return null;
      const pic = pics.find(p => p.id === picId);
      return pic ? { id: pic.id, name: pic.name } : null;
    };
    
    const getAccountObject = (accountId: string | undefined) => {
      if (!accountId) return null;
      const account = accounts.find(a => a.id === accountId);
      return account ? { id: account.id, name: account.name } : null;
    };
    
    const getCampaignObject = (campaignId: string | undefined) => {
      if (!campaignId) return null;
      const campaign = campaigns.find(c => c.id === campaignId);
      return campaign ? { id: campaign.id, name: campaign.name } : null;
    };

    // Optimistically update local state so the table shows the new value immediately
    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id !== postId) return p;
      const updated: Post = { ...p };
      if (field === 'postDate') {
        updated.postDate = new Date(valueToUse).toISOString();
        updated.postDay = updated.postDate ? new Date(updated.postDate).toLocaleDateString('en-US', { weekday: 'long' }) : p.postDay;
      } else if (field === 'campaignId') {
        updated.campaignId = valueToUse || '';
        updated.campaign = valueToUse ? getCampaignObject(valueToUse) || undefined : p.campaign;
      } else if (field === 'accountId') {
        updated.accountId = valueToUse || '';
        updated.account = valueToUse ? getAccountObject(valueToUse) || undefined : p.account;
      } else if (field === 'postTitle') {
        updated.postTitle = valueToUse;
      } else if (field === 'contentLink') {
        updated.contentLink = valueToUse;
      } else if (field === 'contentType') {
        updated.contentType = valueToUse;
      } else if (field === 'contentCategory') {
        updated.contentCategory = valueToUse;
      } else if (field === 'campaignCategory') {
        updated.campaignCategory = valueToUse;
      } else if (field === 'status') {
        updated.status = valueToUse;
      } else if (field === 'picTalentId') {
        updated.picTalentId = valueToUse || undefined;
        updated.picTalent = valueToUse ? getPicObject(valueToUse) || undefined : p.picTalent;
      } else if (field === 'picEditorId') {
        updated.picEditorId = valueToUse || undefined;
        updated.picEditor = valueToUse ? getPicObject(valueToUse) || undefined : p.picEditor;
      } else if (field === 'picPostingId') {
        updated.picPostingId = valueToUse || undefined;
        updated.picPosting = valueToUse ? getPicObject(valueToUse) || undefined : p.picPosting;
      } else if (field === 'adsOnMusic') {
        updated.adsOnMusic = newValue;
      } else if (field === 'yellowCart') {
        updated.yellowCart = newValue;
      } else if (field === 'fypType') {
        updated.fypType = newValue;
      } else if (['totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved'].includes(field)) {
        (updated as any)[field] = newValue;
      }
      return updated;
    }));

    setSavingCell(`${postId}-${field}`);
    try {
      const updatePayload: any = {};
      
      if (field === 'postDate') {
        updatePayload.postDate = new Date(valueToUse).toISOString();
      } else if (field === 'campaignId') {
        updatePayload.campaignId = valueToUse || undefined;
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
      }) as Post;

      // Helper functions to get related objects
      const getPicObject = (picId: string | undefined) => {
        if (!picId) return null;
        const pic = pics.find(p => p.id === picId);
        return pic ? { id: pic.id, name: pic.name } : null;
      };
      
      const getAccountObject = (accountId: string | undefined) => {
        if (!accountId) return null;
        const account = accounts.find(a => a.id === accountId);
        return account ? { id: account.id, name: account.name } : null;
      };
      
      const getCampaignObject = (campaignId: string | undefined) => {
        if (!campaignId) return null;
        const campaign = campaigns.find(c => c.id === campaignId);
        return campaign ? { id: campaign.id, name: campaign.name } : null;
      };
      
      // Build updated post with relations
      const updatedPostWithRelations: Post = {
        ...updatedPost,
        account: updatedPost.accountId ? getAccountObject(updatedPost.accountId) : post.account,
        campaign: updatedPost.campaignId ? getCampaignObject(updatedPost.campaignId) : post.campaign,
        picTalent: updatedPost.picTalentId ? getPicObject(updatedPost.picTalentId) : post.picTalent,
        picEditor: updatedPost.picEditorId ? getPicObject(updatedPost.picEditorId) : post.picEditor,
        picPosting: updatedPost.picPostingId ? getPicObject(updatedPost.picPostingId) : post.picPosting,
        postDay: updatedPost.postDate ? new Date(updatedPost.postDate).toLocaleDateString('en-US', { weekday: 'long' }) : post.postDay,
      };

      // Update the post in the list
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return updatedPostWithRelations;
        }
        return p;
      }));

      setToast({ type: 'success', text: 'Post updated successfully' });
      return updatedPostWithRelations;
    } catch (error) {
      // Revert optimistic update on failure
      setPosts(prevPosts => prevPosts.map(p => (p.id === postId ? post : p)));
      setToast({ type: 'error', text: (error as Error).message });
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
      if (currentPostIndex < sortedPosts.length - 1) {
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
      void handleCellBlur(postId, field, true);
      setEditingCell(null);
      return;
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      
      // Save current cell in background (don't wait for it)
      void handleCellBlur(postId, field, true);
      
      // Navigate immediately using current data
      const currentPostIndex = sortedPosts.findIndex(p => p.id === postId);
      
      if (currentPostIndex === -1) {
        setEditingCell(null);
        return;
      }
      
      // Optimistically update the current post with the edited value for navigation
      const post = sortedPosts.find(p => p.id === postId);
      if (!post) {
        setEditingCell(null);
        return;
      }
      
      // Create optimistic update for navigation
      const optimisticPost: Post = { ...post };
      if (field === 'postDate') {
        optimisticPost.postDate = new Date(cellEditValue).toISOString();
      } else if (field === 'campaignId') {
        optimisticPost.campaignId = cellEditValue || post.campaignId;
      } else if (field === 'accountId') {
        optimisticPost.accountId = cellEditValue || post.accountId;
      } else if (field === 'postTitle' || field === 'contentLink') {
        (optimisticPost as any)[field] = cellEditValue;
      } else if (field === 'contentType' || field === 'contentCategory' || field === 'status' || field === 'campaignCategory') {
        (optimisticPost as any)[field] = cellEditValue;
      } else if (field === 'picTalentId' || field === 'picEditorId' || field === 'picPostingId') {
        (optimisticPost as any)[field] = cellEditValue || undefined;
      } else if (field === 'adsOnMusic' || field === 'yellowCart') {
        (optimisticPost as any)[field] = cellEditValue === 'true';
      } else if (['totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved'].includes(field)) {
        (optimisticPost as any)[field] = parseInt(cellEditValue || '0', 10) || 0;
      }
      
      const optimisticPosts = sortedPosts.map(p => p.id === postId ? optimisticPost : p);
      
      const direction = e.shiftKey ? 'prev' : 'next';
      const nextCell = findNextEditableCell(currentPostIndex, field, direction);
      
      if (nextCell) {
        const nextPost = optimisticPosts[nextCell.postIndex];
        if (nextPost) {
          // Get the current value for the next field
          let currentValue: string | number | boolean = '';
          
          if (nextCell.field === 'accountId') {
            currentValue = nextPost.accountId || '';
          } else if (nextCell.field === 'campaignId') {
            currentValue = nextPost.campaignId || '';
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
            const fieldValue = nextPost[nextCell.field as keyof Post];
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

  const handleDeleteClick = (post: Post) => {
    setSelectedPostIds(new Set()); // Clear selection when deleting individual post
    setDeleteConfirm({ id: post.id, title: post.postTitle });
  };

  const handleBulkDeleteClick = () => {
    if (selectedPostIds.size === 0) return;
    const selectedPosts = sortedPosts.filter(p => selectedPostIds.has(p.id));
    setDeleteConfirm({ id: selectedPosts[0].id, title: `${selectedPostIds.size} post${selectedPostIds.size !== 1 ? 's' : ''}` });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleting(true);
    try {
      // If multiple posts are selected, delete all of them
      if (selectedPostIds.size > 1) {
        const idsToDelete = Array.from(selectedPostIds);
        await Promise.all(idsToDelete.map(postId => api(`/posts/${postId}`, { method: 'DELETE', token })));
        await fetchPosts();
        setToast({ type: 'success', text: `${idsToDelete.length} posts deleted successfully` });
        setSelectedPostIds(new Set());
      } else {
        await api(`/posts/${id}`, { method: 'DELETE', token });
        await fetchPosts();
        setToast({ type: 'success', text: 'Post deleted successfully' });
      }
    } catch (error) {
      setToast({ type: 'error', text: (error as Error).message });
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPostIds(new Set(sortedPosts.map(p => p.id)));
    } else {
      setSelectedPostIds(new Set());
    }
  };

  const handleSelectPost = (postId: string, checked: boolean) => {
    setSelectedPostIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(postId);
      } else {
        next.delete(postId);
      }
      return next;
    });
  };

  const allSelected = sortedPosts.length > 0 && selectedPostIds.size === sortedPosts.length;
  const someSelected = selectedPostIds.size > 0 && selectedPostIds.size < sortedPosts.length;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleExportCsv = useCallback(() => {
    const csvRows = filteredPosts.map((post, index) => {
      const picTalentName = post.picTalent?.name || (post.picTalentId ? pics.find((pic) => pic.id === post.picTalentId)?.name : '') || '';
      const picEditorName = post.picEditor?.name || (post.picEditorId ? pics.find((pic) => pic.id === post.picEditorId)?.name : '') || '';
      const picPostingName = post.picPosting?.name || (post.picPostingId ? pics.find((pic) => pic.id === post.picPostingId)?.name : '') || '';
      const account = accounts.find((acc) => acc.id === post.accountId);
      const campaign = campaigns.find((c) => c.id === post.campaignId);
      return {
        no: index + 1,
        postDay: post.postDay || '',
        postDate: post.postDate ? formatDate(post.postDate) : '',
        picTalent: picTalentName,
        picEditor: picEditorName,
        picPosting: picPostingName,
        accountType: account?.accountType || '',
        contentCategory: post.contentCategory || '',
        adsOnMusic: post.adsOnMusic ? 'Yes' : 'No',
        yellowCart: post.yellowCart ? 'Yes' : 'No',
        campaignName: campaign?.name || '',
        campaignCategory: post.campaignCategory || '',
        accountName: account?.name || '',
        postTitle: post.postTitle || '',
        contentType: post.contentType || '',
        status: post.status || '',
        contentLink: post.contentLink || '',
        totalView: post.totalView ?? 0,
        totalLike: post.totalLike ?? 0,
        totalComment: post.totalComment ?? 0,
        totalShare: post.totalShare ?? 0,
        totalSaved: post.totalSaved ?? 0,
      };
    });

    const csvStringWithKeys = Papa.unparse(csvRows, {
      columns: CSV_EXPORT_COLUMNS.map((column) => column.key),
      header: true,
    });
    // Replace header row with custom labels
    const lines = csvStringWithKeys.split('\n');
    lines[0] = CSV_EXPORT_COLUMNS.map((column) => column.label).join(',');
    const csvString = lines.join('\n');

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-posts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredPosts, accounts, pics, campaigns]);

  const triggerCsvImport = () => {
    fileInputRef.current?.click();
  };

  const handleCsvFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }
    if (!token) {
      setToast({ type: 'error', text: 'Authentication is required to import posts.' });
      input.value = '';
      return;
    }

    setImportingCsv(true);
    setToast(null);
    try {
      const content = await file.text();
      const parsed = Papa.parse<CsvRow>(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => (header ? header.trim() : ''),
      });

      if (parsed.errors.length > 0) {
        throw new Error(parsed.errors[0].message || 'Failed to parse CSV file.');
      }

      const fields = parsed.meta.fields;
      if (!fields || fields.length === 0) {
        throw new Error('CSV file is missing headers.');
      }

      const headerMap = new Map<string, string>();
      fields.forEach((field) => {
        if (field) {
          headerMap.set(normalizeCsvHeader(field), field);
        }
      });

      const missingHeaders = CSV_REQUIRED_IMPORT_HEADERS.filter((header) => !headerMap.has(normalizeCsvHeader(header)));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      const rows = (parsed.data as CsvRow[]).filter((row) =>
        Object.values(row).some((value) => value && value.trim() !== ''),
      );
      if (rows.length === 0) {
        throw new Error('CSV file does not contain any data rows.');
      }

      const accountLookup = new Map<string, AccountOption>();
      accounts.forEach((account) => {
        const key = normalizeAccountKey(account.name);
        if (key) {
          accountLookup.set(key, account);
        }
      });

      const campaignLookup = new Map<string, CampaignOption>();
      campaigns.forEach((campaign) => {
        if (campaign.name) {
          campaignLookup.set(campaign.name.trim().toLowerCase(), campaign);
        }
      });

      const picsMap = new Map<string, PicOption>();
      pics.forEach((pic) => {
        if (pic.name) {
          picsMap.set(pic.name.trim().toLowerCase(), pic);
        }
      });

      let importedCount = 0;
      const errors: Array<{ row: number; error: string }> = [];

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        try {
          const accountName = getCsvValue(row, headerMap, 'AKUN POSTING');
          if (!accountName) {
            throw new Error(`Row ${rowNumber}: Missing account name`);
          }

          const campaignNameFromCsv = getCsvValue(row, headerMap, 'CAMPAIGN');
          if (!campaignNameFromCsv) {
            throw new Error(`Row ${rowNumber}: Missing campaign name`);
          }

          // Find campaign by name
          const normalizedCampaignName = campaignNameFromCsv.trim().toLowerCase();
          let campaign = campaignLookup.get(normalizedCampaignName);
          
          if (!campaign) {
            // Try to find in existing campaigns (case-insensitive)
            campaign = campaigns.find((c) => c.name.trim().toLowerCase() === normalizedCampaignName);
            if (campaign) {
              campaignLookup.set(normalizedCampaignName, campaign);
            } else {
              throw new Error(
                `Row ${rowNumber}: Campaign "${campaignNameFromCsv}" not found. Please create the campaign first.`,
              );
            }
          }

          const normalizedAccountName = normalizeAccountKey(accountName);
          let account = accountLookup.get(normalizedAccountName);
          const accountType = normalizeAccountType(getCsvValue(row, headerMap, 'Tipe Akun')) || 'CROSSBRAND';
          if (!account) {
            try {
              const created = (await api('/accounts', {
                method: 'POST',
                token,
                body: {
                  name: accountName.trim(),
                  accountType,
                },
              })) as AccountOption;
              accountLookup.set(normalizeAccountKey(created.name), created);
              setAccounts((prev) => [...prev, created]);
              account = created;
            } catch (accountError: any) {
              throw new Error(`Row ${rowNumber}: Failed to create account "${accountName}": ${accountError?.message || accountError?.error || 'Unknown error'}`);
            }
          }

          const postTitle = getCsvValue(row, headerMap, 'JUDUL');
          if (!postTitle) {
            throw new Error(`Row ${rowNumber}: Missing post title`);
          }

          const contentType = getCsvValue(row, headerMap, 'JENIS');
          if (!contentType) {
            throw new Error(`Row ${rowNumber}: Missing content type`);
          }

          const contentCategory = getCsvValue(row, headerMap, 'KATEGORI KONTEN');
          if (!contentCategory) {
            throw new Error(`Row ${rowNumber}: Missing content category`);
          }

          const status = getCsvValue(row, headerMap, 'STATUS');
          if (!status) {
            throw new Error(`Row ${rowNumber}: Missing status`);
          }

          const postDateValue = getCsvValue(row, headerMap, 'TANGGAL POSTING');
          if (!postDateValue) {
            throw new Error(`Row ${rowNumber}: Missing post date`);
          }

          const parsedDate = parseDate(postDateValue);
          if (!parsedDate) {
            throw new Error(`Row ${rowNumber}: Invalid post date (${postDateValue}). Expected format: dd/mm/yyyy`);
          }

          const campaignCategoryValue = getCsvValue(row, headerMap, 'CATEGORY');
          if (!campaignCategoryValue) {
            throw new Error(`Row ${rowNumber}: Missing campaign category`);
          }

          // Validate campaign category belongs to the campaign
          if (!campaign.categories.includes(campaignCategoryValue)) {
            throw new Error(
              `Row ${rowNumber}: Campaign category "${campaignCategoryValue}" is not valid for campaign "${campaign.name}". Valid categories: ${campaign.categories.join(', ')}`,
            );
          }

          // Handle PIC creation/updates - collect PIC names from this row
          const picTalentName = getCsvValue(row, headerMap, 'PIC Talent');
          const picEditorName = getCsvValue(row, headerMap, 'PIC Editor');
          const picPostingName = getCsvValue(row, headerMap, 'PIC Posting');
          
          // Collect unique PIC names and their required roles
          const picRolesMap = new Map<string, Set<'TALENT' | 'EDITOR' | 'POSTING'>>();
          
          if (picTalentName && picTalentName.trim()) {
            const key = picTalentName.trim().toLowerCase();
            if (!picRolesMap.has(key)) picRolesMap.set(key, new Set());
            picRolesMap.get(key)!.add('TALENT');
          }
          
          if (picEditorName && picEditorName.trim()) {
            const key = picEditorName.trim().toLowerCase();
            if (!picRolesMap.has(key)) picRolesMap.set(key, new Set());
            picRolesMap.get(key)!.add('EDITOR');
          }
          
          if (picPostingName && picPostingName.trim()) {
            const key = picPostingName.trim().toLowerCase();
            if (!picRolesMap.has(key)) picRolesMap.set(key, new Set());
            picRolesMap.get(key)!.add('POSTING');
          }
          
          // Process each PIC - create or update with roles
          for (const [picKey, rolesSet] of picRolesMap.entries()) {
            const picName = picTalentName?.trim() === picKey || picTalentName?.trim().toLowerCase() === picKey
              ? picTalentName.trim()
              : picEditorName?.trim() === picKey || picEditorName?.trim().toLowerCase() === picKey
              ? picEditorName.trim()
              : picPostingName?.trim() === picKey || picPostingName?.trim().toLowerCase() === picKey
              ? picPostingName.trim()
              : picKey;
            
            const roles = Array.from(rolesSet);
            // Default to TALENT if no roles (shouldn't happen, but safety check)
            if (roles.length === 0) roles.push('TALENT');
            
            let pic = picsMap.get(picKey);
            
            if (!pic) {
              // Create new PIC
              try {
                const created = (await api('/pics', {
                  method: 'POST',
                  token,
                  body: {
                    name: picName,
                    active: true,
                    roles,
                  },
                })) as PicOption;
                picsMap.set(picKey, created);
                setPics((prev) => [...prev, created]);
                pic = created;
              } catch (picError: any) {
                throw new Error(`Row ${rowNumber}: Failed to create PIC "${picName}": ${picError?.message || picError?.error || 'Unknown error'}`);
              }
            } else {
              // Update existing PIC - merge roles only if needed
              const existingRoles = new Set(pic.roles.map((r) => r.toUpperCase()));
              // Check if ALL required roles are already present
              const allRolesPresent = roles.every((r) => existingRoles.has(r));
              
              if (!allRolesPresent) {
                // Only update if at least one required role is missing
                const mergedRoles = Array.from(new Set([...pic.roles.map((r) => r.toUpperCase()), ...roles]));
                try {
                  const updated = (await api(`/pics/${pic.id}`, {
                    method: 'PUT',
                    token,
                    body: {
                      name: pic.name,
                      roles: mergedRoles,
                    },
                  })) as PicOption;
                  picsMap.set(picKey, updated);
                  setPics((prev) => prev.map((p) => (p.id === pic!.id ? updated : p)));
                  pic = updated;
                } catch (picError: any) {
                  console.warn(`Failed to update PIC ${pic!.name} with roles:`, picError);
                  // Continue with existing PIC if update fails
                }
              }
              // If all roles are already present, skip the API call
            }
          }
          
          // Get PIC IDs for payload
          const picTalentId = picTalentName && picTalentName.trim() 
            ? picsMap.get(picTalentName.trim().toLowerCase())?.id 
            : undefined;
          const picEditorId = picEditorName && picEditorName.trim()
            ? picsMap.get(picEditorName.trim().toLowerCase())?.id
            : undefined;
          const picPostingId = picPostingName && picPostingName.trim()
            ? picsMap.get(picPostingName.trim().toLowerCase())?.id
            : undefined;

          const payload = {
            campaignId: campaign.id,
            accountId: account.id,
            postDate: parsedDate.toISOString(),
            picTalentId,
            picEditorId,
            picPostingId,
            contentCategory,
            campaignCategory: campaignCategoryValue,
            adsOnMusic: parseBooleanFlag(getCsvValue(row, headerMap, 'ADS ON MUSIC')),
            yellowCart: parseBooleanFlag(getCsvValue(row, headerMap, 'KERANJANG KUNING')),
            postTitle,
            contentType,
            status,
            contentLink: getCsvValue(row, headerMap, 'LINK KONTEN'),
            totalView: parseIntegerField(getCsvValue(row, headerMap, 'TOTAL VIEW')),
            totalLike: parseIntegerField(getCsvValue(row, headerMap, 'TOTAL LIKE')),
            totalComment: parseIntegerField(getCsvValue(row, headerMap, 'TOTAL COMMENT')),
            totalShare: parseIntegerField(getCsvValue(row, headerMap, 'TOTAL SHARE')),
            totalSaved: parseIntegerField(getCsvValue(row, headerMap, 'TOTAL SAVED')),
          };

          await api('/posts', { method: 'POST', token, body: payload });
          importedCount += 1;
        } catch (rowError: any) {
          const errorMessage = rowError?.message || rowError?.error || String(rowError) || 'Unknown error';
          errors.push({ row: rowNumber, error: errorMessage });
        }
      }

      await fetchPosts();
      
      // Show comprehensive summary in modal
      if (errors.length === 0) {
        setImportResult({
          importedCount,
          errors: [],
          type: 'success',
        });
      } else if (importedCount === 0) {
        // All rows failed
        setImportResult({
          importedCount: 0,
          errors,
          type: 'error',
        });
      } else {
        // Partial success
        setImportResult({
          importedCount,
          errors,
          type: 'partial',
        });
      }
    } catch (error) {
      setImportResult({
        importedCount: 0,
        errors: [{ row: 0, error: (error as Error).message }],
        type: 'error',
      });
    } finally {
      setImportingCsv(false);
      input.value = '';
    }
  };

  const isProcessingAllPosts = importingCsv;
  const processingDialogTitle = 'Importing posts';
  const processingDialogDescription =
    'Importing posts from the uploaded CSV. Please keep this tab open and avoid refreshing until the import completes.';

  return (
    <div>
      <PageHeader
        backPath="/campaigns"
        backLabel="Back to campaigns"
        title={<h2 className="page-title">All Posts</h2>}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCsvFileChange}
      />

      {loading ? (
        <div className="skeleton h-10 w-full" />
      ) : (
        <Card>
          <div className="card-inner-table">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <p className="text-xs text-gray-500">
                Export all posts or import new ones from a CSV. Campaign names in CSV must match existing campaigns.
              </p>
              <div className="flex flex-wrap gap-2">
                <RequirePermission permission={canAddPost}>
                  <Button
                    onClick={triggerCsvImport}
                    variant="outline"
                    disabled={importingCsv}
                  >
                    {importingCsv ? 'Importing CSV...' : 'Import CSV'}
                  </Button>
                </RequirePermission>
                <Button
                  onClick={handleExportCsv}
                  variant="outline"
                  disabled={filteredPosts.length === 0}
                >
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 sm:gap-3 mb-4">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-9 gap-1.5 sm:gap-2 w-full">
                  <Select
                    label={<span className="text-xs">Campaign</span>}
                    value={filters.campaignId}
                    onChange={(event) => handleFilterChange('campaignId', event.target.value)}
                    className="text-sm py-1.5"
                  >
                    <option value="">All campaigns</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </Select>
                  <AccountDropdownFilter
                    accounts={accounts}
                    selectedAccountId={filters.accountId}
                    onSelect={(value) => handleFilterChange('accountId', value)}
                  />
                  <Select
                    label={<span className="text-xs">Status</span>}
                    value={filters.status}
                    onChange={(event) => handleFilterChange('status', event.target.value)}
                    className="text-sm py-1.5"
                  >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label={<span className="text-xs">Content Category</span>}
                    value={filters.category}
                    onChange={(event) => handleFilterChange('category', event.target.value)}
                    className="text-sm py-1.5"
                  >
                    <option value="">All categories</option>
                    {CONTENT_CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label={<span className="text-xs">PIC Talent</span>}
                    value={filters.picTalentId}
                    onChange={(event) => handleFilterChange('picTalentId', event.target.value)}
                    className="text-sm py-1.5"
                  >
                    <option value="">All PICs</option>
                    {talentPics.map((pic) => (
                      <option key={pic.id} value={pic.id}>
                        {pic.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label={<span className="text-xs">PIC Editor</span>}
                    value={filters.picEditorId}
                    onChange={(event) => handleFilterChange('picEditorId', event.target.value)}
                    className="text-sm py-1.5"
                  >
                    <option value="">All Editors</option>
                    {editorPics.map((pic) => (
                      <option key={pic.id} value={pic.id}>
                        {pic.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label={<span className="text-xs">PIC Posting</span>}
                    value={filters.picPostingId}
                    onChange={(event) => handleFilterChange('picPostingId', event.target.value)}
                    className="text-sm py-1.5"
                  >
                    <option value="">All Posting PICs</option>
                    {postingPics.map((pic) => (
                      <option key={pic.id} value={pic.id}>
                        {pic.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label={<span className="text-xs">Date From</span>}
                    type="date"
                    value={filters.dateFrom}
                    onChange={(event) => handleFilterChange('dateFrom', event.target.value)}
                    className="text-sm py-1.5"
                  />
                  <Input
                    label={<span className="text-xs">Date To</span>}
                    type="date"
                    value={filters.dateTo}
                    onChange={(event) => handleFilterChange('dateTo', event.target.value)}
                    className="text-sm py-1.5"
                  />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    onClick={() => {
                      setFilters({
                        campaignId: '',
                        accountId: '',
                        status: '',
                        category: '',
                        dateFrom: '',
                        dateTo: '',
                        picTalentId: '',
                        picEditorId: '',
                        picPostingId: '',
                      });
                      setPagination(prev => ({ ...prev, offset: 0 }));
                    }}
                    variant="outline"
                    className="text-sm py-1 px-2"
                  >
                    Clear Filters
                  </Button>
                  {selectedPostIds.size > 0 && (
                    <RequirePermission permission={canDeletePost}>
                      <Button
                        onClick={handleBulkDeleteClick}
                        variant="outline"
                        color="red"
                        disabled={deleting}
                        className="text-sm py-1 px-2"
                      >
                        Delete Selected ({selectedPostIds.size})
                      </Button>
                    </RequirePermission>
                  )}
                </div>
              </div>
            </div>
            {sortedPosts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-500 text-lg">No posts found</p>
                <p className="text-gray-400 text-sm mt-2">
                  {Object.values(filters).some(f => f !== '') 
                    ? 'Try adjusting your filters to see more results.'
                    : 'There are no posts available. Import posts from CSV to get started.'}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, sortedPosts.length)} of {sortedPosts.length}
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
                      <TH className="!text-center w-12">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(input) => {
                            if (input) input.indeterminate = someSelected;
                          }}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-500 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                        />
                      </TH>
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
                      {renderSortableHeader('Campaign', 'campaign')}
                      {renderSortableHeader('Campaign Category', 'campaignCategory')}
                      {renderSortableHeader('Post Day', 'postDay')}
                      {renderSortableHeader('Type', 'contentType')}
                      {renderSortableHeader('Content Category', 'contentCategory')}
                      {renderSortableHeader('Status', 'status')}
                      {renderSortableHeader('PIC Talent', 'picTalent')}
                      {renderSortableHeader('PIC Editor', 'picEditor')}
                      {renderSortableHeader('PIC Posting', 'picPosting')}
                      {renderSortableHeader('Ads on Music', 'adsOnMusic')}
                      {renderSortableHeader('Yellow Cart', 'yellowCart')}
                      {renderSortableHeader('Engagement Rate', 'engagementRate')}
                      <TH className="!text-center">Actions</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {paginatedPosts.map((p, i) => {
                      const picTalentName = getPicName(p.picTalentId, p.picTalent) || '—';
                      const picEditorName = getPicName(p.picEditorId, p.picEditor) || '—';
                      const picPostingName = getPicName(p.picPostingId, p.picPosting) || '—';
                      const accountName = getAccountName(p) || '—';
                      const campaignName = getCampaignName(p) || '—';
                      const isEditing = editingCell?.postId === p.id;
                      const isSaving = savingCell?.startsWith(`${p.id}-`);
                      const selectedCampaign = campaigns.find((c) => c.id === p.campaignId);
                      const postCampaignCategoryOptions = Array.isArray(selectedCampaign?.categories) 
                        ? selectedCampaign.categories.filter((cat) => cat).sort() 
                        : [];
                      
                      return (
                          <TR key={p.id}>
                            <TD className="!text-center">
                              <input
                                type="checkbox"
                                checked={selectedPostIds.has(p.id)}
                                onChange={(e) => handleSelectPost(p.id, e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-500 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                              />
                            </TD>
                            <TD>{pagination.offset + i + 1}</TD>
                            <TD className="!text-center">
                              {p.totalView >= 50000 ? (
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
                                    {accountName}
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
                                      <a href={p.contentLink} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 dark:text-blue-400" style={{ color: '#2563eb' }}>
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
                                onClick={() => handleCellClick(p.id, 'campaignId', p.campaignId)}
                              >
                                {isEditing && editingCell?.field === 'campaignId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-campaignId`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'campaignId', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-campaignId`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'campaignId');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'campaignId')}
                                    autoFocus
                                  >
                                    {campaigns.map((campaign) => (
                                      <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-campaignId') ? 'opacity-50' : ''}>
                                    {campaignName !== '—' ? (
                                      <Link to={`/campaigns/${p.campaignId}`} className="hover:underline text-blue-600 dark:text-blue-400" style={{ color: '#2563eb' }}>
                                        {campaignName}
                                      </Link>
                                    ) : (
                                      campaignName
                                    )}
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
                                    {postCampaignCategoryOptions.map((cat) => (
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
                            <TD>{p.postDay}</TD>
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
                                    {p.contentCategory}
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
                                    {talentPics.map((pic) => (
                                      <option key={pic.id} value={pic.id}>{pic.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-picTalentId') ? 'opacity-50' : ''}>
                                    {picTalentName}
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
                                    {editorPics.map((pic) => (
                                      <option key={pic.id} value={pic.id}>{pic.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-picEditorId') ? 'opacity-50' : ''}>
                                    {picEditorName}
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
                                    {postingPics.map((pic) => (
                                      <option key={pic.id} value={pic.id}>{pic.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-picPostingId') ? 'opacity-50' : ''}>
                                    {picPostingName}
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
                            <TD>{(p.engagementRate * 100).toFixed(2)}%</TD>
                            <TD>
                              <div className="flex gap-1.5 justify-center">
                                <RequirePermission permission={canDeletePost}>
                                  <Button
                                    onClick={() => handleDeleteClick(p)}
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
                    disabled={pagination.offset + pagination.limit >= sortedPosts.length}
                    className="text-sm"
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

      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Post"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              color="red"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete <strong>"{deleteConfirm?.title}"</strong>?
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          This action cannot be undone. KPIs will be recalculated automatically after deletion.
          {selectedPostIds.size > 1 && ` ${selectedPostIds.size} posts will be deleted.`}
        </p>
      </Dialog>

      <Dialog
        open={!!importResult}
        onClose={() => setImportResult(null)}
        title={
          importResult?.type === 'success'
            ? 'Import Successful'
            : importResult?.type === 'error'
            ? 'Import Failed'
            : 'Import Completed with Errors'
        }
        footer={
          <Button variant="primary" color={importResult?.type === 'error' ? 'red' : 'blue'} onClick={() => setImportResult(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {importResult?.type === 'success' && (
            <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div className="text-2xl">✓</div>
              <div>
                <p className="font-semibold" style={{ color: '#10b981' }}>
                  Successfully imported {importResult.importedCount} post{importResult.importedCount !== 1 ? 's' : ''}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  All posts have been imported successfully.
                </p>
              </div>
            </div>
          )}

          {importResult?.type === 'error' && (
            <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div className="text-2xl">✗</div>
              <div>
                <p className="font-semibold" style={{ color: '#ef4444' }}>
                  Import failed
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  No posts were imported. Please fix the errors and try again.
                </p>
              </div>
            </div>
          )}

          {importResult?.type === 'partial' && (
            <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <div className="text-2xl">⚠</div>
              <div>
                <p className="font-semibold" style={{ color: '#3b82f6' }}>
                  Partial Import Success
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {importResult.importedCount} post{importResult.importedCount !== 1 ? 's' : ''} imported successfully, but {importResult.errors.length} error{importResult.errors.length !== 1 ? 's' : ''} occurred.
                </p>
              </div>
            </div>
          )}

          {importResult && importResult.errors.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Errors ({importResult.errors.length}):
              </h4>
              <div className="max-h-96 overflow-y-auto border rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th className="px-4 py-2 text-left border-b" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Row</th>
                      <th className="px-4 py-2 text-left border-b" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((error, index) => (
                      <tr key={index} className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{error.row}</td>
                        <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{error.error}</td>
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
        open={isProcessingAllPosts}
        onClose={() => {}}
        title={processingDialogTitle}
      >
        <div className="space-y-2">
          <p style={{ color: 'var(--text-secondary)' }}>{processingDialogDescription}</p>
        </div>
      </Dialog>

      {toast && (
        <div className="fixed inset-x-0 bottom-4 flex justify-center px-4 pointer-events-none z-50">
          <div
            className={`pointer-events-auto max-w-md w-full rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}
