import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../lib/api';
import { getApiCacheKey, getCachedValue, invalidateCacheByPrefix } from '../lib/cache';
import { formatDate } from '../lib/dateUtils';
import { shouldIgnoreRequestError } from '../lib/requestUtils';
import { Link, useLocation } from 'react-router-dom';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Toast from '../components/ui/Toast';
import RequirePermission from '../components/RequirePermission';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';

const accountCategoryOrder = ['VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR', 'YELLOW_CART'];
const categoryLabels: Record<string, string> = {
  VIEWS: 'Views',
  QTY_POST: 'Qty Post',
  FYP_COUNT: 'FYP Count',
  VIDEO_COUNT: 'Video Count',
  GMV_IDR: 'GMV (IDR)',
  YELLOW_CART: 'Yellow Cart',
};
const EMPTY_KPI = { target: 0, actual: 0 };

const statusPills: Record<string, { bg: string; border: string; text: string }> = {
  ACTIVE: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
  PLANNED: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' },
  PAUSED: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' },
  COMPLETED: { bg: 'var(--bg-tertiary)', border: 'var(--border-color)', text: 'var(--text-secondary)' },
};

const CAMPAIGN_CACHE_KEYS = {
  campaigns: getApiCacheKey('/campaigns'),
  engagement: getApiCacheKey('/campaigns/all/engagement'),
  engagementBatch: (campaignIds: string) =>
    getApiCacheKey(`/campaigns/dashboard/engagement/batch?campaignIds=${campaignIds}`),
  kpisBatch: (campaignIds: string) =>
    getApiCacheKey(`/campaigns/kpis/batch?campaignIds=${campaignIds}&accountId=null`),
};

type Campaign = {
  id: string;
  name: string;
  categories: string[];
  startDate: string;
  endDate: string;
  status: string;
  quotationNumber?: string | null;
  brandName?: string | null;
};

type EngagementSnapshot = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  projectNumbersCount?: number;
};

type Account = {
  id: string;
  name: string;
  tiktokHandle?: string;
};

// Helper function to remove leading zeros from number input
const sanitizeNumberInput = (value: string): string => {
  if (value === '' || value === '0') return value;
  // Remove leading zeros but keep the number
  const num = value.replace(/^0+/, '');
  return num === '' ? '0' : num;
};

// Helper function to format month from date
const formatMonth = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[date.getMonth()];
};

