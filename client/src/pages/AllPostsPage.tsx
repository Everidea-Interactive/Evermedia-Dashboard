import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../lib/api';
import RequirePermission from '../components/RequirePermission';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Dialog from '../components/ui/Dialog';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';
import PageHeader from '../components/PageHeader';
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
  const parsed = parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const normalizeAccountType = (value?: string) => {
  if (!value) return '';
  const normalized = value.trim().replace(/[\s-]+/g, '_').toUpperCase();
  return ACCOUNT_TYPES.includes(normalized as AccountOption['accountType']) ? (normalized as AccountOption['accountType']) : '';
};

const findPicIdByName = (value: string | undefined, pics: PicOption[]) => {
  if (!value) return undefined;
  const normalizedValue = value.trim().toLowerCase();
  return pics.find((pic) => pic.name.trim().toLowerCase() === normalizedValue)?.id;
};

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
  const [importingCsv, setImportingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectChangeInProgressRef = useRef<string | null>(null);
  const initialCellValueRef = useRef<string>('');

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

  const fetchPosts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.campaignId) params.append('campaignId', filters.campaignId);
      if (filters.accountId) params.append('accountId', filters.accountId);
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.picTalentId) params.append('picTalentId', filters.picTalentId);
      if (filters.picEditorId) params.append('picEditorId', filters.picEditorId);
      if (filters.picPostingId) params.append('picPostingId', filters.picPostingId);

      const queryString = params.toString();
      const url = `/posts/all${queryString ? `?${queryString}` : ''}`;
      const data = await api(url, { token });
      setPosts(data as Post[]);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!token) return;
    api('/campaigns', { token }).then(setCampaigns).catch(() => {});
    api('/pics?active=true', { token }).then(setPics).catch(() => {});
    api('/accounts', { token }).then(setAccounts).catch(() => {});
  }, [token]);

  const talentPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'TALENT')), [pics]);
  const editorPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'EDITOR')), [pics]);
  const postingPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'POSTING')), [pics]);

  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
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
      const currentPostIndex = posts.findIndex(p => p.id === postId);
      
      if (currentPostIndex === -1) {
        setEditingCell(null);
        return;
      }
      
      // Optimistically update the current post with the edited value for navigation
      const post = posts.find(p => p.id === postId);
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
      
      const optimisticPosts = posts.map(p => p.id === postId ? optimisticPost : p);
      
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
    setDeleteConfirm({ id: post.id, title: post.postTitle });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleting(true);
    try {
      await api(`/posts/${id}`, { method: 'DELETE', token });
      await fetchPosts();
      setToast({ type: 'success', text: 'Post deleted successfully' });
    } catch (error) {
      setToast({ type: 'error', text: (error as Error).message });
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleExportCsv = useCallback(() => {
    const csvRows = posts.map((post, index) => {
      const picTalentName = post.picTalent?.name || (post.picTalentId ? pics.find((pic) => pic.id === post.picTalentId)?.name : '') || '';
      const picEditorName = post.picEditor?.name || (post.picEditorId ? pics.find((pic) => pic.id === post.picEditorId)?.name : '') || '';
      const picPostingName = post.picPosting?.name || (post.picPostingId ? pics.find((pic) => pic.id === post.picPostingId)?.name : '') || '';
      const account = accounts.find((acc) => acc.id === post.accountId);
      const campaign = campaigns.find((c) => c.id === post.campaignId);
      return {
        no: index + 1,
        postDay: post.postDay || '',
        postDate: post.postDate ? new Date(post.postDate).toISOString().split('T')[0] : '',
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
  }, [posts, accounts, pics, campaigns]);

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
        if (account.name) {
          accountLookup.set(account.name.trim().toLowerCase(), account);
        }
      });

      const campaignLookup = new Map<string, CampaignOption>();
      campaigns.forEach((campaign) => {
        if (campaign.name) {
          campaignLookup.set(campaign.name.trim().toLowerCase(), campaign);
        }
      });

      let importedCount = 0;

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
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

        const normalizedAccountName = accountName.trim().toLowerCase();
        let account = accountLookup.get(normalizedAccountName);
        const accountType = normalizeAccountType(getCsvValue(row, headerMap, 'Tipe Akun')) || 'CROSSBRAND';
        if (!account) {
          const created = (await api('/accounts', {
            method: 'POST',
            token,
            body: {
              name: accountName.trim(),
              accountType,
            },
          })) as AccountOption;
          accountLookup.set(created.name.trim().toLowerCase(), created);
          setAccounts((prev) => [...prev, created]);
          account = created;
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

        const parsedDate = new Date(postDateValue);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new Error(`Row ${rowNumber}: Invalid post date (${postDateValue})`);
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

        const payload = {
          campaignId: campaign.id,
          accountId: account.id,
          postDate: parsedDate.toISOString(),
          picTalentId: findPicIdByName(getCsvValue(row, headerMap, 'PIC Talent'), pics),
          picEditorId: findPicIdByName(getCsvValue(row, headerMap, 'PIC Editor'), pics),
          picPostingId: findPicIdByName(getCsvValue(row, headerMap, 'PIC Posting'), pics),
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
      }

      await fetchPosts();
      setToast({ type: 'success', text: `Imported ${importedCount} posts.` });
    } catch (error) {
      setToast({ type: 'error', text: (error as Error).message });
    } finally {
      setImportingCsv(false);
      input.value = '';
    }
  };

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

      <Card className="mb-6">
        <div className="flex flex-col gap-1 mb-6">
          <div className="text-lg font-semibold">Filters</div>
          <p className="text-xs text-gray-500">Filter posts across all campaigns.</p>
        </div>
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="Campaign"
                value={filters.campaignId}
                onChange={(event) => handleFilterChange('campaignId', event.target.value)}
              >
                <option value="">All campaigns</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="Account"
                value={filters.accountId}
                onChange={(event) => handleFilterChange('accountId', event.target.value)}
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="Status"
                value={filters.status}
                onChange={(event) => handleFilterChange('status', event.target.value)}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="Content Category"
                value={filters.category}
                onChange={(event) => handleFilterChange('category', event.target.value)}
              >
                <option value="">All categories</option>
                {CONTENT_CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="PIC Talent"
                value={filters.picTalentId}
                onChange={(event) => handleFilterChange('picTalentId', event.target.value)}
              >
                <option value="">All PICs</option>
                {talentPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="PIC Editor"
                value={filters.picEditorId}
                onChange={(event) => handleFilterChange('picEditorId', event.target.value)}
              >
                <option value="">All Editors</option>
                {editorPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="PIC Posting"
                value={filters.picPostingId}
                onChange={(event) => handleFilterChange('picPostingId', event.target.value)}
              >
                <option value="">All Posting PICs</option>
                {postingPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Input
                label="Date From"
                type="date"
                value={filters.dateFrom}
                onChange={(event) => handleFilterChange('dateFrom', event.target.value)}
              />
            </div>
            <div>
              <Input
                label="Date To"
                type="date"
                value={filters.dateTo}
                onChange={(event) => handleFilterChange('dateTo', event.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
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
              }}
              variant="outline"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

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
                  disabled={posts.length === 0}
                >
                  Export CSV
                </Button>
              </div>
            </div>
            {posts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-500 text-lg">No posts found</p>
                <p className="text-gray-400 text-sm mt-2">
                  {Object.values(filters).some(f => f !== '') 
                    ? 'Try adjusting your filters to see more results.'
                    : 'There are no posts available. Import posts from CSV to get started.'}
                </p>
              </div>
            ) : (
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>NO</TH>
                      <TH>Campaign</TH>
                      <TH>Campaign Category</TH>
                      <TH>Account</TH>
                      <TH>Post Day</TH>
                      <TH>Post Date</TH>
                      <TH>Title</TH>
                      <TH>Type</TH>
                      <TH>Content Category</TH>
                      <TH>Status</TH>
                      <TH>PIC Talent</TH>
                      <TH>PIC Editor</TH>
                      <TH>PIC Posting</TH>
                      <TH>Content Link</TH>
                      <TH>Ads on Music</TH>
                      <TH>Yellow Cart</TH>
                      <TH>TOTAL VIEW</TH>
                      <TH>LIKE</TH>
                      <TH>COMMENT</TH>
                      <TH>SHARE</TH>
                      <TH>SAVED</TH>
                      <TH>Engagement Rate</TH>
                      <TH className="!text-center">Actions</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {posts.map((p, i) => {
                      const picTalentName = p.picTalent?.name || (p.picTalentId ? pics.find(pic => pic.id === p.picTalentId)?.name : null) || '—';
                      const picEditorName = p.picEditor?.name || (p.picEditorId ? pics.find(pic => pic.id === p.picEditorId)?.name : null) || '—';
                      const picPostingName = p.picPosting?.name || (p.picPostingId ? pics.find(pic => pic.id === p.picPostingId)?.name : null) || '—';
                      const accountName = p.account?.name || (p.accountId ? accounts.find(acc => acc.id === p.accountId)?.name : null) || '—';
                      const campaignName = p.campaign?.name || (p.campaignId ? campaigns.find(c => c.id === p.campaignId)?.name : null) || '—';
                      const isEditing = editingCell?.postId === p.id;
                      const isSaving = savingCell?.startsWith(`${p.id}-`);
                      const selectedCampaign = campaigns.find((c) => c.id === p.campaignId);
                      const postCampaignCategoryOptions = Array.isArray(selectedCampaign?.categories) 
                        ? selectedCampaign.categories.filter((cat) => cat).sort() 
                        : [];
                      
                      return (
                        <TR key={p.id}>
                          <TD>{i + 1}</TD>
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
                          <TD>{p.postDay}</TD>
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
        </p>
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