export default function CampaignsPage() {
  const { token } = useAuth();
  const { canManageCampaigns, canDelete } = usePermissions();
  const location = useLocation();
  const [items, setItems] = useState<Campaign[]>([]);
  const [allItems, setAllItems] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filters, setFilters] = useState({
    name: '',
    brandName: '',
    quotationNumber: '',
  });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const [duplicateConfirm, setDuplicateConfirm] = useState<{ id: string; name: string; newName: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [engagement, setEngagement] = useState<EngagementSnapshot | null>(null);
  const [campaignEngagementMap, setCampaignEngagementMap] = useState<Map<string, EngagementSnapshot>>(new Map());
  const [form, setForm] = useState({
    name: '',
    categories: [] as string[],
    startDate: '',
    endDate: '',
    status: 'PLANNED',
    description: '',
    accountIds: [] as string[],
    targetViewsForFYP: '',
    quotationNumber: '',
    brandName: '',
  });
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [campaignKpis, setCampaignKpis] = useState<Record<string, string>>(() =>
    Object.fromEntries(accountCategoryOrder.map((cat) => [cat, '']))
  );
  const [accountKpis, setAccountKpis] = useState<Record<string, Record<string, string>>>({});
  const [showBrandsModal, setShowBrandsModal] = useState(false);
  const [campaignKpisMap, setCampaignKpisMap] = useState<Map<string, any[]>>(new Map());
  const [selectedCampaignsForKpi, setSelectedCampaignsForKpi] = useState<string[]>([]);
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [campaignSearchTerm, setCampaignSearchTerm] = useState('');
  const [debouncedCampaignSearch, setDebouncedCampaignSearch] = useState('');
  const [kpiLoading, setKpiLoading] = useState(false);
  type SortKey = 'name' | 'startDate' | 'endDate' | 'status';
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
  });
  const previousLocationRef = useRef<string>('');
  const campaignDropdownRef = useRef<HTMLDivElement>(null);
  const refreshIdRef = useRef(0);
  const staleCheckRef = useRef(0);
  const staleCheckCooldownRef = useRef<Map<string, number>>(new Map());
  const lastStaleCheckKeyRef = useRef('');

  const clearCache = useCallback(() => {
    invalidateCacheByPrefix(CAMPAIGN_CACHE_KEYS.campaigns);
  }, []);

  const getLatestKpiUpdatedAt = useCallback((kpiMap: Map<string, any[]>) => {
    let latest = 0;
    kpiMap.forEach((kpis) => {
      (kpis || []).forEach((kpi) => {
        const timestamp = kpi?.updatedAt ? new Date(kpi.updatedAt).getTime() : 0;
        if (timestamp > latest) latest = timestamp;
      });
    });
    return latest;
  }, []);

  const getCampaignQtyPostActual = useCallback((campaignId: string) => {
    const kpis = campaignKpisMap.get(campaignId) || [];
    const qtyPostKpi = kpis.find((k: any) => !k.accountId && k.category === 'QTY_POST');
    return qtyPostKpi?.actual ?? 0;
  }, [campaignKpisMap]);

  const fetchPostCountsForCampaigns = useCallback(async (campaigns: Campaign[]) => {
    if (campaigns.length === 0) return {};
    const campaignIds = campaigns.map(c => c.id).sort().join(',');
    return api(`/campaigns/posts/counts?campaignIds=${campaignIds}`, {
      token,
      cache: { mode: 'reload' },
    });
  }, [token]);

  // Fetch KPIs for a given list of campaigns (optimized with batch endpoint and caching)
  const fetchKPIsForCampaigns = useCallback(async (
    campaigns: Campaign[],
    options: { useCache?: boolean; recalculate?: boolean } = {}
  ) => {
    const { useCache = true, recalculate = false } = options;
    if (campaigns.length === 0) return new Map<string, any[]>();
    
    const campaignIds = campaigns.map(c => c.id).sort().join(',');
    const cacheKey = CAMPAIGN_CACHE_KEYS.kpisBatch(campaignIds);
    const kpiParams = new URLSearchParams({ campaignIds, accountId: 'null' });
    if (recalculate) {
      kpiParams.set('recalculate', 'true');
    }
    
      // Try cache first
      if (useCache) {
        const cached = getCachedValue<Record<string, any[]>>(cacheKey);
        if (cached && typeof cached === 'object') {
          const kpiMap = new Map<string, any[]>();
          Object.entries(cached).forEach(([key, value]) => {
            kpiMap.set(key, Array.isArray(value) ? value : []);
          });
          return kpiMap;
        }
      }
    
    try {
      // Use batch endpoint for better performance
      const kpisByCampaign = await api(`/campaigns/kpis/batch?${kpiParams.toString()}`, {
        token,
        cache: { key: cacheKey, mode: useCache ? 'default' : 'reload' },
      });
      
      // Convert to Map and filter to campaign-level only
      const kpiMap = new Map<string, any[]>();
      Object.entries(kpisByCampaign).forEach(([campaignId, kpis]: [string, any]) => {
        const campaignLevelKpis = Array.isArray(kpis) 
          ? kpis.filter((kpi: any) => !kpi.accountId)
          : [];
        kpiMap.set(campaignId, campaignLevelKpis);
      });
      
      return kpiMap;
    } catch (error) {
      if (shouldIgnoreRequestError(error)) {
        return new Map<string, any[]>();
      }
      console.error('Failed to fetch KPIs:', error);
      // Fallback to individual requests if batch fails
      const kpiMap = new Map<string, any[]>();
      const kpiPromises = campaigns.map(async (campaign: Campaign) => {
        try {
          const kpiPath = recalculate
            ? `/campaigns/${campaign.id}/kpis?accountId=null&recalculate=true`
            : `/campaigns/${campaign.id}/kpis?accountId=null`;
          const kpis = await api(kpiPath, {
            token,
            cache: { mode: useCache ? 'default' : 'reload' },
          });
          kpiMap.set(campaign.id, Array.isArray(kpis) ? kpis.filter((k: any) => !k.accountId) : []);
        } catch (err) {
          if (shouldIgnoreRequestError(err)) {
            kpiMap.set(campaign.id, []);
            return;
          }
          console.error(`Failed to fetch KPIs for campaign ${campaign.id}:`, err);
          kpiMap.set(campaign.id, []);
        }
      });
      await Promise.allSettled(kpiPromises);
      return kpiMap;
    }
  }, [token]);

  const mergeCampaignKpisMap = useCallback((incoming: Map<string, any[]>) => {
    setCampaignKpisMap((prev) => {
      if (prev.size === 0) return incoming;
      const merged = new Map(prev);
      incoming.forEach((value, key) => {
        merged.set(key, value);
      });
      return merged;
    });
  }, []);

  const mergeCampaignEngagementMap = useCallback((incoming: Map<string, EngagementSnapshot>) => {
    setCampaignEngagementMap((prev) => {
      if (prev.size === 0) return incoming;
      const merged = new Map(prev);
      incoming.forEach((value, key) => {
        merged.set(key, value);
      });
      return merged;
    });
  }, []);

  const fetchEngagementForCampaigns = useCallback(async (
    campaigns: Campaign[],
    useCache = true
  ) => {
    if (campaigns.length === 0) return new Map<string, EngagementSnapshot>();
    const campaignIds = campaigns.map(c => c.id).sort().join(',');
    const cacheKey = CAMPAIGN_CACHE_KEYS.engagementBatch(campaignIds);

    if (useCache) {
      const cached = getCachedValue<Record<string, EngagementSnapshot>>(cacheKey);
      if (cached && typeof cached === 'object') {
        const engagementMap = new Map<string, EngagementSnapshot>();
        Object.entries(cached).forEach(([key, value]) => {
          if (value) engagementMap.set(key, value);
        });
        return engagementMap;
      }
    }

    try {
      const response = await api(`/campaigns/dashboard/engagement/batch?campaignIds=${campaignIds}`, {
        token,
        cache: { key: cacheKey, mode: useCache ? 'default' : 'reload' },
      });
      const engagementMap = new Map<string, EngagementSnapshot>();
      Object.entries(response || {}).forEach(([campaignId, value]) => {
        if (value) engagementMap.set(campaignId, value as EngagementSnapshot);
      });
      return engagementMap;
    } catch (error) {
      if (shouldIgnoreRequestError(error)) {
        return new Map<string, EngagementSnapshot>();
      }
      console.error('Failed to fetch campaign engagement batch:', error);
      return new Map<string, EngagementSnapshot>();
    }
  }, [token]);

  const loadKpisForCampaigns = useCallback(async (
    campaigns: Campaign[],
    useCache = false,
    replace = true
  ) => {
    if (campaigns.length === 0) return;
    setKpiLoading(true);
    try {
      const kpiMap = await fetchKPIsForCampaigns(campaigns, { useCache, recalculate: false });
      if (replace) {
        setCampaignKpisMap(kpiMap);
      } else {
        mergeCampaignKpisMap(kpiMap);
      }
    } finally {
      setKpiLoading(false);
    }
  }, [fetchKPIsForCampaigns, mergeCampaignKpisMap]);

  // Refresh KPIs for currently loaded campaigns (forces recalculation)
  const refreshKpisForCampaigns = useCallback(async (campaigns: Campaign[]) => {
    if (campaigns.length === 0) return;
    const refreshId = refreshIdRef.current + 1;
    refreshIdRef.current = refreshId;
    const delays = [2000, 6000];
    setKpiLoading(true);
    try {
      // Always bypass cache so KPI recalculation runs on refresh/visibility changes
      const kpiMap = await fetchKPIsForCampaigns(campaigns, { useCache: false, recalculate: true });
      if (refreshId !== refreshIdRef.current) return;
      mergeCampaignKpisMap(kpiMap);
      const initialUpdatedAt = getLatestKpiUpdatedAt(kpiMap);

      const pollForUpdates = (attempt: number, lastUpdatedAt: number) => {
        if (attempt >= delays.length) {
          setKpiLoading(false);
          return;
        }
        setTimeout(async () => {
          if (refreshId !== refreshIdRef.current) return;
          try {
            const refreshedMap = await fetchKPIsForCampaigns(campaigns, { useCache: false });
            if (refreshId !== refreshIdRef.current) return;
            mergeCampaignKpisMap(refreshedMap);
            const nextUpdatedAt = getLatestKpiUpdatedAt(refreshedMap);
            if (nextUpdatedAt > lastUpdatedAt) {
              setKpiLoading(false);
              return;
            }
            pollForUpdates(attempt + 1, nextUpdatedAt);
          } catch (error) {
            if (refreshId === refreshIdRef.current) {
              setKpiLoading(false);
            }
          }
        }, delays[attempt]);
      };

      pollForUpdates(0, initialUpdatedAt);
    } catch (error) {
      if (refreshId === refreshIdRef.current) {
        setKpiLoading(false);
      }
    }
  }, [fetchKPIsForCampaigns, getLatestKpiUpdatedAt]);

  const fetchKPIs = useCallback(async () => {
    await loadKpisForCampaigns(allItems, false);
  }, [allItems, loadKpisForCampaigns]);

  // Fetch campaigns only (no KPIs) with caching
  const fetchCampaigns = useCallback(async (useCache = true) => {
    // Try cache first
    if (useCache) {
      const cached = getCachedValue<Campaign[]>(CAMPAIGN_CACHE_KEYS.campaigns);
      if (cached) {
        setAllItems(cached);
        return cached;
      }
    }
    
    try {
      const data = await api('/campaigns', {
        token,
        cache: { key: CAMPAIGN_CACHE_KEYS.campaigns, mode: useCache ? 'default' : 'reload' },
      });
      setAllItems(data);
      return data;
    } catch (error) {
      if (shouldIgnoreRequestError(error)) {
        return [];
      }
      console.error('Failed to fetch campaigns:', error);
      setAllItems([]);
      return [];
    }
  }, [token]);

  // Fetch all data: campaigns, KPIs, and engagement stats with optimistic loading
  const fetchAllData = useCallback(async () => {
    // Try to load from cache first for instant display
    const cachedCampaigns = getCachedValue<Campaign[]>(CAMPAIGN_CACHE_KEYS.campaigns);
    const cachedEngagement = getCachedValue<EngagementSnapshot>(CAMPAIGN_CACHE_KEYS.engagement);
    
    if (cachedCampaigns) {
      setAllItems(cachedCampaigns);
      // Try to load cached KPIs
      const cachedKpis = getCachedValue<Record<string, any[]>>(
        CAMPAIGN_CACHE_KEYS.kpisBatch(cachedCampaigns.map((c: Campaign) => c.id).sort().join(','))
      );
      if (cachedKpis && typeof cachedKpis === 'object') {
        const kpiMap = new Map<string, any[]>();
        Object.entries(cachedKpis).forEach(([key, value]) => {
          kpiMap.set(key, Array.isArray(value) ? value : []);
        });
        setCampaignKpisMap(kpiMap);
      }
    }
    
    if (cachedEngagement) {
      setEngagement(cachedEngagement);
    }
    
    const engagementPromise = api('/campaigns/all/engagement', {
      token,
      cache: { key: CAMPAIGN_CACHE_KEYS.engagement, mode: 'reload' },
    }).catch((error) => {
      if (!shouldIgnoreRequestError(error)) {
        console.error('Failed to fetch engagement:', error);
      }
      return null;
    });

    setLoading(true);
    let campaignsList: Campaign[] = [];
    try {
      campaignsList = await fetchCampaigns(false); // Skip cache, fetch fresh
    } catch (error) {
      if (shouldIgnoreRequestError(error)) {
        return;
      }
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setLoading(false);
    }

    void engagementPromise.then((data) => {
      if (data) {
        setEngagement(data);
      }
    });

    if (campaignsList.length > 0) {
      void loadKpisForCampaigns(campaignsList, false);
    }
  }, [token, fetchCampaigns, loadKpisForCampaigns]);

  // Calculate engagement stats from campaign-level KPIs (to match KPI Overview exactly)
  // Views come from campaign-level KPIs, other metrics from engagement API
  const calculatedEngagement = useMemo(() => {
    const campaignsToUse = allItems; // Always use all campaigns for engagement stats

    // Calculate views from campaign-level KPIs (same source as KPI Overview)
    let totalViews = 0;
    campaignsToUse.forEach(campaign => {
      const kpis = campaignKpisMap.get(campaign.id) || [];
      const campaignLevelKpis = kpis.filter((kpi: any) => !kpi.accountId);
      const viewsKpi = campaignLevelKpis.find((k: any) => k.category === 'VIEWS');
      if (viewsKpi) {
        totalViews += viewsKpi.actual || 0;
      }
    });

    // Use engagement state for other metrics (likes, comments, shares, saves)
    // but override views with the calculated value from KPIs
    const baseEngagement = engagement || {
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      engagementRate: 0,
      projectNumbersCount: allItems.length,
    };

    const totalEngagement = baseEngagement.likes + baseEngagement.comments + baseEngagement.shares + baseEngagement.saves;
    const engagementRate = totalViews === 0 ? 0 : Number((totalEngagement / totalViews).toFixed(4));

    return {
      views: totalViews, // From campaign-level KPIs (matches KPI Overview)
      likes: baseEngagement.likes,
      comments: baseEngagement.comments,
      shares: baseEngagement.shares,
      saves: baseEngagement.saves,
      engagementRate,
      projectNumbersCount: allItems.length,
    };
  }, [allItems, campaignKpisMap, engagement]);

  const applyFilters = useCallback((campaigns: Campaign[]) => {
    const filtered = campaigns.filter((c) => {
      // Filter by campaign name
      if (filters.name.trim()) {
        const nameLower = filters.name.toLowerCase();
        if (!c.name.toLowerCase().includes(nameLower)) return false;
      }

      // Filter by brand name
      if (filters.brandName) {
        if (!c.brandName || c.brandName.trim().toLowerCase() !== filters.brandName.toLowerCase()) {
          return false;
        }
      }

      // Filter by quotation number
      if (filters.quotationNumber.trim()) {
        const quotationLower = filters.quotationNumber.toLowerCase();
        if (!c.quotationNumber || !c.quotationNumber.toLowerCase().includes(quotationLower)) {
          return false;
        }
      }

      return true;
    });

    setItems(filtered);
  }, [filters]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      // Default direction: ascending for text fields, descending for dates
      if (key === 'startDate' || key === 'endDate') {
        return { key, direction: 'desc' };
      }
      return { key, direction: 'asc' };
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items;
    const { key, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      let aValue: string = '';
      let bValue: string = '';

      if (key === 'name') {
        aValue = a.name || '';
        bValue = b.name || '';
      } else if (key === 'status') {
        aValue = a.status || '';
        bValue = b.status || '';
      } else if (key === 'startDate') {
        aValue = a.startDate || '';
        bValue = b.startDate || '';
      } else if (key === 'endDate') {
        aValue = a.endDate || '';
        bValue = b.endDate || '';
      }

      // For dates, compare by timestamp when possible
      if (key === 'startDate' || key === 'endDate') {
        const aTime = aValue ? new Date(aValue).getTime() : 0;
        const bTime = bValue ? new Date(bValue).getTime() : 0;
        if (aTime === bTime) return 0;
        return aTime > bTime ? multiplier : -multiplier;
      }

      return aValue.localeCompare(bValue, undefined, { sensitivity: 'base' }) * multiplier;
    });
  }, [items, sortConfig]);

  const campaignKpiSummary = useMemo(() => {
    const summary = new Map<string, { views: { target: number; actual: number }; qtyPost: { target: number; actual: number }; fypCount: { target: number; actual: number } }>();
    campaignKpisMap.forEach((kpis, campaignId) => {
      const kpiTotals = new Map<string, { target: number; actual: number }>();
      kpis
        .filter((k: any) => !k.accountId)
        .forEach((k: any) => {
          const existing = kpiTotals.get(k.category) ?? { target: 0, actual: 0 };
          kpiTotals.set(k.category, {
            target: existing.target + (k.target ?? 0),
            actual: existing.actual + (k.actual ?? 0),
          });
        });
      summary.set(campaignId, {
        views: kpiTotals.get('VIEWS') ?? EMPTY_KPI,
        qtyPost: kpiTotals.get('QTY_POST') ?? EMPTY_KPI,
        fypCount: kpiTotals.get('FYP_COUNT') ?? EMPTY_KPI,
      });
    });
    return summary;
  }, [campaignKpisMap]);

  const paginatedItems = useMemo(() => {
    const start = pagination.offset;
    const end = start + pagination.limit;
    return sortedItems.slice(start, end);
  }, [sortedItems, pagination]);

  const totalPages = Math.ceil(sortedItems.length / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const renderSortIndicator = (key: SortKey) => {
    const isActive = !!sortConfig && sortConfig.key === key;
    const indicator = isActive
      ? (sortConfig!.direction === 'asc' ? '▲' : '▼')
      : '↕';

    return (
      <span className={`text-xs ${isActive ? 'text-emerald-600' : 'opacity-40'}`}>
        {indicator}
      </span>
    );
  };

  // Initial data load - fetch campaigns, KPIs, and engagement in parallel
  useEffect(() => {
    fetchAllData();
  }, [token, fetchAllData]);

  useEffect(() => {
    applyFilters(allItems);
  }, [filters, allItems, applyFilters]);

  useEffect(() => {
    if (sortedItems.length === 0) {
      if (pagination.offset !== 0) {
        setPagination(prev => ({ ...prev, offset: 0 }));
      }
      return;
    }
    const maxOffset = Math.max(0, Math.floor((sortedItems.length - 1) / pagination.limit) * pagination.limit);
    if (pagination.offset > maxOffset) {
      setPagination(prev => ({ ...prev, offset: maxOffset }));
    }
  }, [sortedItems.length, pagination.limit, pagination.offset]);

  useEffect(() => {
    if (paginatedItems.length === 0) return;
    if (kpiLoading) return;
    const hasKpis = paginatedItems.every((campaign) => campaignKpisMap.has(campaign.id));
    if (!hasKpis) return;

    const kpiUpdatedAtKey = paginatedItems
      .map((campaign) => {
        const kpis = campaignKpisMap.get(campaign.id) || [];
        const latest = kpis.reduce((max: number, kpi: any) => {
          const timestamp = kpi?.updatedAt ? new Date(kpi.updatedAt).getTime() : 0;
          return timestamp > max ? timestamp : max;
        }, 0);
        return `${campaign.id}:${latest}`;
      })
      .join('|');
    const visibleIdsKey = paginatedItems.map((campaign) => campaign.id).sort().join(',');
    const checkKey = `${visibleIdsKey}|${kpiUpdatedAtKey}`;
    if (checkKey === lastStaleCheckKeyRef.current) return;
    lastStaleCheckKeyRef.current = checkKey;

    const requestId = staleCheckRef.current + 1;
    staleCheckRef.current = requestId;

    void (async () => {
      try {
        const counts = await fetchPostCountsForCampaigns(paginatedItems);
        if (staleCheckRef.current !== requestId) return;
        const now = Date.now();
        const staleCampaigns = paginatedItems.filter((campaign) => {
          const count = counts?.[campaign.id];
          if (typeof count !== 'number') return false;
          const actual = getCampaignQtyPostActual(campaign.id);
          if (count === actual) return false;
          const lastAttempt = staleCheckCooldownRef.current.get(campaign.id) ?? 0;
          if (now - lastAttempt < 30000) return false;
          return true;
        });

        if (staleCampaigns.length > 0) {
          staleCampaigns.forEach((campaign) => staleCheckCooldownRef.current.set(campaign.id, now));
          void refreshKpisForCampaigns(staleCampaigns);
        }
      } catch (error) {
        if (!shouldIgnoreRequestError(error)) {
          console.error('Failed to check KPI freshness:', error);
        }
      }
    })();
  }, [
    paginatedItems,
    kpiLoading,
    campaignKpisMap,
    fetchPostCountsForCampaigns,
    getCampaignQtyPostActual,
    refreshKpisForCampaigns,
  ]);

  useEffect(() => {
    if (paginatedItems.length === 0) return;
    const missingEngagement = paginatedItems.filter((campaign) => !campaignEngagementMap.has(campaign.id));
    if (missingEngagement.length === 0) return;

    void (async () => {
      const engagementMap = await fetchEngagementForCampaigns(missingEngagement, true);
      if (engagementMap.size > 0) {
        mergeCampaignEngagementMap(engagementMap);
      }
    })();
  }, [paginatedItems, campaignEngagementMap, fetchEngagementForCampaigns, mergeCampaignEngagementMap]);

  useEffect(() => {
    api('/accounts', { token }).then(setAccounts).catch(() => setAccounts([]));
  }, [token]);

  // Refresh KPIs when navigating back to campaigns page from detail page
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousLocationRef.current;
    
    // If we're on the campaigns page and came from a campaign detail page, refresh KPIs
    if (currentPath === '/campaigns' || currentPath === '/') {
      if (previousPath && previousPath.startsWith('/campaigns/') && previousPath !== currentPath) {
        fetchKPIs();
      }
    }
    
    previousLocationRef.current = currentPath;
  }, [location.pathname, fetchKPIs]);

  // Refresh KPIs when page becomes visible (user switches back to tab/window)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && allItems.length > 0) {
        fetchKPIs();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [allItems.length, fetchKPIs]);

  // Debounce campaign search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCampaignSearch(campaignSearchTerm), 120);
    return () => clearTimeout(timer);
  }, [campaignSearchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (campaignDropdownRef.current && !campaignDropdownRef.current.contains(event.target as Node)) {
        setShowCampaignDropdown(false);
      }
    };

    if (showCampaignDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCampaignDropdown]);

  // Filter campaigns based on search term
  const filteredCampaignsForKpi = useMemo(() => {
    const query = debouncedCampaignSearch.trim().toLowerCase();
    if (!query) {
      return allItems;
    }
    return allItems.filter(campaign => 
      campaign.name.toLowerCase().includes(query)
    );
  }, [allItems, debouncedCampaignSearch]);

  useEffect(() => {
    // Extract unique categories from all campaigns
    const allCategories = new Set<string>();
    allItems.forEach(campaign => {
      if (campaign.categories && Array.isArray(campaign.categories)) {
        campaign.categories.forEach(cat => allCategories.add(cat));
      }
    });
    setAvailableCategories(Array.from(allCategories).sort());
  }, [allItems]);

  const getUniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    allItems.forEach(campaign => {
      if (campaign.brandName && campaign.brandName.trim()) {
        brands.add(campaign.brandName.trim());
      }
    });
    return Array.from(brands).sort();
  }, [allItems]);

  // Calculate aggregated KPIs for selected campaigns (or all if none selected)
  const aggregatedKpis = useMemo(() => {
    const campaignsToAggregate = selectedCampaignsForKpi.length > 0
      ? allItems.filter(c => selectedCampaignsForKpi.includes(c.id))
      : allItems;

    const kpiTotals = new Map<string, { target: number; actual: number }>();

    campaignsToAggregate.forEach(campaign => {
      const kpis = campaignKpisMap.get(campaign.id) || [];
      // Ensure only campaign-level KPIs are used (accountId is null or undefined)
      const campaignLevelKpis = kpis.filter((kpi: any) => !kpi.accountId);
      campaignLevelKpis.forEach((kpi: any) => {
        const existing = kpiTotals.get(kpi.category) ?? { target: 0, actual: 0 };
        kpiTotals.set(kpi.category, {
          target: existing.target + (kpi.target ?? 0),
          actual: existing.actual + (kpi.actual ?? 0),
        });
      });
    });

    return {
      views: kpiTotals.get('VIEWS') ?? { target: 0, actual: 0 },
      qtyPost: kpiTotals.get('QTY_POST') ?? { target: 0, actual: 0 },
      fypCount: kpiTotals.get('FYP_COUNT') ?? { target: 0, actual: 0 },
      gmv: kpiTotals.get('GMV_IDR') ?? { target: 0, actual: 0 },
    };
  }, [selectedCampaignsForKpi, allItems, campaignKpisMap]);

  const handleClearFilters = () => {
    setFilters({
      name: '',
      brandName: '',
      quotationNumber: '',
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const handleRowsPerPageChange = (newLimit: number) => {
    setPagination({ limit: newLimit, offset: 0 });
  };

  const resetForm = () => {
    setForm({
      name: '',
      categories: [],
      startDate: '',
      endDate: '',
      status: 'PLANNED',
      description: '',
      accountIds: [],
      targetViewsForFYP: '',
      quotationNumber: '',
      brandName: '',
    });
    setSelectedAccount('');
    setNewCategory('');
    setCampaignKpis(Object.fromEntries(accountCategoryOrder.map((cat) => [cat, ''])));
    setAccountKpis({});
  };

  const handleAddCampaign = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.name.trim()) {
      setToast({ message: 'Campaign name is required', type: 'error' });
      return;
    }
    if (!form.brandName.trim()) {
      setToast({ message: 'Brand name is required', type: 'error' });
      return;
    }
    if (!form.startDate) {
      setToast({ message: 'Start date is required', type: 'error' });
      return;
    }
    if (!form.endDate) {
      setToast({ message: 'End date is required', type: 'error' });
      return;
    }
    if (!form.targetViewsForFYP || form.targetViewsForFYP === '' || Number(form.targetViewsForFYP) < 0) {
      setToast({ message: 'Target Views for FYP is required and must be 0 or greater', type: 'error' });
      return;
    }
    // Validate all campaign KPIs are filled
    for (const cat of accountCategoryOrder) {
      if (!campaignKpis[cat] || campaignKpis[cat] === '' || Number(campaignKpis[cat]) < 0) {
        setToast({ message: `Target for ${categoryLabels[cat]} is required and must be 0 or greater`, type: 'error' });
        return;
      }
    }
    setSubmitting(true);
    try {
      // Create the campaign
      const campaign = await api('/campaigns', {
        method: 'POST',
        token,
        body: {
          name: form.name.trim(),
          categories: form.categories,
          startDate: form.startDate,
          endDate: form.endDate,
          status: form.status,
          description: form.description || undefined,
          accountIds: form.accountIds.length > 0 ? form.accountIds : undefined,
          targetViewsForFYP: Number(form.targetViewsForFYP),
          quotationNumber: form.quotationNumber.trim() || null,
          brandName: form.brandName.trim(),
        },
      });

      // Create campaign-level KPIs (no accountId) - all are required
      const campaignKpiPromises = accountCategoryOrder.map(cat =>
        api('/kpis', {
          method: 'POST',
          token,
          body: {
            campaignId: campaign.id,
            category: cat,
            target: Number(campaignKpis[cat]),
          },
        })
      );

      // Create account-level KPIs
      const accountKpiPromises = form.accountIds.flatMap(accountId => {
        const accountKpiData = accountKpis[accountId] || {};
        return accountCategoryOrder
          .filter(cat => accountKpiData[cat] && accountKpiData[cat].trim() !== '')
          .map(cat => {
            const targetStr = accountKpiData[cat];
            // Allow 0 as a valid value
            const targetValue = targetStr === '' || targetStr === undefined 
              ? 0 
              : Number(targetStr);
            return api('/kpis', {
              method: 'POST',
              token,
              body: {
                campaignId: campaign.id,
                accountId: accountId,
                category: cat,
                target: isNaN(targetValue) || targetValue < 0 ? 0 : targetValue,
              },
            });
          });
      });

      // Wait for all KPIs to be created
      await Promise.all([...campaignKpiPromises, ...accountKpiPromises]);

      resetForm();
      setShowAddForm(false);
      // Clear cache and refresh all data after adding campaign
      clearCache();
      fetchAllData();
      setToast({ message: 'Campaign and KPIs added successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.error || 'Failed to add campaign', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicateClick = (campaign: Campaign) => {
    setDuplicateConfirm({
      id: campaign.id,
      name: campaign.name,
      newName: `${campaign.name} (Copy)`,
    });
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicateConfirm) return;
    const { id, newName } = duplicateConfirm;
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setToast({ message: 'Campaign name is required', type: 'error' });
      return;
    }
    setDuplicatingIds(prev => new Set(prev).add(id));
    setDuplicateConfirm(null);
    try {
      const duplicated = await api(`/campaigns/${id}/duplicate`, {
        method: 'POST',
        token,
        body: { name: trimmedName },
      });
      clearCache();
      fetchAllData();
      setToast({ message: `Campaign duplicated as "${duplicated?.name || trimmedName}"`, type: 'success' });
    } catch (error: any) {
      const errorMessage = error?.error || error?.message || 'Failed to duplicate campaign';
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setDuplicatingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeletingIds(prev => new Set(prev).add(id));
    setDeleteConfirm(null);
    try {
      await api(`/campaigns/${id}`, { method: 'DELETE', token });
      // Clear cache and refresh all data after deleting campaign
      clearCache();
      fetchAllData();
      setToast({ message: 'Campaign deleted successfully', type: 'success' });
    } catch (error: any) {
      const errorMessage = error?.error || error?.message || 'Failed to delete campaign';
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const hasCampaignFilters = Boolean(
    filters.name.trim() ||
    filters.brandName ||
    filters.quotationNumber.trim()
  );

  return (
    <div>
      <div className="mb-4">
        <h1 className="page-title">Campaigns</h1>
      </div>
      
      {/* Engagement Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Card>
          <div className="section-title text-xs sm:text-sm">Project Numbers</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{calculatedEngagement.projectNumbersCount.toLocaleString()}</div>
        </Card>
        <Card 
          className="cursor-pointer transition-opacity hover:opacity-80"
          onClick={() => setShowBrandsModal(true)}
        >
          <div className="section-title text-xs sm:text-sm">Unique Brand</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">
            {getUniqueBrands.length}
          </div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Views</div>
          <div className="mt-1 text-lg sm:text-xl md:text-lg lg:text-2xl font-semibold break-words">{calculatedEngagement.views.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Likes</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{calculatedEngagement.likes.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Comments</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{calculatedEngagement.comments.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Shares</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{calculatedEngagement.shares.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Saved</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{calculatedEngagement.saves.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Engagement Rate</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{calculatedEngagement.engagementRate ? (calculatedEngagement.engagementRate * 100).toFixed(2) + '%' : '-'}</div>
        </Card>
      </div>

      {/* Campaign Filter for KPI Overview */}
      {allItems.length > 0 && (
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>KPI Overview</h2>
          <div className="relative w-full sm:w-auto sm:inline-block" ref={campaignDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setShowCampaignDropdown(!showCampaignDropdown);
                if (!showCampaignDropdown) {
                  setCampaignSearchTerm('');
                }
              }}
              className="w-full sm:w-auto text-xs py-1 px-2 rounded-lg border transition-colors flex items-center gap-1.5"
              style={{ 
                color: 'var(--text-primary)', 
                borderColor: 'var(--border-color-dark)',
                backgroundColor: 'var(--bg-secondary)',
                minWidth: '160px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
            >
              <span className="flex-1 text-left truncate">
                {selectedCampaignsForKpi.length === 0 
                  ? 'All Campaign' 
                  : `${selectedCampaignsForKpi.length} campaign${selectedCampaignsForKpi.length > 1 ? 's' : ''} selected`}
              </span>
              <span className="flex-shrink-0">{showCampaignDropdown ? '▲' : '▼'}</span>
            </button>
            {showCampaignDropdown && (
              <div 
                className="absolute z-20 mt-1 w-full sm:w-auto border rounded-lg shadow-lg"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color-dark)',
                  minWidth: '160px'
                }}
              >
                {/* Search Input */}
                <div className="p-2 border-b" style={{ borderColor: 'var(--border-color-dark)' }}>
                  <input
                    type="text"
                    className="w-full text-xs py-1.5 px-2 rounded border"
                    style={{ 
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderColor: 'var(--border-color-dark)'
                    }}
                    placeholder="Search campaigns..."
                    value={campaignSearchTerm}
                    onChange={(e) => {
                      setCampaignSearchTerm(e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                {/* Campaign List */}
                <div className="max-h-64 overflow-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCampaignsForKpi([]);
                      setCampaignSearchTerm('');
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs transition-colors flex items-center gap-1.5"
                    style={{ 
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span className="w-3 text-center flex-shrink-0 text-xs">{selectedCampaignsForKpi.length === 0 ? '✓' : ''}</span>
                    <span className="truncate">All Campaign</span>
                  </button>
                  {filteredCampaignsForKpi.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      No campaigns found
                    </div>
                  ) : (
                    filteredCampaignsForKpi.map(campaign => {
                      const isSelected = selectedCampaignsForKpi.includes(campaign.id);
                      return (
                        <button
                          key={campaign.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCampaignsForKpi(prev => prev.filter(id => id !== campaign.id));
                            } else {
                              setSelectedCampaignsForKpi(prev => [...prev, campaign.id]);
                            }
                          }}
                          className="w-full text-left px-2 py-1.5 text-xs transition-colors flex items-center gap-1.5"
                          style={{ color: 'var(--text-primary)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <span className="w-3 text-center flex-shrink-0 text-xs">{isSelected ? '✓' : ''}</span>
                          <span className="truncate">{campaign.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Card>
          <div className="flex items-center gap-1.5">
            <div className="section-title text-xs sm:text-sm">Views</div>
            {kpiLoading && (
              <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-500" aria-hidden="true"></span>
            )}
          </div>
          <div className="mt-1 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-semibold leading-tight">
            {aggregatedKpis.views.actual.toLocaleString()}/{aggregatedKpis.views.target.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-1.5">
            <div className="section-title text-xs sm:text-sm">Posts</div>
            {kpiLoading && (
              <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-500" aria-hidden="true"></span>
            )}
          </div>
          <div className="mt-1 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-semibold leading-tight">
            {aggregatedKpis.qtyPost.actual.toLocaleString()}/{aggregatedKpis.qtyPost.target.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-1.5">
            <div className="section-title text-xs sm:text-sm">FYP</div>
            {kpiLoading && (
              <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-500" aria-hidden="true"></span>
            )}
          </div>
          <div className="mt-1 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-semibold leading-tight">
            {aggregatedKpis.fypCount.actual.toLocaleString()}/{aggregatedKpis.fypCount.target.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-1.5">
            <div className="section-title text-xs sm:text-sm">GMV (IDR)</div>
            {kpiLoading && (
              <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-500" aria-hidden="true"></span>
            )}
          </div>
          <div className="mt-1 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-semibold leading-tight">
            {aggregatedKpis.gmv.actual.toLocaleString()}/{aggregatedKpis.gmv.target.toLocaleString()}
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-inner-table">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 sm:gap-3 mb-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 w-full">
              <Input
                label={<span className="text-xs">Campaign Name</span>}
                value={filters.name}
                onChange={e => handleFilterChange('name', e.target.value)}
                placeholder="Search by name..."
                className="text-sm py-1.5"
              />
              <Select 
                label={<span className="text-xs">Brand Name</span>}
                value={filters.brandName} 
                onChange={e => handleFilterChange('brandName', e.target.value)}
                className="text-sm py-1.5"
              >
                <option value="">All Brands</option>
                {getUniqueBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </Select>
              <Input
                label={<span className="text-xs">Quotation Number</span>}
                value={filters.quotationNumber}
                onChange={e => handleFilterChange('quotationNumber', e.target.value)}
                placeholder="Search by quotation..."
                className="text-sm py-1.5"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" onClick={handleClearFilters} className="text-sm py-1 px-2">
                Reset Filters
              </Button>
              <RequirePermission permission={canManageCampaigns}>
                <Button variant="primary" color="green" onClick={() => setShowAddForm(true)} className="text-sm py-1 px-2">
                  Add Campaign
                </Button>
              </RequirePermission>
            </div>
          </div>
          {loading && sortedItems.length === 0 ? (
            <div className="skeleton h-10 w-full" />
          ) : sortedItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 text-lg">No campaigns found</p>
              <p className="text-gray-400 text-sm mt-2">
                {hasCampaignFilters
                  ? 'Try adjusting your filters to see more results.'
                  : 'There are no campaigns available. Add a campaign to get started.'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, sortedItems.length)} of {sortedItems.length}
                  {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                  {loading ? ' - Refreshing...' : kpiLoading ? ' - Updating KPIs...' : ''}
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
                      <TH>
                        <button
                          type="button"
                          onClick={() => handleSort('name')}
                          className="flex items-center gap-1 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                        >
                          <span>Name</span>
                          {renderSortIndicator('name')}
                        </button>
                      </TH>
                      <TH>KPI Overview</TH>
                      <TH>Period</TH>
                      <TH>
                        <button
                          type="button"
                          onClick={() => handleSort('startDate')}
                          className="flex items-center gap-1 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                        >
                          <span>Start</span>
                          {renderSortIndicator('startDate')}
                        </button>
                      </TH>
                      <TH>
                        <button
                          type="button"
                          onClick={() => handleSort('endDate')}
                          className="flex items-center gap-1 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                        >
                          <span>End</span>
                          {renderSortIndicator('endDate')}
                        </button>
                      </TH>
                      <TH>
                        <button
                          type="button"
                          onClick={() => handleSort('status')}
                          className="flex items-center gap-1 cursor-pointer select-none hover:text-emerald-600 transition-colors"
                        >
                          <span>Status</span>
                          {renderSortIndicator('status')}
                        </button>
                      </TH>
                      <TH className="!text-center">Actions</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {paginatedItems.map((c) => {
                      const kpiSummary = campaignKpiSummary.get(c.id);
                      const viewsKpi = kpiSummary?.views ?? EMPTY_KPI;
                      const qtyPostKpi = kpiSummary?.qtyPost ?? EMPTY_KPI;
                      const fypCountKpi = kpiSummary?.fypCount ?? EMPTY_KPI;
                      const engagementRate = campaignEngagementMap.get(c.id)?.engagementRate;
                      const engagementRateLabel = typeof engagementRate === 'number'
                        ? `${(engagementRate * 100).toFixed(2)}%`
                        : '-';
                      
                      return (
                        <TR key={c.id}>
                          <TD><Link to={`/campaigns/${c.id}`} className="hover:underline font-medium transition-colors" style={{ color: '#2563eb' }}>{c.name}</Link></TD>
                          <TD>
                            <div className="flex items-center gap-2 flex-nowrap">
                              <div className="rounded-lg border px-2 py-1.5 text-center min-w-[70px]" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                                <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>VIEWS</div>
                                <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{viewsKpi.actual.toLocaleString()}/{viewsKpi.target.toLocaleString()}</div>
                              </div>
                              <div className="rounded-lg border px-2 py-1.5 text-center min-w-[70px]" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                                <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>QTY POST</div>
                                <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{qtyPostKpi.actual.toLocaleString()}/{qtyPostKpi.target.toLocaleString()}</div>
                              </div>
                              <div className="rounded-lg border px-2 py-1.5 text-center min-w-[70px]" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                                <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>FYP COUNT</div>
                                <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{fypCountKpi.actual.toLocaleString()}/{fypCountKpi.target.toLocaleString()}</div>
                              </div>
                              <div className="rounded-lg border px-2 py-1.5 text-center min-w-[70px]" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                                <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>ER</div>
                                <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{engagementRateLabel}</div>
                              </div>
                            </div>
                          </TD>
                          <TD>{formatMonth(c.startDate)}</TD>
                          <TD>{formatDate(c.startDate)}</TD>
                          <TD>{formatDate(c.endDate)}</TD>
                          <TD>
                            <span 
                              className="badge border" 
                              style={statusPills[c.status] ? {
                                backgroundColor: statusPills[c.status].bg,
                                borderColor: statusPills[c.status].border,
                                color: statusPills[c.status].text
                              } : {}}
                            >
                              {c.status}
                            </span>
                          </TD>
                          <TD>
                            <div className="flex gap-1.5 justify-center">
                              <Link to={`/campaigns/${c.id}`} className="btn btn-outline-blue text-xs px-1.5 py-0.5">
                                View
                              </Link>
                              <RequirePermission permission={canManageCampaigns}>
                                <Button
                                  variant="outline"
                                  color="green"
                                  onClick={() => handleDuplicateClick(c)}
                                  disabled={duplicatingIds.has(c.id)}
                                  className="text-xs px-1.5 py-0.5"
                                >
                                  {duplicatingIds.has(c.id) ? 'Duplicating...' : 'Duplicate'}
                                </Button>
                              </RequirePermission>
                              <RequirePermission permission={canDelete}>
                                <Button
                                  variant="outline"
                                  color="red"
                                  onClick={() => handleDeleteClick(c.id, c.name)}
                                  disabled={deletingIds.has(c.id)}
                                  className="text-xs px-1.5 py-0.5"
                                >
                                  {deletingIds.has(c.id) ? 'Deleting...' : 'Delete'}
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
                    disabled={pagination.offset + pagination.limit >= sortedItems.length}
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
      <RequirePermission permission={canManageCampaigns}>
        <Dialog
          open={showAddForm}
          onClose={() => {
            resetForm();
            setShowAddForm(false);
          }}
          title="Add Campaign"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowAddForm(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                color="green"
                onClick={() => handleAddCampaign()}
                disabled={submitting}
              >
                {submitting ? 'Adding...' : 'Add Campaign'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleAddCampaign} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label={<span>Campaign Name <span style={{ color: '#dc2626' }}>*</span></span>}
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
              <Input
                label={<span>Brand name <span style={{ color: '#dc2626' }}>*</span></span>}
                value={form.brandName}
                onChange={e => setForm(prev => ({ ...prev, brandName: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Categories
                </label>
                <div className="space-y-2">
                <div className="relative">
                  <Input
                    value={newCategory}
                    onChange={e => {
                      setNewCategory(e.target.value);
                      setShowSuggestions(e.target.value.trim().length > 0);
                    }}
                    onFocus={() => {
                      if (newCategory.trim().length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow clicking on suggestions
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    placeholder="Type category name and press Enter"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const category = newCategory.trim();
                        if (category) {
                          if (form.categories.includes(category)) {
                            setToast({ message: `Category "${category}" is already added`, type: 'error' });
                          } else {
                            setForm(prev => ({ ...prev, categories: [...prev.categories, category] }));
                            setNewCategory('');
                            setShowSuggestions(false);
                          }
                        }
                      }
                    }}
                  />
                  {showSuggestions && newCategory.trim().length > 0 && (
                    <div className="absolute z-10 w-full mt-1 border rounded-md max-h-48 overflow-auto" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
                      {availableCategories
                        .filter(cat => 
                          !form.categories.includes(cat) &&
                          cat.toLowerCase().includes(newCategory.toLowerCase())
                        )
                        .map(cat => (
                          <button
                            key={cat}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm transition-colors"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'; e.currentTarget.style.color = '#2563eb'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onClick={() => {
                              if (form.categories.includes(cat)) {
                                setToast({ message: `Category "${cat}" is already added`, type: 'error' });
                              } else {
                                setForm(prev => ({ ...prev, categories: [...prev.categories, cat] }));
                                setNewCategory('');
                                setShowSuggestions(false);
                              }
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      {availableCategories.filter(cat => 
                        !form.categories.includes(cat) &&
                        cat.toLowerCase().includes(newCategory.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                          Press Enter to create "{newCategory.trim()}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {form.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.categories.map(category => (
                      <span
                        key={category}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm border"
                        style={{ color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' }}
                      >
                        {category}
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, categories: prev.categories.filter(c => c !== category) }))}
                          className="transition-colors"
                          style={{ color: '#2563eb' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#1e40af'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#2563eb'; }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                </div>
              </div>
              <Input
                label={<span>Target Views for FYP <span style={{ color: '#dc2626' }}>*</span></span>}
                type="number"
                value={form.targetViewsForFYP}
                onChange={e => setForm(prev => ({ ...prev, targetViewsForFYP: sanitizeNumberInput(e.target.value) }))}
                placeholder="Enter minimum views to mark post as FYP"
                required
                min="0"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label={<span>Start Date <span style={{ color: '#dc2626' }}>*</span></span>}
                type="date"
                value={form.startDate}
                onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                required
              />
              <Input
                label={<span>End Date <span style={{ color: '#dc2626' }}>*</span></span>}
                type="date"
                value={form.endDate}
                onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label={<span>Status <span style={{ color: '#dc2626' }}>*</span></span>}
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                required
              >
                <option value="PLANNED">PLANNED</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
                <option value="COMPLETED">COMPLETED</option>
              </Select>
              <Input
                label="Quotation number"
                value={form.quotationNumber}
                onChange={e => setForm(prev => ({ ...prev, quotationNumber: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Campaign-Level KPIs <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {accountCategoryOrder.map((cat) => (
                  <Input
                    key={cat}
                    label={categoryLabels[cat]}
                    type="number"
                    value={campaignKpis[cat]}
                    onChange={e => setCampaignKpis(prev => ({ ...prev, [cat]: sanitizeNumberInput(e.target.value) }))}
                    placeholder="Target"
                    required
                    min="0"
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Accounts</label>
              <Select
                value={selectedAccount}
                onChange={e => {
                  const accountId = e.target.value;
                  if (accountId && !form.accountIds.includes(accountId)) {
                    setForm(prev => ({ ...prev, accountIds: [...prev.accountIds, accountId] }));
                    // Initialize KPIs for this account
                    setAccountKpis(prev => ({
                      ...prev,
                      [accountId]: Object.fromEntries(accountCategoryOrder.map((cat) => [cat, ''])),
                    }));
                  }
                  setSelectedAccount('');
                }}
              >
                <option value="">Select an account to add</option>
                {accounts
                  .filter(a => !form.accountIds.includes(a.id))
                  .map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} {account.tiktokHandle ? `(${account.tiktokHandle})` : ''}
                    </option>
                  ))}
              </Select>
              {form.accountIds.length > 0 && (
                <div className="mt-2 space-y-4">
                  {form.accountIds.map(accountId => {
                    const account = accounts.find(a => a.id === accountId);
                    const accountKpiData = accountKpis[accountId] || {};
                    return account ? (
                      <div key={accountId} className="border rounded-lg p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{account.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, accountIds: prev.accountIds.filter(id => id !== accountId) }));
                              setAccountKpis(prev => {
                                const next = { ...prev };
                                delete next[accountId];
                                return next;
                              });
                            }}
                            className="text-sm transition-colors"
                            style={{ color: '#dc2626' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#b91c1c'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                          {accountCategoryOrder.map((cat) => (
                            <Input
                              key={cat}
                              label={categoryLabels[cat]}
                              type="number"
                              value={accountKpiData[cat] || ''}
                              onChange={e => setAccountKpis(prev => ({
                                ...prev,
                                [accountId]: {
                                  ...(prev[accountId] || {}),
                                  [cat]: e.target.value,
                                },
                              }))}
                              placeholder="Target"
                              min="0"
                            />
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </form>
        </Dialog>
      </RequirePermission>

      <Dialog
        open={!!duplicateConfirm}
        onClose={() => setDuplicateConfirm(null)}
        title="Duplicate Campaign"
        footer={
          <>
            <Button variant="outline" onClick={() => setDuplicateConfirm(null)}>
              Cancel
            </Button>
            <Button variant="primary" color="green" onClick={handleDuplicateConfirm}>
              Duplicate
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Duplicate <strong>"{duplicateConfirm?.name}"</strong> with posts, KPIs, and account links?
        </p>
        <div className="mt-3">
          <Input
            label="New campaign name"
            value={duplicateConfirm?.newName || ''}
            onChange={e => setDuplicateConfirm(prev => (prev ? { ...prev, newName: e.target.value } : prev))}
            autoFocus
            required
          />
        </div>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Posts will be copied to the new campaign, and existing accounts will stay linked.
        </p>
      </Dialog>

      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Campaign"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="primary" color="red" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete <strong>"{deleteConfirm?.name}"</strong>?
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          This action cannot be undone. All associated posts, KPIs, and account links will also be deleted.
        </p>
      </Dialog>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <Dialog
        open={showBrandsModal}
        onClose={() => setShowBrandsModal(false)}
        title="Unique Brands"
        footer={
          <Button variant="primary" onClick={() => setShowBrandsModal(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-2">
          {getUniqueBrands.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)' }}>No brands found in campaigns.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                Total unique brands: <strong>{getUniqueBrands.length}</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                {getUniqueBrands.map((brand, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-sm border"
                    style={{ 
                      color: '#2563eb', 
                      backgroundColor: 'rgba(37, 99, 235, 0.1)', 
                      borderColor: '#93c5fd' 
                    }}
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
