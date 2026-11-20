import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  BarChart3, 
  BookOpen, 
  FileText, 
  Users, 
  CreditCard, 
  Settings, 
  MessageSquare, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Upload, 
  Crown, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle, 
  Image as ImageIcon,
  Headphones,
  Search,
  RefreshCw,
  Sparkles,
  Copy,
  Play,
  Send,
  ExternalLink,
  Activity,
  AlertTriangle,
  Database
} from 'lucide-react';
import { Novel, Chapter, User, PaymentRequest, SiteSettings, MembershipPlan, SupportTicket, UserAuthLog } from '../types.js';
import { useAuth } from '../context/AuthContext.js';
import { NovelCropperModal } from '../components/NovelCropperModal.js';

interface AdminViewProps {
  initialTab?: 'stats' | 'memberships' | 'novels' | 'chapters' | 'users' | 'payments' | 'settings' | 'tickets' | 'telegram' | 'authLogs';
}

export const AdminView: React.FC<AdminViewProps> = ({ initialTab }) => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'stats' | 'memberships' | 'novels' | 'chapters' | 'users' | 'payments' | 'settings' | 'tickets' | 'telegram' | 'authLogs'>(initialTab || 'stats');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Stats
  const [stats, setStats] = useState<{
    totalUsers: number;
    totalNovels: number;
    totalChapters: number;
    premiumMembers: number;
    pendingPayments: number;
    totalRevenue: number;
    supabaseHealth?: {
      configured: boolean;
      connected: boolean;
      hasUrl: boolean;
      hasKey: boolean;
      hasSecretKey?: boolean;
      hasPublishableKey?: boolean;
      keyType?: 'secret' | 'service_role' | 'publishable_only' | 'missing';
      readQueryVerified?: boolean;
      projectDomain?: string;
      latencyMs?: number;
      testedAt: string;
      tablesStatus?: Record<string, boolean>;
      storageStatus?: {
        bucket: string;
        accessible: boolean;
        isPublic?: boolean;
        error?: string;
      };
      paymentProofsStorageStatus?: {
        bucket: string;
        accessible: boolean;
        isPublic?: boolean;
        error?: string;
      };
      paymentsScreenshotColumnReady?: boolean;
      paymentsSchemaError?: string;
      membershipDiscountColumnsReady?: boolean;
      membershipSchemaError?: string;
      error?: string;
    };
  } | null>(null);
  const [supabaseTesting, setSupabaseTesting] = useState(false);

  // Novel Management State
  const [novels, setNovels] = useState<Novel[]>([]);
  const [novelModalOpen, setNovelModalOpen] = useState(false);
  const [editingNovel, setEditingNovel] = useState<Novel | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [novelForm, setNovelForm] = useState({
    title: '',
    description: '',
    coverImage: '',
    categories: ['Action'],
    tags: '',
    isPremium: false,
    isPublished: true,
    isFeatured: false,
    telegramChannelPrivacy: 'public' as 'public' | 'private',
    telegramChannelLink: '',
    telegramChannelId: '',
    telegramChannelName: '',
    telegramChannelType: 'channel' as 'channel' | 'supergroup',
    telegramAccessType: 'free' as 'free' | 'premium',
    telegramIntegrationEnabled: false
  });

  // Telegram Tab Management State
  const [telegramBotStatus, setTelegramBotStatus] = useState<any | null>(null);
  const [telegramOverview, setTelegramOverview] = useState<any | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramTestingChannel, setTelegramTestingChannel] = useState<string | null>(null);
  const [channelTestResult, setChannelTestResult] = useState<Record<string, any>>({});
  const [manualRunningExpiries, setManualRunningExpiries] = useState(false);
  const [manualExpiriesResult, setManualExpiriesResult] = useState<any | null>(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [webhookSetting, setWebhookSetting] = useState(false);

  // Chapter Management State
  const [selectedNovelId, setSelectedNovelId] = useState<string>('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterModalOpen, setChapterModalOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterForm, setChapterForm] = useState({
    chapterNumber: 1,
    title: '',
    telegramMessageLink: '',
    telegramMessageId: '' as string | number,
    telegramChatId: '',
    telegramDestinationType: 'channel' as 'channel' | 'supergroup' | 'group',
    telegramAudioAccessType: 'free' as 'free' | 'premium',
    isPremium: false,
    isPublished: true
  });

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Auth & Security Logs State
  const [authLogs, setAuthLogs] = useState<UserAuthLog[]>([]);
  const [authLogsLoading, setAuthLogsLoading] = useState(false);
  const [authLogsFilter, setAuthLogsFilter] = useState<'all' | 'login' | 'failed_login' | 'logout' | 'registration'>('all');
  const [authLogsSearch, setAuthLogsSearch] = useState('');
  const [authLogsSelectedUser, setAuthLogsSelectedUser] = useState<string | null>(null);

  // Payments State
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [requestInfoModalId, setRequestInfoModalId] = useState<string | null>(null);
  const [requestInfoNote, setRequestInfoNote] = useState('');
  const [copiedUtrId, setCopiedUtrId] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [qrUploading, setQrUploading] = useState(false);

  // Membership Plan Management State
  const [linkedUsageByPlanId, setLinkedUsageByPlanId] = useState<
    Record<
      string,
      { paymentsCount: number; pendingPaymentsCount: number; approvedPaymentsCount: number; activeUsersCount: number }
    >
  >({});
  const [discountColumnsReady, setDiscountColumnsReady] = useState<boolean>(true);
  const [planSqlMigration, setPlanSqlMigration] = useState<string>('');
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [planFormError, setPlanFormError] = useState<string | null>(null);
  const [planFormSqlHint, setPlanFormSqlHint] = useState<string | null>(null);
  const [newFeatureText, setNewFeatureText] = useState('');
  const [planForm, setPlanForm] = useState<{
    name: string;
    hindiName: string;
    originalPrice: string;
    price: string;
    durationDays: string;
    discountType: 'none' | 'percentage' | 'fixed';
    discountPercentage: string;
    discountAmount: string;
    description: string;
    features: string[];
    badgeText: string;
    isActive: boolean;
  }>({
    name: '',
    hindiName: '',
    originalPrice: '99',
    price: '99',
    durationDays: '30',
    discountType: 'none',
    discountPercentage: '0',
    discountAmount: '0',
    description: '',
    features: ['सभी VIP अध्यायों तक असीमित पहुँच'],
    badgeText: '',
    isActive: true
  });
  const [deletePlanModal, setDeletePlanModal] = useState<{
    plan: MembershipPlan;
    paymentsCount: number;
    activeUsersCount: number;
  } | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);

  // Membership Management Overview State
  const [membershipOverview, setMembershipOverview] = useState<{
    generatedAt: string;
    summary: {
      totalPaidBuyers: number;
      totalApprovedOrders: number;
      activePaidMembers: number;
      expiredPaidMembers: number;
      totalActiveVipUsers: number;
      pendingPaymentsCount: number;
      rejectedPaymentsCount: number;
      totalMembershipRevenue: number;
    };
    plans: Array<{
      id: string;
      name: string;
      hindiName: string;
      originalPrice?: number;
      price: number;
      discountType?: 'none' | 'percentage' | 'fixed';
      discountPercentage?: number;
      discountAmount?: number;
      durationDays: number;
      durationLabel: string;
      isActive: boolean;
      badgeText: string | null;
      description: string;
      features?: string[];
      purchaseCount: number;
      totalRevenue: number;
    }>;
    otherPlansStats?: { purchaseCount: number; totalRevenue: number };
    userMemberships: Array<{
      paymentId: string;
      userId: string;
      userName: string;
      userEmail: string;
      planId: string;
      planName: string;
      amount: number;
      durationDays: number | null;
      durationLabel: string;
      paymentDate: string;
      startDate: string | null;
      expiresAt: string | null;
      membershipStatus: 'active' | 'expired' | 'pending' | 'rejected';
      paymentStatus: 'approved' | 'pending' | 'rejected';
    }>;
  } | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipSearch, setMembershipSearch] = useState('');
  const [membershipFilter, setMembershipFilter] = useState<'all' | 'active' | 'expired' | 'approved' | 'pending' | 'rejected'>('all');

  // Support Tickets State
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [replyTicketId, setReplyTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showFeedback = (text: string, isError = false) => {
    setFeedbackMessage({ text, isError });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Fetch initial data
  const loadData = () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch('/api/admin/stats', { headers })
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch((e) => console.error(e));

    fetch('/api/novels?includeUnpublished=true', { headers })
      .then((r) => r.json())
      .then((d) => {
        setNovels(d.novels || []);
        if (d.novels && d.novels.length > 0 && !selectedNovelId) {
          setSelectedNovelId(d.novels[0].id);
        }
      })
      .catch((e) => console.error(e));

    fetch('/api/admin/users', { headers })
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch((e) => console.error(e));

    fetch('/api/admin/payments', { headers })
      .then((r) => r.json())
      .then((d) => setPayments(d.payments || []))
      .catch((e) => console.error(e));

    fetch('/api/admin/settings', { headers })
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        if (d.plans) setPlans(d.plans);
      })
      .catch((e) => console.error(e));

    fetch('/api/admin/plans', { headers })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.plans)) setPlans(d.plans);
        if (d.linkedUsageByPlanId) setLinkedUsageByPlanId(d.linkedUsageByPlanId);
        if (typeof d.discountColumnsReady === 'boolean') {
          setDiscountColumnsReady(d.discountColumnsReady);
        }
        if (d.sqlMigration) setPlanSqlMigration(d.sqlMigration);
      })
      .catch((e) => console.error(e));

    fetch('/api/admin/tickets', { headers })
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets || []))
      .catch((e) => console.error(e));

    setMembershipLoading(true);
    fetch('/api/admin/membership-overview', { headers })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.summary) setMembershipOverview(d);
      })
      .catch((e) => console.error(e))
      .finally(() => setMembershipLoading(false));

    loadTelegramData();
  };

  const loadTelegramData = () => {
    if (!token) return;
    setTelegramLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/telegram/admin/bot-status', { headers }).then((r) => r.json()),
      fetch('/api/telegram/admin/overview', { headers }).then((r) => r.json()),
    ])
      .then(([statusData, overviewData]) => {
        setTelegramBotStatus(statusData);
        setTelegramOverview(overviewData);
        if (statusData.webhook?.url) {
          setWebhookUrlInput(statusData.webhook.url);
        }
      })
      .catch((err) => console.error('Error loading Telegram data:', err))
      .finally(() => setTelegramLoading(false));
  };

  const handleTestSupabaseConnection = async () => {
    if (!token) return;
    setSupabaseTesting(true);
    try {
      const res = await fetch('/api/admin/supabase-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats((prev) => (prev ? { ...prev, supabaseHealth: data } : prev));
      if (data.connected && data.readQueryVerified) {
        showFeedback(`✓ Supabase Read-Only Query सफल! (${data.latencyMs}ms)`);
      } else {
        showFeedback(`⚠️ Supabase कनेक्शन सत्यापित नहीं हुआ: ${data.error || 'क्रेडेंशियल्स जांचें'}`, true);
      }
    } catch (err: any) {
      showFeedback(err.message || 'Supabase जांच विफल', true);
    } finally {
      setSupabaseTesting(false);
    }
  };

  const handleCheckBotChannel = async (channelId: string) => {
    if (!channelId || !token) return;
    setTelegramTestingChannel(channelId);
    try {
      const res = await fetch('/api/telegram/admin/check-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      setChannelTestResult((prev) => ({ ...prev, [channelId]: data.status }));
      if (data.status?.isAdmin && data.status?.hasRequiredPermissions === false) {
        showFeedback(`⚠️ ${data.status.error || 'बॉट एडमिन है पर Invite / Ban अनुमतियां अधूरी हैं'}`, true);
      } else if (data.status?.isAdmin && data.status?.isPublicChat) {
        showFeedback(`⚠️ ${data.status.warning || 'ग्रुप में Public @username सक्रिय है — इसे Private करें!'}`, true);
      } else if (data.status?.isAdmin) {
        showFeedback(`✓ बॉट '${data.status.title || channelId}' Private ग्रुप में सभी आवश्यक एडमिन अनुमतियों के साथ सक्रिय है!`);
      } else {
        showFeedback(`⚠️ ${data.status?.error || 'बॉट एडमिन नहीं है'}`, true);
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    } finally {
      setTelegramTestingChannel(null);
    }
  };

  const handleSetWebhook = async () => {
    if (!webhookUrlInput.trim() || !token) return;
    setWebhookSetting(true);
    try {
      const res = await fetch('/api/telegram/admin/set-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: webhookUrlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showFeedback('Telegram Webhook सफलतापूर्वक कॉन्फ़िगर हो गया!');
      loadTelegramData();
    } catch (err: any) {
      showFeedback(err.message, true);
    } finally {
      setWebhookSetting(false);
    }
  };

  const handleProcessExpiriesManually = async () => {
    if (!token) return;
    setManualRunningExpiries(true);
    setManualExpiriesResult(null);
    try {
      const res = await fetch('/api/telegram/admin/process-expiries', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setManualExpiriesResult(data.result);
      showFeedback(`सफलतापूर्वक प्रोसेस हुआ: ${data.result?.processedUsers} यूज़र जांचे गए, ${data.result?.kickedCount} रिमूव किए गए`);
      loadTelegramData();
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
    } finally {
      setManualRunningExpiries(false);
    }
  };

  const handleUnlinkUserTelegram = async (userId: string) => {
    if (!window.confirm('क्या आप सचमुच इस यूज़र का Telegram अनलिंक करना और सभी Private चैनलों से एक्सेस हटाना चाहते हैं?')) return;
    try {
      const res = await fetch(`/api/telegram/admin/unlink/${userId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'अनलिंक करने में विफलता');
      showFeedback(data.message || 'यूज़र का Telegram खाता अनलिंक कर दिया गया');
      loadTelegramData();
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  const handleRetryPendingOp = async (opId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/telegram/admin/retry-pending/${opId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showFeedback(data.message || 'सफलतापूर्वक पुनः प्रयास किया गया');
      loadTelegramData();
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  const handleRetryAllPendingOps = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/telegram/admin/retry-all-pending', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showFeedback(`कुल ${data.summary?.total || 0} लंबित में से ${data.summary?.succeeded || 0} सफल रहे`);
      loadTelegramData();
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  const loadAuthLogs = async (userIdFilter?: string) => {
    if (!token) return;
    setAuthLogsLoading(true);
    try {
      const url = userIdFilter
        ? `/api/admin/users/${userIdFilter}/auth-history`
        : `/api/admin/auth-logs?limit=300`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAuthLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load auth logs:', err);
    } finally {
      setAuthLogsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'authLogs') {
      loadAuthLogs(authLogsSelectedUser || undefined);
    }
  }, [activeTab, authLogsSelectedUser, token]);

  // Load chapters when novel changes
  const fetchNovelChapters = (novelId: string) => {
    if (!novelId || !token) return;
    fetch(`/api/admin/novels/${novelId}/chapters`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((d) => setChapters(d.chapters || []))
      .catch((e) => console.error(e));
  };

  useEffect(() => {
    if (selectedNovelId) {
      fetchNovelChapters(selectedNovelId);
    }
  }, [selectedNovelId, token]);

  // NOVEL OPERATIONS
  const handleOpenNovelModal = (novel?: Novel) => {
    if (novel) {
      setEditingNovel(novel);
      const isNovelVip = Boolean(novel.isPremium || novel.telegramAccessType === 'premium');
      setNovelForm({
        title: novel.title || novel.hindiTitle || '',
        description: novel.description,
        coverImage: novel.coverImage,
        categories: novel.categories,
        tags: novel.tags.join(', '),
        isPremium: novel.isPremium,
        isPublished: novel.isPublished,
        isFeatured: novel.isFeatured,
        telegramChannelPrivacy: isNovelVip
          ? 'private'
          : (novel.telegramChannelPrivacy || (novel.telegramChannelLink && !novel.telegramChannelId ? 'public' : 'private')),
        telegramChannelLink: isNovelVip ? '' : (novel.telegramChannelLink || ''),
        telegramChannelId: novel.telegramChannelId || '',
        telegramChannelName: novel.telegramChannelName || '',
        telegramChannelType: novel.telegramChannelType || 'channel',
        telegramAccessType: novel.telegramAccessType || (novel.isPremium ? 'premium' : 'free'),
        telegramIntegrationEnabled: Boolean(novel.telegramIntegrationEnabled)
      });
    } else {
      setEditingNovel(null);
      setNovelForm({
        title: '',
        description: '',
        coverImage: '',
        categories: ['Action'],
        tags: 'Action, Mystery',
        isPremium: false,
        isPublished: true,
        isFeatured: false,
        telegramChannelPrivacy: 'public',
        telegramChannelLink: '',
        telegramChannelId: '',
        telegramChannelName: '',
        telegramChannelType: 'channel',
        telegramAccessType: 'free',
        telegramIntegrationEnabled: false
      });
    }
    setNovelModalOpen(true);
  };

  const handleSaveNovel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const cleanCover = (novelForm.coverImage || '').trim();
    if (!cleanCover) {
      showFeedback('कृपया पहले "16:9 क्रॉपर खोलें" बटन से कवर इमेज अपलोड करें।', true);
      return;
    }

    if (!editingNovel && !/^https?:\/\//i.test(cleanCover)) {
      showFeedback('नए उपन्यास के लिए कवर इमेज का Supabase Storage में अपलोड होना आवश्यक है। कृपया 16:9 क्रॉपर से इमेज अपलोड करें।', true);
      return;
    }

    const payload = {
      ...novelForm,
      coverImage: cleanCover,
      tags: novelForm.tags.split(',').map((t) => t.trim()).filter(Boolean)
    };

    try {
      const url = editingNovel ? `/api/admin/novels/${editingNovel.id}` : '/api/admin/novels';
      const method = editingNovel ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showFeedback(editingNovel ? 'उपन्यास अपडेट हुआ' : 'नया उपन्यास जोड़ा गया');
      setNovelModalOpen(false);
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  const handleDeleteNovel = async (id: string) => {
    if (!window.confirm('क्या आप सचमुच इस उपन्यास और इसके सभी अध्यायों को हटाना चाहते हैं?')) return;
    try {
      const res = await fetch(`/api/admin/novels/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('उपन्यास हटाने में विफलता');
      showFeedback('उपन्यास सफलतापूर्वक हटा दिया गया');
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // CHAPTER OPERATIONS
  const handleOpenChapterModal = (chapter?: Chapter) => {
    if (chapter) {
      setEditingChapter(chapter);
      setChapterForm({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        telegramMessageLink: chapter.telegramMessageLink || '',
        telegramMessageId: chapter.telegramMessageId || '',
        telegramChatId: chapter.telegramChatId || '',
        telegramDestinationType: chapter.telegramDestinationType || 'channel',
        telegramAudioAccessType: chapter.telegramAudioAccessType || (chapter.isPremium ? 'premium' : 'free'),
        isPremium: chapter.isPremium,
        isPublished: chapter.isPublished
      });
    } else {
      setEditingChapter(null);
      setChapterForm({
        chapterNumber: chapters.length + 1,
        title: `अध्याय ${chapters.length + 1}: `,
        telegramMessageLink: '',
        telegramMessageId: '',
        telegramChatId: '',
        telegramDestinationType: 'channel',
        telegramAudioAccessType: 'free',
        isPremium: false,
        isPublished: true
      });
    }
    setChapterModalOpen(true);
  };

  const handleSaveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedNovelId) return;

    try {
      const url = editingChapter ? `/api/admin/chapters/${editingChapter.id}` : '/api/admin/chapters';
      const method = editingChapter ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...chapterForm,
          novelId: selectedNovelId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showFeedback(editingChapter ? 'अध्याय अपडेट हुआ' : 'नया अध्याय जोड़ा गया');
      setChapterModalOpen(false);
      // Reload chapters
      fetch(`/api/admin/novels/${selectedNovelId}/chapters`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((r) => r.json())
        .then((d) => setChapters(d.chapters || []));
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  const handleDeleteChapter = async (id: string) => {
    if (!window.confirm('क्या आप सचमुच इस अध्याय को हटाना चाहते हैं?')) return;
    try {
      const res = await fetch(`/api/admin/chapters/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('अध्याय हटाने में विफलता');
      showFeedback('अध्याय हटा दिया गया');
      setChapters(chapters.filter((c) => c.id !== id));
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  const handleTestTelegramLink = () => {
    const rawUrl = (chapterForm.telegramMessageLink || '').trim();
    if (!rawUrl) {
      showFeedback('कृपया पहले Telegram Message Link दर्ज करें', true);
      return;
    }

    let url = rawUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.startsWith('t.me/')) url = `https://${url}`;
      else if (url.startsWith('@')) url = `https://t.me/${url.slice(1)}`;
      else url = `https://t.me/${url}`;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    showFeedback('Telegram लिंक खोला गया');
  };

  const handleAutoDetectTelegramLink = (linkInput: string) => {
    const raw = linkInput.trim();
    let detectedMsgId = chapterForm.telegramMessageId;
    let detectedChatId = chapterForm.telegramChatId;
    let detectedType = chapterForm.telegramDestinationType;

    // Pattern 1: https://t.me/c/2147483648/103 (Private channel / supergroup)
    const privateMatch = raw.match(/t\.me\/c\/(\d+)\/(\d+)/i);
    if (privateMatch) {
      const channelNum = privateMatch[1];
      detectedChatId = channelNum.startsWith('-100') ? channelNum : `-100${channelNum}`;
      detectedMsgId = parseInt(privateMatch[2], 10);
      detectedType = 'channel';
    } else {
      // Pattern 2: https://t.me/ChannelName/103 (Public channel)
      const publicMatch = raw.match(/t\.me\/([a-zA-Z0-9_]+)\/(\d+)/i);
      if (publicMatch) {
        detectedMsgId = parseInt(publicMatch[2], 10);
        detectedType = 'channel';
      }
    }

    setChapterForm((prev) => ({
      ...prev,
      telegramMessageLink: raw,
      telegramMessageId: detectedMsgId,
      telegramChatId: detectedChatId,
      telegramDestinationType: detectedType
    }));
  };

  // NOVEL QUICK TOGGLES
  const handleToggleNovelPremium = async (novelId: string) => {
    try {
      setNovels((prev) =>
        prev.map((n) => (n.id === novelId ? { ...n, isPremium: !n.isPremium } : n))
      );
      const res = await fetch(`/api/admin/novels/${novelId}/toggle-premium`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.novel) {
        setNovels((prev) => prev.map((n) => (n.id === novelId ? data.novel : n)));
      }
      showFeedback(data.message || 'प्रीमियम स्थिति बदली गई');
    } catch (err: any) {
      showFeedback(err.message, true);
      loadData();
    }
  };

  const handleToggleNovelPublish = async (novelId: string) => {
    try {
      setNovels((prev) =>
        prev.map((n) => (n.id === novelId ? { ...n, isPublished: !n.isPublished } : n))
      );
      const res = await fetch(`/api/admin/novels/${novelId}/toggle-publish`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showFeedback(data.message || 'प्रकाशन स्थिति बदली गई');
    } catch (err: any) {
      showFeedback(err.message, true);
      loadData();
    }
  };

  const handleToggleNovelTelegramDelivery = async (novel: Novel) => {
    try {
      const nextState = !novel.telegramIntegrationEnabled;
      setNovels((prev) =>
        prev.map((n) => (n.id === novel.id ? { ...n, telegramIntegrationEnabled: nextState } : n))
      );
      const res = await fetch(`/api/admin/novels/${novel.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          telegramIntegrationEnabled: nextState
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showFeedback(`Telegram डिलीवरी ${nextState ? 'सक्रिय' : 'निष्क्रिय'} की गई`);
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
      loadData();
    }
  };

  // CHAPTER QUICK TOGGLES
  const handleToggleChapterPremium = async (chapterId: string) => {
    try {
      setChapters((prev) =>
        prev.map((c) => (c.id === chapterId ? { ...c, isPremium: !c.isPremium } : c))
      );
      const res = await fetch(`/api/admin/chapters/${chapterId}/toggle-premium`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showFeedback(data.message || 'अध्याय प्रीमियम स्थिति बदली गई');
    } catch (err: any) {
      showFeedback(err.message, true);
      if (selectedNovelId) fetchNovelChapters(selectedNovelId);
    }
  };

  const handleToggleChapterPublish = async (chapterId: string) => {
    try {
      setChapters((prev) =>
        prev.map((c) => (c.id === chapterId ? { ...c, isPublished: !c.isPublished } : c))
      );
      const res = await fetch(`/api/admin/chapters/${chapterId}/toggle-publish`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showFeedback(data.message || 'अध्याय प्रकाशन स्थिति बदली गई');
    } catch (err: any) {
      showFeedback(err.message, true);
      if (selectedNovelId) fetchNovelChapters(selectedNovelId);
    }
  };

  // PAYMENT APPROVE / REJECT / REQUEST INFO
  const handleApprovePayment = async (id: string) => {
    try {
      // Optimistic update
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'approved' as const } : p))
      );
      const res = await fetch(`/api/admin/payments/${id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showFeedback('भुगतान स्वीकृत! पाठक की वीआईपी सदस्यता Supabase में सक्रिय हो गई।');
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
      loadData();
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectionModalId) return;
    const paymentId = rejectionModalId;
    const reason = (rejectionReason || 'भुगतान सत्यापित नहीं हो सका').trim();
    try {
      // Optimistic update
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status: 'rejected' as const, rejectionReason: reason } : p))
      );
      setRejectionModalId(null);
      setRejectionReason('');

      const res = await fetch(`/api/admin/payments/${paymentId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showFeedback('भुगतान अस्वीकृत किया गया और कारण सहेजा गया');
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
      loadData();
    }
  };

  const [screenshotModalUrl, setScreenshotModalUrl] = useState<string | null>(null);
  const handleViewScreenshot = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/screenshot`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.signedUrl) {
          throw new Error(data?.error || 'स्क्रीनशॉट लोड नहीं हो सका');
        }
        setScreenshotModalUrl(data.signedUrl);
        return;
      }

      if (!res.ok) throw new Error('स्क्रीनशॉट लोड नहीं हो सका');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setScreenshotModalUrl(url);
    } catch (err: any) {
      showFeedback(err.message || 'स्क्रीनशॉट लोड करने में त्रुटि', true);
    }
  };

  const handleOpenRequestInfo = (paymentId: string) => {
    setRequestInfoModalId(paymentId);
    setRequestInfoNote('कृपया स्पष्ट भुगतान स्क्रीनशॉट या 12 अंकों का UTR नंबर प्रदान करें');
  };

  const handleSubmitRequestInfo = async () => {
    if (!requestInfoModalId) return;
    const paymentId = requestInfoModalId;
    const note = requestInfoNote.trim();
    try {
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, adminNote: note } : p))
      );
      setRequestInfoModalId(null);
      setRequestInfoNote('');

      const res = await fetch(`/api/admin/payments/${paymentId}/request-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ note })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showFeedback('अतिरिक्त जानकारी का अनुरोध भेजा गया');
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
      loadData();
    }
  };

  const handleCopyUtr = (id: string, utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtrId(id);
    showFeedback('UTR नंबर कॉपी हुआ!');
    setTimeout(() => setCopiedUtrId(null), 2000);
  };

  // USER MANAGEMENT & ROLE UPDATES
  const handleUpdateUserRole = async (userId: string, newRole: 'admin' | 'reader') => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    const ownerEmail = (settings?.adminEmail || '').toLowerCase();
    if (targetUser.email.toLowerCase() === ownerEmail && newRole !== 'admin') {
      showFeedback('वेबसाइट स्वामी (Owner) के एडमिन रोल को हटाया नहीं जा सकता।', true);
      return;
    }

    try {
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );

      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showFeedback(data.message || `रोल बदलकर ${newRole === 'admin' ? 'ADMIN' : 'READER'} किया गया`);
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
      loadData();
    }
  };

  const handleToggleMembership = async (userId: string, currentActive: boolean) => {
    try {
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, membership: { isActive: !currentActive, planName: !currentActive ? 'Admin Manual VIP' : undefined } }
            : u
        )
      );

      const res = await fetch(`/api/admin/users/${userId}/membership`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          isActive: !currentActive,
          durationDays: 30,
          planName: 'Admin Manual VIP'
        })
      });
      if (!res.ok) throw new Error('सदस्यता बदलने में विफलता');
      showFeedback(currentActive ? 'VIP सदस्यता हटाई गई' : '30 दिन की VIP सदस्यता दी गई');
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
      loadData();
    }
  };

  const handleToggleBlock = async (userId: string, currentlyBlocked: boolean) => {
    try {
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isBlocked: !currentlyBlocked } : u))
      );

      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isBlocked: !currentlyBlocked })
      });
      if (!res.ok) throw new Error('खाता स्थिति बदलने में विफलता');
      showFeedback(currentlyBlocked ? 'खाता अनब्लॉक किया गया' : 'खाता ब्लॉक किया गया');
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
      loadData();
    }
  };

  // SETTINGS SAVE
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !token) return;

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('सेटिंग्स सहेजने में विफलता');
      showFeedback('वेबसाइट सेटिंग्स सुरक्षित रूप से सहेजी गईं');
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // MEMBERSHIP PLANS CRUD & PRICE/DISCOUNT HELPERS
  const roundMoney2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;
  const formatMoneyDisplay = (val: number) => {
    const r = roundMoney2(Number(val) || 0);
    return Number.isInteger(r) ? String(r) : r.toFixed(2);
  };
  const formatPlanDurationPreview = (daysNum: number) => {
    if (!Number.isFinite(daysNum) || daysNum <= 0) return 'अमान्य अवधि';
    if (daysNum % 365 === 0) return `${daysNum} दिन (${daysNum / 365} वर्ष)`;
    if (daysNum % 30 === 0) {
      const m = daysNum / 30;
      return `${daysNum} दिन (${m} ${m === 1 ? 'महीना' : 'महीने'})`;
    }
    return `${daysNum} दिन`;
  };

  const openNewPlanModal = () => {
    setEditingPlanId(null);
    setPlanFormError(null);
    setPlanFormSqlHint(null);
    setNewFeatureText('');
    setPlanForm({
      name: '',
      hindiName: '',
      originalPrice: '99',
      price: '99',
      durationDays: '30',
      discountType: 'none',
      discountPercentage: '0',
      discountAmount: '0',
      description: '',
      features: [
        'सभी VIP अध्यायों तक असीमित पहुँच',
        '3x ऑडियो प्लेयर स्पीड सपोर्ट',
        'कोई विज्ञापन नहीं (Ad-Free)'
      ],
      badgeText: '',
      isActive: true
    });
    setPlanModalOpen(true);
  };

  const openEditPlanModal = (plan: MembershipPlan) => {
    const orig =
      plan.originalPrice !== undefined && plan.originalPrice > 0 ? plan.originalPrice : plan.price;
    const dType: 'none' | 'percentage' | 'fixed' =
      plan.discountType === 'percentage' || plan.discountType === 'fixed'
        ? plan.discountType
        : orig > plan.price
          ? 'fixed'
          : 'none';
    const dPct = dType === 'percentage' ? Number(plan.discountPercentage) || 0 : 0;
    const dAmt =
      dType === 'fixed'
        ? Number(plan.discountAmount) || roundMoney2(Math.max(0, orig - plan.price))
        : 0;

    setEditingPlanId(plan.id);
    setPlanFormError(null);
    setPlanFormSqlHint(null);
    setNewFeatureText('');
    setPlanForm({
      name: plan.name,
      hindiName: plan.hindiName,
      originalPrice: formatMoneyDisplay(orig),
      price: formatMoneyDisplay(plan.price),
      durationDays: String(plan.durationDays || 30),
      discountType: dType,
      discountPercentage: formatMoneyDisplay(dPct),
      discountAmount: formatMoneyDisplay(dAmt),
      description: plan.description || '',
      features: Array.isArray(plan.features) && plan.features.length > 0 ? [...plan.features] : [''],
      badgeText: plan.badgeText || '',
      isActive: plan.isActive !== false
    });
    setPlanModalOpen(true);
  };

  const recalculatePlanPrice = (
    origStr: string,
    dType: 'none' | 'percentage' | 'fixed',
    pctStr: string,
    amtStr: string
  ): string => {
    const orig = Number(origStr);
    if (!Number.isFinite(orig) || orig <= 0) return '0';
    if (dType === 'percentage') {
      const pct = Number(pctStr);
      if (!Number.isFinite(pct) || pct <= 0) return formatMoneyDisplay(orig);
      const calc = roundMoney2(orig - (orig * pct) / 100);
      return formatMoneyDisplay(Math.max(0, calc));
    }
    if (dType === 'fixed') {
      const amt = Number(amtStr);
      if (!Number.isFinite(amt) || amt <= 0) return formatMoneyDisplay(orig);
      const calc = roundMoney2(orig - amt);
      return formatMoneyDisplay(Math.max(0, calc));
    }
    return formatMoneyDisplay(orig);
  };

  const handlePlanOriginalPriceChange = (nextOrigStr: string) => {
    setPlanForm((prev) => ({
      ...prev,
      originalPrice: nextOrigStr,
      price: recalculatePlanPrice(
        nextOrigStr,
        prev.discountType,
        prev.discountPercentage,
        prev.discountAmount
      )
    }));
  };

  const handlePlanDiscountModeChange = (nextMode: 'none' | 'percentage' | 'fixed') => {
    setPlanForm((prev) => {
      const nextPct = nextMode === 'percentage' ? prev.discountPercentage : '0';
      const nextAmt = nextMode === 'fixed' ? prev.discountAmount : '0';
      return {
        ...prev,
        discountType: nextMode,
        discountPercentage: nextPct,
        discountAmount: nextAmt,
        price: recalculatePlanPrice(prev.originalPrice, nextMode, nextPct, nextAmt)
      };
    });
  };

  const handlePlanDiscountPctChange = (nextPctStr: string) => {
    setPlanForm((prev) => ({
      ...prev,
      discountType: 'percentage',
      discountPercentage: nextPctStr,
      discountAmount: '0',
      price: recalculatePlanPrice(prev.originalPrice, 'percentage', nextPctStr, '0')
    }));
  };

  const handlePlanDiscountAmtChange = (nextAmtStr: string) => {
    setPlanForm((prev) => ({
      ...prev,
      discountType: 'fixed',
      discountAmount: nextAmtStr,
      discountPercentage: '0',
      price: recalculatePlanPrice(prev.originalPrice, 'fixed', '0', nextAmtStr)
    }));
  };

  const handlePlanSellingPriceChange = (nextSellingStr: string) => {
    setPlanForm((prev) => {
      const selling = Number(nextSellingStr);
      const orig = Number(prev.originalPrice);
      if (!Number.isFinite(selling) || selling <= 0) {
        return { ...prev, price: nextSellingStr };
      }
      if (!Number.isFinite(orig) || orig <= 0 || selling >= orig) {
        return {
          ...prev,
          originalPrice: nextSellingStr,
          price: nextSellingStr,
          discountType: 'none',
          discountPercentage: '0',
          discountAmount: '0'
        };
      }
      if (prev.discountType === 'percentage') {
        const pct = roundMoney2(((orig - selling) / orig) * 100);
        return {
          ...prev,
          price: nextSellingStr,
          discountPercentage: formatMoneyDisplay(pct),
          discountAmount: '0'
        };
      }
      const amt = roundMoney2(orig - selling);
      return {
        ...prev,
        price: nextSellingStr,
        discountType: 'fixed',
        discountAmount: formatMoneyDisplay(amt),
        discountPercentage: '0'
      };
    });
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setPlanFormError(null);
    setPlanFormSqlHint(null);

    const orig = roundMoney2(Number(planForm.originalPrice));
    const selling = roundMoney2(Number(planForm.price));
    const days = Number(planForm.durationDays);
    const pct = planForm.discountType === 'percentage' ? roundMoney2(Number(planForm.discountPercentage) || 0) : 0;
    const amt = planForm.discountType === 'fixed' ? roundMoney2(Number(planForm.discountAmount) || 0) : 0;
    const cleanFeatures = planForm.features.map((f) => f.trim()).filter(Boolean);

    if (!planForm.name.trim() || !planForm.hindiName.trim()) {
      setPlanFormError('Membership Name और Hindi Name दोनों आवश्यक हैं।');
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setPlanFormError('Membership Duration (Days) 1 से 3650 के बीच पूर्ण संख्या होनी चाहिए।');
      return;
    }
    if (!Number.isFinite(orig) || orig <= 0) {
      setPlanFormError('Original Price ₹0 से अधिक होनी चाहिए।');
      return;
    }
    if (planForm.discountType === 'percentage' && (pct < 0 || pct >= 100)) {
      setPlanFormError('Discount Percentage 0% से 99.99% के बीच होना चाहिए।');
      return;
    }
    if (planForm.discountType === 'fixed' && (amt < 0 || amt >= orig)) {
      setPlanFormError('Discount Amount मूल कीमत (Original Price) से कम होना चाहिए।');
      return;
    }
    if (!Number.isFinite(selling) || selling <= 0) {
      setPlanFormError('अंतिम बिक्री मूल्य ₹0 से अधिक होना चाहिए।');
      return;
    }
    if (!planForm.description.trim()) {
      setPlanFormError('कृपया प्लान का विवरण (Description) दर्ज करें।');
      return;
    }
    if (cleanFeatures.length === 0) {
      setPlanFormError('कृपया कम से कम 1 Feature जोड़ें।');
      return;
    }

    try {
      setPlanSaving(true);
      const payload = {
        name: planForm.name.trim(),
        hindiName: planForm.hindiName.trim(),
        originalPrice: orig,
        price: selling,
        durationDays: days,
        discountType:
          planForm.discountType === 'percentage' && pct > 0
            ? 'percentage'
            : planForm.discountType === 'fixed' && amt > 0
              ? 'fixed'
              : 'none',
        discountPercentage: planForm.discountType === 'percentage' ? pct : 0,
        discountAmount: planForm.discountType === 'fixed' ? amt : 0,
        description: planForm.description.trim(),
        features: cleanFeatures,
        badgeText: planForm.badgeText.trim() || undefined,
        isActive: planForm.isActive
      };

      const url = editingPlanId ? `/api/admin/plans/${editingPlanId}` : '/api/admin/plans';
      const method = editingPlanId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.sqlMigration) {
          setPlanFormSqlHint(data.sqlMigration);
          setPlanSqlMigration(data.sqlMigration);
          setDiscountColumnsReady(false);
        }
        throw new Error(data?.error || 'सदस्यता प्लान सहेजने में विफलता');
      }

      showFeedback(data?.message || 'सदस्यता प्लान सफलतापूर्वक Supabase में सहेजा गया!');
      setPlanModalOpen(false);
      loadData();
    } catch (err: any) {
      setPlanFormError(err?.message || 'सदस्यता प्लान सहेजने में त्रुटि');
    } finally {
      setPlanSaving(false);
    }
  };

  const handleTogglePlanActive = async (plan: MembershipPlan) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}/toggle-active`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !plan.isActive })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'प्लान स्थिति बदलने में विफलता');
      }
      showFeedback(data?.message || 'प्लान स्थिति अपडेट हुई');
      loadData();
    } catch (err: any) {
      showFeedback(err?.message || 'त्रुटि हुई', true);
    }
  };

  const handleRequestDeletePlan = (plan: MembershipPlan) => {
    const usage = linkedUsageByPlanId[plan.id];
    setDeletePlanModal({
      plan,
      paymentsCount: usage?.paymentsCount || 0,
      activeUsersCount: usage?.activeUsersCount || 0
    });
  };

  const handleConfirmDeletePlan = async (force: boolean) => {
    if (!token || !deletePlanModal) return;
    try {
      setDeletingPlan(true);
      const res = await fetch(
        `/api/admin/plans/${deletePlanModal.plan.id}${force ? '?force=true' : ''}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data?.requiresConfirmation) {
          setDeletePlanModal({
            plan: deletePlanModal.plan,
            paymentsCount: data.linkedPaymentsCount || 0,
            activeUsersCount: data.linkedUsersCount || 0
          });
          return;
        }
        throw new Error(data?.error || 'प्लान हटाने में विफलता');
      }
      showFeedback(data?.message || 'सदस्यता प्लान हटाया गया');
      setDeletePlanModal(null);
      loadData();
    } catch (err: any) {
      showFeedback(err?.message || 'प्लान हटाने में त्रुटि', true);
    } finally {
      setDeletingPlan(false);
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const allowedTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    if (!allowedTypes.has((file.type || '').toLowerCase())) {
      showFeedback('कृपया केवल JPEG, PNG या WebP QR इमेज चुनें', true);
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showFeedback('QR इमेज का आकार 10 MB से अधिक नहीं होना चाहिए', true);
      e.target.value = '';
      return;
    }

    try {
      setQrUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || data?.storage !== 'supabase' || !data?.url) {
        throw new Error(data?.error || 'Supabase Storage में UPI QR अपलोड विफल रहा');
      }

      if (settings) {
        setSettings({ ...settings, upiQrCodeUrl: data.url });
      }
      showFeedback('UPI QR कोड सफलतापूर्वक Supabase Storage में अपलोड हुआ (सेटिंग्स सेव करना न भूलें)');
    } catch (err: any) {
      showFeedback(err?.message || 'UPI QR अपलोड में त्रुटि', true);
    } finally {
      setQrUploading(false);
      e.target.value = '';
    }
  };

  // TICKET REPLY
  const handleReplyTicket = async () => {
    if (!replyTicketId || !replyText.trim() || !token) return;
    try {
      const res = await fetch(`/api/admin/tickets/${replyTicketId}/reply`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reply: replyText.trim() })
      });
      if (!res.ok) throw new Error('उत्तर भेजने में विफलता');
      showFeedback('उत्तर सफलतापूर्वक भेजा गया');
      setReplyTicketId(null);
      setReplyText('');
      loadData();
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  const allCategories = [
    'System', 'Action', 'Fantasy', 'Adventure', 'Rebirth', 
    'Cultivation', 'Romance', 'Comedy', 'Supernatural', 
    'Martial Arts', 'Modern', 'Mystery'
  ];

  return (
    <div className="space-y-8 pb-16 w-full max-w-full min-w-0">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-purple-900/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Crazy Storyes Admin Dashboard
            </h1>
            <p className="text-xs text-purple-300/80">
              वेबसाइट नियंत्रण केंद्र • अधिकृत एडमिन: <strong>{user?.email}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {stats?.supabaseHealth && (
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-sm ${
              stats.supabaseHealth.connected && stats.supabaseHealth.readQueryVerified
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : stats.supabaseHealth.configured
                ? 'bg-red-950/70 border-red-500/40 text-red-300'
                : 'bg-amber-950/60 border-amber-500/30 text-amber-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                stats.supabaseHealth.connected && stats.supabaseHealth.readQueryVerified ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`} />
              <span>
                {stats.supabaseHealth.connected && stats.supabaseHealth.readQueryVerified
                  ? `Supabase CONNECTED (${stats.supabaseHealth.latencyMs}ms)`
                  : stats.supabaseHealth.configured
                  ? 'Supabase Query Failed'
                  : 'Supabase NOT CONNECTED (Config Missing)'}
              </span>
            </div>
          )}
          <button
            onClick={loadData}
            className="btn-3d btn-3d-subtle px-3.5 py-2 rounded-xl text-xs font-bold text-purple-200 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            <span>रिफ्रेश डेटा</span>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            feedbackMessage.isError
              ? 'bg-red-950/80 border-red-500/40 text-red-200'
              : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {feedbackMessage.isError ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-purple-900/30 scrollbar-none">
        {[
          { id: 'stats', label: '📊 डैशबोर्ड सांख्यिकी', icon: BarChart3 },
          { id: 'memberships', label: '👑 सदस्यता प्रबंधन', icon: Crown },
          { id: 'novels', label: '📚 उपन्यास प्रबंधन', icon: BookOpen },
          { id: 'chapters', label: '📖 अध्याय प्रबंधन', icon: FileText },
          { id: 'payments', label: `💳 भुगतान प्रबंधन (${payments.filter(p => p.status === 'pending').length})`, icon: CreditCard },
          { id: 'users', label: '👥 उपयोगकर्ता प्रबंधन', icon: Users },
          { id: 'authLogs', label: '🛡️ लॉगिन व सुरक्षा इतिहास', icon: Shield },
          { id: 'telegram', label: '✈️ Telegram VIP & चैनल प्रबंधन', icon: Send },
          { id: 'settings', label: '⚙️ वेबसाइट & UPI सेटिंग्स', icon: Settings },
          { id: 'tickets', label: `💬 सहायता संदेश (${tickets.filter(t => t.status === 'open').length})`, icon: MessageSquare }
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`btn-3d px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isSelected
                  ? 'btn-3d-gold text-amber-950 shadow-md'
                  : 'bg-purple-950/40 text-purple-300 hover:text-white border border-purple-500/20'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD STATS */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#1a0833] to-[#110524] border border-purple-500/30 shadow-xl space-y-2">
              <span className="text-xs font-bold text-purple-400">कुल पाठक (Total Users)</span>
              <div className="text-3xl font-black text-white">{stats.totalUsers}</div>
              <p className="text-[11px] text-purple-300/70">पंजीकृत खातों की संख्या</p>
            </div>

            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#1a0833] to-[#110524] border border-purple-500/30 shadow-xl space-y-2">
              <span className="text-xs font-bold text-purple-400">कुल उपन्यास (Total Novels)</span>
              <div className="text-3xl font-black text-white">{stats.totalNovels}</div>
              <p className="text-[11px] text-purple-300/70">16:9 कवर्स के साथ प्रकाशित</p>
            </div>

            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#1a0833] to-[#110524] border border-purple-500/30 shadow-xl space-y-2">
              <span className="text-xs font-bold text-purple-400">कुल अध्याय (Total Chapters)</span>
              <div className="text-3xl font-black text-white">{stats.totalChapters}</div>
              <p className="text-[11px] text-purple-300/70">पाठ और ऑडियोबुक्स</p>
            </div>

            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#261040] to-[#150629] border border-amber-500/40 shadow-xl space-y-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" /> सक्रिय वीआईपी सदस्य (VIP Members)
              </span>
              <div className="text-3xl font-black text-amber-300 text-3d-gold">
                {stats.premiumMembers}
              </div>
              <p className="text-[11px] text-amber-200/70">प्रीमियम प्लान धारक</p>
            </div>

            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#261040] to-[#150629] border border-amber-500/40 shadow-xl space-y-2">
              <span className="text-xs font-bold text-amber-400">लंबित भुगतान (Pending Payments)</span>
              <div className="text-3xl font-black text-amber-400">{stats.pendingPayments}</div>
              <p className="text-[11px] text-amber-200/70">सत्यापन हेतु प्रतीक्षारत</p>
            </div>

            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#182a1d] to-[#0d1a10] border border-emerald-500/40 shadow-xl space-y-2">
              <span className="text-xs font-bold text-emerald-400">कुल राजस्व (Total Revenue)</span>
              <div className="text-3xl font-black text-emerald-300">₹{stats.totalRevenue}</div>
              <p className="text-[11px] text-emerald-200/70">स्वीकृत यूपीआई भुगतानों से</p>
            </div>
          </div>

          {/* Supabase Real Connection Verification Card */}
          {stats.supabaseHealth && (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-[#120826] to-[#0a0316] border border-purple-500/30 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-900/40">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-md ${
                    stats.supabaseHealth.connected && stats.supabaseHealth.readQueryVerified
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  }`}>
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex flex-wrap items-center gap-2">
                      <span>Supabase वास्तविक डेटाबेस स्थिति (Real DB Connection)</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold ${
                        stats.supabaseHealth.connected && stats.supabaseHealth.readQueryVerified
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border border-red-500/40'
                      }`}>
                        {stats.supabaseHealth.connected && stats.supabaseHealth.readQueryVerified ? 'CONNECTED' : 'NOT CONNECTED'}
                      </span>
                    </h3>
                    <p className="text-xs text-purple-300/80">
                      वास्तविक Read-Only Database Query सत्यापन (Secret Key केवल Backend में, Frontend में कभी नहीं)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                  {stats.supabaseHealth.connected && stats.supabaseHealth.latencyMs !== undefined && (
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      लेटेंसी: {stats.supabaseHealth.latencyMs}ms
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={supabaseTesting}
                    onClick={handleTestSupabaseConnection}
                    className="btn-3d btn-3d-subtle px-3 py-1.5 rounded-xl text-xs font-bold text-purple-200 border border-purple-500/30 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${supabaseTesting ? 'animate-spin' : ''}`} />
                    <span>{supabaseTesting ? 'जांच जारी...' : 'कनेक्शन जांचें (Read Query)'}</span>
                  </button>
                </div>
              </div>

              {/* Safe Env Diagnostics Grid (No Secret Values Exposed) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                <div className={`p-3 rounded-2xl border ${stats.supabaseHealth.hasUrl ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-red-950/20 border-red-500/30'}`}>
                  <span className="text-[10px] font-mono text-purple-400 block">SUPABASE_URL</span>
                  <span className={`font-bold ${stats.supabaseHealth.hasUrl ? 'text-emerald-300' : 'text-red-300'}`}>
                    {stats.supabaseHealth.hasUrl ? `✓ ${stats.supabaseHealth.projectDomain}` : '✗ अनुपलब्ध (अनुमानित नहीं)'}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl border ${stats.supabaseHealth.hasSecretKey ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-red-950/20 border-red-500/30'}`}>
                  <span className="text-[10px] font-mono text-purple-400 block">Backend Secret Key</span>
                  <span className={`font-bold ${stats.supabaseHealth.hasSecretKey ? 'text-emerald-300' : 'text-red-300'}`}>
                    {stats.supabaseHealth.hasSecretKey
                      ? `✓ सुरक्षित (${stats.supabaseHealth.keyType || 'secret'})`
                      : '✗ अनुपलब्ध (Backend Secrets में जोड़ें)'}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl border ${stats.supabaseHealth.hasPublishableKey ? 'bg-sky-950/20 border-sky-500/30' : 'bg-purple-950/30 border-purple-500/20'}`}>
                  <span className="text-[10px] font-mono text-purple-400 block">SUPABASE_PUBLISHABLE_KEY</span>
                  <span className={`font-bold ${stats.supabaseHealth.hasPublishableKey ? 'text-sky-300' : 'text-purple-400'}`}>
                    {stats.supabaseHealth.hasPublishableKey ? '✓ पहचानी गई (Publishable)' : 'सेट नहीं'}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl border ${stats.supabaseHealth.readQueryVerified ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-amber-950/20 border-amber-500/30'}`}>
                  <span className="text-[10px] font-mono text-purple-400 block">Read-Only DB Query</span>
                  <span className={`font-bold ${stats.supabaseHealth.readQueryVerified ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {stats.supabaseHealth.readQueryVerified ? '✓ SELECT / HEAD सत्यापित' : '✗ अभी सत्यापित नहीं'}
                  </span>
                </div>
              </div>

              {stats.supabaseHealth.storageStatus && (
                <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                  stats.supabaseHealth.storageStatus.accessible
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-950/30 border-red-500/30 text-red-300'
                }`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-purple-300 uppercase">Storage Bucket:</span>
                    <code className="font-mono font-bold text-white">{stats.supabaseHealth.storageStatus.bucket}</code>
                    {stats.supabaseHealth.storageStatus.isPublic !== undefined && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border ${
                        stats.supabaseHealth.storageStatus.isPublic
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      }`}>
                        {stats.supabaseHealth.storageStatus.isPublic ? 'PUBLIC' : 'PRIVATE'}
                      </span>
                    )}
                  </div>
                  <span className="font-bold">
                    {stats.supabaseHealth.storageStatus.accessible
                      ? '✓ Bucket उपलब्ध और पठनीय (Read-Verified)'
                      : `✗ त्रुटि: ${stats.supabaseHealth.storageStatus.error || 'पहुँच विफल'}`}
                  </span>
                </div>
              )}

              {stats.supabaseHealth.paymentProofsStorageStatus && (
                <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                  stats.supabaseHealth.paymentProofsStorageStatus.accessible
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-950/30 border-red-500/30 text-red-300'
                }`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-purple-300 uppercase">Payment Proofs Bucket:</span>
                    <code className="font-mono font-bold text-white">{stats.supabaseHealth.paymentProofsStorageStatus.bucket}</code>
                    {stats.supabaseHealth.paymentProofsStorageStatus.isPublic !== undefined && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border ${
                        stats.supabaseHealth.paymentProofsStorageStatus.isPublic
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      }`}>
                        {stats.supabaseHealth.paymentProofsStorageStatus.isPublic ? 'PUBLIC (Private होना चाहिए)' : 'PRIVATE'}
                      </span>
                    )}
                    {stats.supabaseHealth.paymentsScreenshotColumnReady !== undefined && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border ${
                        stats.supabaseHealth.paymentsScreenshotColumnReady
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-red-500/20 border-red-500/40 text-red-300'
                      }`}>
                        {stats.supabaseHealth.paymentsScreenshotColumnReady
                          ? '✓ payments.screenshot_path तैयार'
                          : '✗ payments.screenshot_path अनुपस्थित'}
                      </span>
                    )}
                  </div>
                  <span className="font-bold">
                    {stats.supabaseHealth.paymentProofsStorageStatus.accessible
                      ? '✓ Private Bucket उपलब्ध (Signed URL सक्रिय)'
                      : `✗ त्रुटि: ${stats.supabaseHealth.paymentProofsStorageStatus.error || 'पहुँच विफल'}`}
                  </span>
                </div>
              )}

              {stats.supabaseHealth.error && (
                <div className="p-4 rounded-2xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                    <span className="leading-relaxed">{stats.supabaseHealth.error}</span>
                  </div>
                  {(!stats.supabaseHealth.hasUrl || !stats.supabaseHealth.hasSecretKey) && (
                    <div className="p-3 rounded-xl bg-black/30 border border-amber-500/30 text-amber-200/95 text-[11px] space-y-1">
                      <p className="font-bold text-amber-300">📌 Supabase क्रेडेंशियल कहाँ से लें:</p>
                      <p>• <strong>SUPABASE_URL:</strong> Supabase Dashboard → <em>Project Settings → Data API (या API) → Project URL</em> से कॉपी करें (यह <code className="font-mono text-white">https://&lt;project-ref&gt;.supabase.co</code> जैसा होता है)।</p>
                      <p>• <strong>SUPABASE_SECRET_KEY:</strong> Supabase Dashboard → <em>Project Settings → API Keys → Secret keys</em> (<code className="font-mono text-white">sb_secret_...</code> या <code className="font-mono text-white">service_role</code>) से कॉपी करके केवल Backend Secrets में जोड़ें।</p>
                    </div>
                  )}
                </div>
              )}

              {stats.supabaseHealth.tablesStatus && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-purple-300">
                    📊 आवश्यक तालिकाओं का स्थिति चार्ट (Tables Verification):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[11px]">
                    {Object.entries(stats.supabaseHealth.tablesStatus).map(([table, ok]) => (
                      <div
                        key={table}
                        className={`p-2 rounded-xl border flex items-center justify-between font-mono ${
                          ok
                            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                            : 'bg-red-950/30 border-red-500/30 text-red-300'
                        }`}
                      >
                        <span className="truncate">{table}</span>
                        <span>{ok ? '✓' : '✗'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 1B: MEMBERSHIP MANAGEMENT OVERVIEW & PLAN EDITOR */}
      {activeTab === 'memberships' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <span>सदस्यता और प्लान प्रबंधन (Membership & Plans Management)</span>
              </h2>
              <p className="text-xs text-purple-300/80">
                Supabase से प्लान कीमत, अवधि, Discount और Active/Inactive स्थिति बदलें, नए प्लान जोड़ें व वास्तविक कमाई देखें।
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={openNewPlanModal}
                className="btn-3d btn-3d-gold px-4 py-2 rounded-xl text-xs font-black text-amber-950 flex items-center gap-1.5 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>नया Membership Plan जोड़ें</span>
              </button>
              <button
                type="button"
                onClick={loadData}
                disabled={membershipLoading}
                className="btn-3d btn-3d-subtle px-3.5 py-2 rounded-xl text-xs font-bold text-purple-200 flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${membershipLoading ? 'animate-spin' : ''}`} />
                <span>{membershipLoading ? 'लोड हो रहा है...' : 'रीफ्रेश करें'}</span>
              </button>
            </div>
          </div>

          {!discountColumnsReady && planSqlMigration && (
            <div className="rounded-3xl bg-amber-950/40 border border-amber-500/45 p-4 sm:p-5 space-y-3 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-amber-200">
                      Supabase में Discount कॉलम Migration आवश्यक है (keval Discount हेतु)
                    </h3>
                    <p className="text-xs text-amber-100/80 leading-relaxed">
                      कीमत, नाम, अवधि (Days), विवरण, फीचर्स और Active/Inactive बदलाव अभी सीधे सेव होते हैं। Discount (% / ₹) व Original Price को स्थायी रूप से सेव करने के लिए Supabase SQL Editor में नीचे दिया गया SQL चलाएं:
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(planSqlMigration);
                    showFeedback('SQL Migration क्लिपबोर्ड पर कॉपी हो गया!');
                  }}
                  className="btn-3d btn-3d-gold px-3.5 py-1.5 rounded-xl text-xs font-black text-amber-950 flex items-center gap-1.5 shrink-0 self-start"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>SQL कॉपी करें</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-black/60 border border-amber-500/20 text-[11px] font-mono text-amber-200 overflow-x-auto whitespace-pre-wrap">
                {planSqlMigration}
              </pre>
            </div>
          )}

          {!membershipOverview ? (
            <div className="p-8 rounded-3xl bg-[#120726] border border-purple-500/20 text-center text-xs text-purple-300">
              {membershipLoading ? 'Supabase से सदस्यता विवरण लोड हो रहा है...' : 'डेटा उपलब्ध नहीं है।'}
            </div>
          ) : (
            <>
              {/* 1. Paid Membership Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-gradient-to-br from-[#1a0833] to-[#110524] border border-purple-500/30 shadow-xl space-y-1.5">
                  <span className="text-xs font-bold text-purple-300">कुल Paid Membership खरीदार</span>
                  <div className="text-3xl font-black text-white">
                    {membershipOverview.summary.totalPaidBuyers}
                  </div>
                  <p className="text-[11px] text-purple-300/70">
                    कुल स्वीकृत ऑर्डर: {membershipOverview.summary.totalApprovedOrders}
                  </p>
                </div>

                <div className="p-5 rounded-3xl bg-gradient-to-br from-[#0d2622] to-[#081512] border border-emerald-500/40 shadow-xl space-y-1.5">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> अभी Active Memberships
                  </span>
                  <div className="text-3xl font-black text-emerald-400">
                    {membershipOverview.summary.activePaidMembers}
                  </div>
                  <p className="text-[11px] text-emerald-200/70">
                    कुल सक्रिय VIP (मैनुअल सहित): {membershipOverview.summary.totalActiveVipUsers}
                  </p>
                </div>

                <div className="p-5 rounded-3xl bg-gradient-to-br from-[#2b1020] to-[#160710] border border-red-500/35 shadow-xl space-y-1.5">
                  <span className="text-xs font-bold text-red-300">Expire हो चुकी Memberships</span>
                  <div className="text-3xl font-black text-red-400">
                    {membershipOverview.summary.expiredPaidMembers}
                  </div>
                  <p className="text-[11px] text-red-200/70">
                    वैधता समाप्त या निष्क्रिय
                  </p>
                </div>

                <div className="p-5 rounded-3xl bg-gradient-to-br from-[#2a1707] to-[#160b04] border border-amber-500/45 shadow-xl space-y-1.5">
                  <span className="text-xs font-bold text-amber-300">Paid Membership से कुल कमाई</span>
                  <div className="text-3xl font-black text-amber-300 text-3d-gold">
                    ₹{formatMoneyDisplay(membershipOverview.summary.totalMembershipRevenue)}
                  </div>
                  <p className="text-[11px] text-amber-200/75">
                    केवल Approved ({membershipOverview.summary.pendingPaymentsCount} Pending, {membershipOverview.summary.rejectedPaymentsCount} Rejected शामिल नहीं)
                  </p>
                </div>
              </div>

              {/* 2. Editable Membership Plans & Plan-wise Statistics */}
              <div className="rounded-3xl bg-[#120726] border border-purple-500/25 p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      🛠️ सभी Membership Plans — संपादन, कीमत, Discount व कमाई ({plans.length})
                    </h3>
                    <p className="text-xs text-purple-300/75">
                      किसी भी प्लान की कीमत, अवधि, छूट (Discount), फीचर्स या Active/Inactive स्थिति बदलें — सभी बदलाव सीधे Supabase <code className="font-mono text-purple-200">membership_plans</code> में सेव होते हैं।
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(plans.length > 0 ? plans : membershipOverview.plans).map((planItem) => {
                    const statsMatch = membershipOverview.plans.find((sp) => sp.id === planItem.id);
                    const purchaseCount = statsMatch?.purchaseCount ?? 0;
                    const totalRevenue = statsMatch?.totalRevenue ?? 0;
                    const origPrice =
                      planItem.originalPrice !== undefined && planItem.originalPrice > 0
                        ? planItem.originalPrice
                        : planItem.price;
                    const hasDiscount = origPrice > planItem.price;
                    const discountText =
                      planItem.discountType === 'percentage' && (planItem.discountPercentage || 0) > 0
                        ? `${formatMoneyDisplay(planItem.discountPercentage || 0)}% OFF`
                        : hasDiscount
                          ? `₹${formatMoneyDisplay(origPrice - planItem.price)} OFF`
                          : null;

                    return (
                      <div
                        key={planItem.id}
                        className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition ${
                          planItem.isActive
                            ? 'bg-purple-950/40 border-purple-500/35'
                            : 'bg-black/40 border-red-900/40 opacity-85'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-black text-white">{planItem.hindiName}</span>
                                {planItem.badgeText && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    {planItem.badgeText}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-purple-300">{planItem.name}</div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                                planItem.isActive
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-red-500/20 text-red-300 border-red-500/40'
                              }`}
                            >
                              {planItem.isActive ? '✓ Active' : '✕ Inactive'}
                            </span>
                          </div>

                          <div className="flex items-end justify-between border-y border-purple-900/40 py-2.5 gap-2">
                            <div>
                              <span className="text-[10px] text-purple-400 block">वर्तमान कीमत (Selling Price)</span>
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-2xl font-black text-amber-400">
                                  ₹{formatMoneyDisplay(planItem.price)}
                                </span>
                                {hasDiscount && (
                                  <span className="text-xs text-purple-400 line-through font-bold">
                                    ₹{formatMoneyDisplay(origPrice)}
                                  </span>
                                )}
                              </div>
                              {discountText && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                                  🏷️ {discountText}
                                </span>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-purple-400 block">अवधि (Duration)</span>
                              <span className="text-xs font-bold text-white">
                                {formatPlanDurationPreview(Number(planItem.durationDays) || 0)}
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] text-purple-200/80 line-clamp-2">
                            {planItem.description}
                          </p>

                          {Array.isArray(planItem.features) && planItem.features.length > 0 && (
                            <ul className="space-y-1 text-[11px] text-purple-300/90">
                              {planItem.features.slice(0, 3).map((feat, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <Check className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                  <span className="truncate">{feat}</span>
                                </li>
                              ))}
                              {planItem.features.length > 3 && (
                                <li className="text-[10px] text-purple-400 pl-4">
                                  +{planItem.features.length - 3} और फीचर्स...
                                </li>
                              )}
                            </ul>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-black/30 border border-purple-500/20">
                              <span className="text-[10px] text-purple-400 block">कितनी बार खरीदा गया</span>
                              <span className="text-sm font-black text-white">{purchaseCount} बार</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30">
                              <span className="text-[10px] text-amber-300/80 block">इस Plan से कमाई</span>
                              <span className="text-sm font-black text-amber-300">
                                ₹{formatMoneyDisplay(totalRevenue)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Plan Action Buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-purple-900/40">
                          <button
                            type="button"
                            onClick={() => openEditPlanModal(planItem as MembershipPlan)}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/35 text-xs font-bold text-white flex items-center justify-center gap-1 transition"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Edit करें</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTogglePlanActive(planItem as MembershipPlan)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                              planItem.isActive
                                ? 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-200 border-amber-500/35'
                                : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 border-emerald-500/35'
                            }`}
                            title={planItem.isActive ? 'प्लान Inactive करें' : 'प्लान Active करें'}
                          >
                            {planItem.isActive ? 'Inactive करें' : 'Active करें'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRequestDeletePlan(planItem as MembershipPlan)}
                            className="p-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/70 border border-red-500/30 text-red-300 transition"
                            title="प्लान हटाएं"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {membershipOverview.otherPlansStats && membershipOverview.otherPlansStats.purchaseCount > 0 && (
                  <div className="p-3 rounded-xl bg-purple-950/50 border border-purple-500/25 flex items-center justify-between text-xs text-purple-200">
                    <span>अन्य / पुराने कस्टम प्लान पेमेंट्स ({membershipOverview.otherPlansStats.purchaseCount} बार खरीदे गए)</span>
                    <span className="font-black text-amber-300">
                      ₹{formatMoneyDisplay(membershipOverview.otherPlansStats.totalRevenue)}
                    </span>
                  </div>
                )}
              </div>

              {/* 3. User-wise Membership Details Table */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      👥 उपयोगकर्ता-वार सदस्यता विवरण (User-wise Membership Details)
                    </h3>
                    <p className="text-xs text-purple-300/75">
                      प्रत्येक सदस्यता पेमेंट का प्लान, अवधि, भुगतान/शुरू/समाप्ति तारीख और वास्तविक स्थिति।
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="नाम, ईमेल या प्लान खोजें..."
                        value={membershipSearch}
                        onChange={(e) => setMembershipSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white text-xs w-52"
                      />
                      <Search className="w-3.5 h-3.5 text-purple-400 absolute left-2.5 top-2 pointer-events-none" />
                    </div>
                    {(['all', 'active', 'expired', 'approved', 'pending', 'rejected'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setMembershipFilter(f)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                          membershipFilter === f
                            ? 'btn-3d-gold text-amber-950'
                            : 'bg-purple-950/50 text-purple-300 border border-purple-500/20 hover:text-white'
                        }`}
                      >
                        {f === 'all'
                          ? 'सभी'
                          : f === 'active'
                          ? 'Active'
                          : f === 'expired'
                          ? 'Expired'
                          : f === 'approved'
                          ? 'Approved'
                          : f === 'pending'
                          ? 'Pending'
                          : 'Rejected'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-[#120726] border border-purple-500/20 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-purple-200">
                      <thead className="bg-purple-950/60 text-purple-300 uppercase font-mono text-[10px] tracking-wider border-b border-purple-900/40">
                        <tr>
                          <th className="p-3.5">User नाम & Email</th>
                          <th className="p-3.5">Membership Plan</th>
                          <th className="p-3.5">कीमत</th>
                          <th className="p-3.5">अवधि</th>
                          <th className="p-3.5">Payment तारीख</th>
                          <th className="p-3.5">शुरू तारीख</th>
                          <th className="p-3.5">Expiry तारीख</th>
                          <th className="p-3.5">Membership स्थिति</th>
                          <th className="p-3.5">Payment स्थिति</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-900/30">
                        {membershipOverview.userMemberships
                          .filter((row) => {
                            if (membershipFilter === 'active' && row.membershipStatus !== 'active') return false;
                            if (membershipFilter === 'expired' && row.membershipStatus !== 'expired') return false;
                            if (membershipFilter === 'approved' && row.paymentStatus !== 'approved') return false;
                            if (membershipFilter === 'pending' && row.paymentStatus !== 'pending') return false;
                            if (membershipFilter === 'rejected' && row.paymentStatus !== 'rejected') return false;
                            const q = membershipSearch.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              row.userName.toLowerCase().includes(q) ||
                              row.userEmail.toLowerCase().includes(q) ||
                              row.planName.toLowerCase().includes(q)
                            );
                          })
                          .map((row) => (
                            <tr key={row.paymentId} className="hover:bg-purple-900/20 transition">
                              <td className="p-3.5">
                                <div className="font-bold text-white">{row.userName}</div>
                                <div className="text-[11px] font-mono text-purple-300">{row.userEmail}</div>
                              </td>
                              <td className="p-3.5 font-semibold text-purple-100">{row.planName}</td>
                              <td className="p-3.5 font-black text-amber-400 whitespace-nowrap">₹{row.amount}</td>
                              <td className="p-3.5 whitespace-nowrap text-purple-200">{row.durationLabel}</td>
                              <td className="p-3.5 font-mono text-[11px] text-purple-300 whitespace-nowrap">
                                {new Date(row.paymentDate).toLocaleDateString('hi-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="p-3.5 font-mono text-[11px] text-purple-300 whitespace-nowrap">
                                {row.startDate
                                  ? new Date(row.startDate).toLocaleDateString('hi-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : '—'}
                              </td>
                              <td className="p-3.5 font-mono text-[11px] text-purple-300 whitespace-nowrap">
                                {row.expiresAt
                                  ? new Date(row.expiresAt).toLocaleDateString('hi-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : '—'}
                              </td>
                              <td className="p-3.5 whitespace-nowrap">
                                {row.membershipStatus === 'active' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                                    ✓ Active
                                  </span>
                                ) : row.membershipStatus === 'expired' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-950/80 text-red-300 border border-red-500/40">
                                    ⌛ Expired
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-950/70 text-purple-300 border border-purple-500/30">
                                    — सक्रिय नहीं
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${
                                    row.paymentStatus === 'approved'
                                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                      : row.paymentStatus === 'pending'
                                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                      : 'bg-red-950/80 text-red-300 border-red-500/40'
                                  }`}
                                >
                                  {row.paymentStatus === 'approved'
                                    ? '✓ Approved'
                                    : row.paymentStatus === 'pending'
                                    ? '⏳ Pending'
                                    : '✕ Rejected'}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {membershipOverview.userMemberships.filter((row) => {
                    if (membershipFilter === 'active' && row.membershipStatus !== 'active') return false;
                    if (membershipFilter === 'expired' && row.membershipStatus !== 'expired') return false;
                    if (membershipFilter === 'approved' && row.paymentStatus !== 'approved') return false;
                    if (membershipFilter === 'pending' && row.paymentStatus !== 'pending') return false;
                    if (membershipFilter === 'rejected' && row.paymentStatus !== 'rejected') return false;
                    const q = membershipSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      row.userName.toLowerCase().includes(q) ||
                      row.userEmail.toLowerCase().includes(q) ||
                      row.planName.toLowerCase().includes(q)
                    );
                  }).length === 0 && (
                    <div className="py-12 text-center text-xs text-purple-400">
                      चयनित फ़िल्टर के अनुसार कोई सदस्यता रिकॉर्ड नहीं मिला।
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: NOVEL MANAGEMENT */}
      {activeTab === 'novels' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">सभी उपन्यास ({novels.length})</h2>
            <button
              onClick={() => handleOpenNovelModal()}
              className="btn-3d btn-3d-gold px-4 py-2 rounded-xl text-xs font-black text-amber-950 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>नया उपन्यास जोड़ें (Add Novel)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {novels.map((novel) => (
              <div
                key={novel.id}
                className="rounded-2xl bg-[#120726] border border-purple-500/20 overflow-hidden shadow-lg flex flex-col justify-between"
              >
                <div className="relative aspect-video bg-black">
                  <img
                    src={novel.coverImage}
                    alt={novel.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1.5 left-1.5 flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleNovelPremium(novel.id);
                      }}
                      title="क्लिक करें: VIP / FREE बदलें"
                      className="cursor-pointer hover:scale-105 transition"
                    >
                      {novel.isPremium ? (
                        <span className="vip-badge-3d px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-black text-amber-950">
                          VIP
                        </span>
                      ) : (
                        <span className="free-badge-3d px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold text-white">
                          FREE
                        </span>
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleNovelPublish(novel.id);
                      }}
                      title="क्लिक करें: प्रकाशित / अप्रकाशित बदलें"
                      className="cursor-pointer hover:scale-105 transition"
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border ${
                          novel.isPublished
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-950 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {novel.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </button>

                    {novel.isFeatured && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-purple-600 text-white">
                        Featured
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                    {novel.title || novel.hindiTitle}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-purple-400">
                    अध्याय: {novel.totalChapters} • व्यूज: {novel.views}
                  </p>

                  <div className="pt-2 sm:pt-3 border-t border-purple-900/30 flex items-center justify-between gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedNovelId(novel.id);
                        setActiveTab('chapters');
                      }}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-purple-900/40 text-purple-200 hover:text-white text-[10px] sm:text-xs font-semibold truncate"
                    >
                      अध्याय ({novel.totalChapters})
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenNovelModal(novel)}
                        className="p-1 sm:p-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/80 text-purple-300 hover:text-white"
                        title="संपादित करें"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNovel(novel.id)}
                        className="p-1 sm:p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 hover:text-white"
                        title="हटाएं"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CHAPTER MANAGEMENT */}
      {activeTab === 'chapters' && (
        <div className="space-y-6 w-full max-w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#120726] border border-purple-500/20">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-purple-300 shrink-0">उपन्यास चुनें:</span>
              <select
                value={selectedNovelId}
                onChange={(e) => setSelectedNovelId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-purple-950 border border-purple-500/30 text-white text-xs font-semibold focus:outline-none max-w-[200px] sm:max-w-xs truncate"
              >
                {novels.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title || n.hindiTitle}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenChapterModal()}
              disabled={!selectedNovelId}
              className="btn-3d btn-3d-gold px-4 py-2 rounded-xl text-xs font-black text-amber-950 flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>नया अध्याय जोड़ें (Add Chapter)</span>
            </button>
          </div>

          {/* Chapters Table Container with Smooth Mobile Horizontal Scrolling */}
          <div className="w-full max-w-full min-w-0 rounded-3xl bg-[#120726] border border-purple-500/20 shadow-xl overflow-hidden">
            {/* Mobile Touch Swipe Indicator */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-purple-950/90 via-purple-900/50 to-purple-950/90 border-b border-purple-900/40 flex items-center justify-between sm:hidden text-[11px] text-purple-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="animate-pulse">👉</span>
                <span>दाएँ-बाएँ स्वाइप करें (Swipe left/right to view all columns)</span>
              </span>
              <span className="font-mono text-[10px] text-amber-400 font-bold bg-purple-900/60 px-2 py-0.5 rounded-md">
                {chapters.length} अध्याय
              </span>
            </div>

            {/* Scrollable Container with Hardware Acceleration and Touch Pan */}
            <div 
              className="w-full max-w-full overflow-x-auto touch-pan-x overscroll-x-contain"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <table className="w-full min-w-[720px] text-left text-xs text-purple-200 border-collapse">
                <thead className="bg-purple-950/60 text-purple-300 uppercase font-mono text-[10px] tracking-wider border-b border-purple-900/40 whitespace-nowrap">
                  <tr>
                    <th className="p-4 w-14">#</th>
                    <th className="p-4 min-w-[220px]">अध्याय शीर्षक</th>
                    <th className="p-4 w-32 text-center whitespace-nowrap">प्रकार (Type)</th>
                    <th className="p-4 w-44 whitespace-nowrap">Telegram ऑडियो</th>
                    <th className="p-4 w-32 whitespace-nowrap">स्थिति</th>
                    <th className="p-4 w-28 text-right whitespace-nowrap">कार्रवाई</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/30">
                  {chapters.map((ch) => (
                    <tr key={ch.id} className="hover:bg-purple-900/20 transition whitespace-nowrap">
                      <td className="p-4 font-mono font-bold text-amber-400">#{ch.chapterNumber}</td>
                      <td className="p-4 font-bold text-white max-w-[260px] truncate" title={ch.title}>
                        {ch.title}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleChapterPremium(ch.id)}
                          className="cursor-pointer hover:scale-105 transition inline-block"
                          title="क्लिक करें: VIP / FREE बदलें"
                        >
                          {ch.isPremium ? (
                            <span className="vip-badge-3d px-2.5 py-0.5 rounded text-[10px] font-black text-amber-950 inline-flex items-center gap-1 shadow-sm">
                              <Crown className="w-3 h-3" /> VIP
                            </span>
                          ) : (
                            <span className="free-badge-3d px-2.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm">
                              FREE
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {ch.telegramMessageLink || ch.telegramAudioConfigured ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={ch.telegramMessageLink || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-950/70 border border-sky-500/40 text-sky-300 text-xs font-semibold hover:border-sky-400 hover:text-white transition"
                              title={`Telegram Link: ${ch.telegramMessageLink || 'Configured'}`}
                            >
                              <Send className="w-3.5 h-3.5 text-sky-400" />
                              <span>
                                {ch.telegramAudioAccessType === 'premium' || ch.isPremium ? 'VIP TG' : 'FREE TG'}
                              </span>
                              {ch.telegramMessageId ? (
                                <span className="text-[10px] opacity-75 font-mono">#{ch.telegramMessageId}</span>
                              ) : null}
                              <ExternalLink className="w-3 h-3 opacity-70" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-purple-400/60 text-[11px] italic">
                            लिंक नहीं है (Not Set)
                          </span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleChapterPublish(ch.id)}
                          className="cursor-pointer hover:scale-105 transition inline-block"
                          title="क्लिक करें: प्रकाशित / अप्रकाशित बदलें"
                        >
                          {ch.isPublished ? (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm">
                              प्रकाशित
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40 shadow-sm">
                              अप्रकाशित
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenChapterModal(ch)}
                          className="p-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/80 text-purple-300 hover:text-white transition inline-block"
                          title="संपादित करें"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteChapter(ch.id)}
                          className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 hover:text-white transition inline-block"
                          title="हटाएं"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {chapters.length === 0 && (
              <div className="py-12 text-center text-xs text-purple-400">
                इस उपन्यास में अभी कोई अध्याय नहीं है। ऊपर से जोड़ें।
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PAYMENTS MANAGEMENT */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <span>मैनुअल UPI भुगतान अनुरोध ({payments.length})</span>
              </h2>
              <p className="text-xs text-purple-300/80">
                UTR नंबर सत्यापित करें, स्क्रीनशॉट देखें और एक क्लिक में वीआईपी सदस्यता स्वीकृत करें।
              </p>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-purple-950/60 border border-purple-500/20 text-xs">
              {(
                [
                  { key: 'all', label: 'सभी (All)' },
                  { key: 'pending', label: 'लंबित (Pending)' },
                  { key: 'approved', label: 'स्वीकृत (Approved)' },
                  { key: 'rejected', label: 'अस्वीकार (Rejected)' }
                ] as const
              ).map((f) => {
                const count =
                  f.key === 'all' ? payments.length : payments.filter((p) => p.status === f.key).length;
                return (
                  <button
                    key={f.key}
                    onClick={() => setPaymentFilter(f.key)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                      paymentFilter === f.key
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-amber-950 shadow-md'
                        : 'text-purple-300 hover:text-white hover:bg-purple-900/40'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        paymentFilter === f.key ? 'bg-amber-950/30 text-amber-950' : 'bg-purple-900/60 text-purple-200'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl bg-[#120726] border border-purple-500/20 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-purple-200">
                <thead className="bg-purple-950/60 text-purple-300 uppercase font-mono text-[10px] tracking-wider border-b border-purple-900/40">
                  <tr>
                    <th className="p-4">तारीख</th>
                    <th className="p-4">ग्राहक नाम & ईमेल</th>
                    <th className="p-4">योजना / आइटम</th>
                    <th className="p-4">राशि</th>
                    <th className="p-4">UTR/Ref नंबर</th>
                    <th className="p-4">स्थिति</th>
                    <th className="p-4 text-right">कार्रवाई</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/30">
                  {payments
                    .filter((p) => paymentFilter === 'all' || p.status === paymentFilter)
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-purple-900/20 transition">
                        <td className="p-4 font-mono text-purple-400 whitespace-nowrap">
                          {new Date(p.createdAt).toLocaleDateString('hi-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-white">{p.userName}</div>
                          <div className="text-[11px] text-purple-400 font-mono">{p.userEmail}</div>
                        </td>
                        <td className="p-4 font-semibold text-purple-200">
                          <span className="px-2 py-0.5 rounded-lg bg-purple-900/50 border border-purple-500/20 text-purple-200 font-bold">
                            {p.itemName}
                          </span>
                        </td>
                        <td className="p-4 font-black text-amber-400 text-sm whitespace-nowrap">
                          ₹{p.amount}
                        </td>
                        <td className="p-4">
                          {p.utrNumber ? (
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="font-bold text-white bg-purple-950/80 px-2 py-1 rounded-lg border border-purple-500/30">
                                {p.utrNumber}
                              </span>
                              <button
                                onClick={() => handleCopyUtr(p.id, p.utrNumber || '')}
                                className="p-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-300 hover:text-white transition border border-purple-500/20"
                                title="UTR नंबर कॉपी करें"
                              >
                                {copiedUtrId === p.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-purple-400/60 italic font-mono">उपलब्ध नहीं</span>
                          )}
                          {p.adminNote && (
                            <div className="mt-1 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded px-2 py-0.5">
                              💬 नोट: {p.adminNote}
                            </div>
                          )}
                          {p.status === 'rejected' && p.rejectionReason && (
                            <div className="mt-1 text-[11px] text-red-300 bg-red-950/40 border border-red-500/30 rounded px-2 py-0.5">
                              ❌ कारण: {p.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                              p.status === 'approved'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-sm'
                                : p.status === 'pending'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-sm animate-pulse'
                                : 'bg-red-950/80 text-red-300 border-red-500/50'
                            }`}
                          >
                            {p.status === 'approved'
                              ? '✓ स्वीकृत (Approved)'
                              : p.status === 'pending'
                              ? '⏳ लंबित (Pending)'
                              : '✕ अस्वीकृत (Rejected)'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                          {p.screenshotPath && (
                            <button
                              onClick={() => handleViewScreenshot(p.id)}
                              className="btn-3d px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/30 inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>स्क्रीनशॉट</span>
                            </button>
                          )}
                          {p.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprovePayment(p.id)}
                                className="btn-3d btn-3d-gold px-3 py-1.5 rounded-lg text-xs font-black text-amber-950 inline-flex items-center gap-1 shadow-md hover:scale-[1.02] transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>स्वीकृत करें (Approve)</span>
                              </button>
                              <button
                                onClick={() => handleOpenRequestInfo(p.id)}
                                className="btn-3d px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-900/40 hover:bg-amber-900/70 text-amber-200 border border-amber-500/30"
                              >
                                जानकारी मांगें
                              </button>
                              <button
                                onClick={() => {
                                  setRejectionModalId(p.id);
                                  setRejectionReason('');
                                }}
                                className="btn-3d px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-900/40 hover:bg-red-900/80 text-red-200 border border-red-500/30"
                              >
                                अस्वीकार (Reject)
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {payments.filter((p) => paymentFilter === 'all' || p.status === paymentFilter).length === 0 && (
              <div className="py-12 text-center text-xs text-purple-400">
                कोई भुगतान अनुरोध नहीं मिला।
              </div>
            )}
          </div>

          {screenshotModalUrl && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
              onClick={() => {
                if (screenshotModalUrl.startsWith('blob:')) URL.revokeObjectURL(screenshotModalUrl);
                setScreenshotModalUrl(null);
              }}
            >
              <div
                className="relative max-w-lg w-full rounded-2xl bg-[#120726] border border-purple-500/40 p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span>भुगतान स्क्रीनशॉट (Payment Screenshot)</span>
                  </h3>
                  <button
                    onClick={() => {
                      if (screenshotModalUrl.startsWith('blob:')) URL.revokeObjectURL(screenshotModalUrl);
                      setScreenshotModalUrl(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-purple-900/50 text-xs text-purple-200 hover:text-white"
                  >
                    बंद करें (Close)
                  </button>
                </div>
                <img
                  src={screenshotModalUrl}
                  alt="Payment Proof"
                  className="w-full max-h-[75vh] object-contain rounded-xl border border-purple-500/30 bg-black/40"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>उपयोगकर्ता & अनुमतियां प्रबंधन ({users.length})</span>
              </h2>
              <p className="text-xs text-purple-300/80">
                उपयोगकर्ता रोल (Admin/Reader) बदलें, VIP सदस्यता दें या ब्लॉक/अनब्लॉक करें।
              </p>
            </div>
            <div className="relative max-w-xs w-full">
              <input
                type="text"
                placeholder="नाम या ईमेल से खोजें..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white text-xs"
              />
              <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2 pointer-events-none" />
            </div>
          </div>

          <div className="rounded-3xl bg-[#120726] border border-purple-500/20 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-purple-200">
                <thead className="bg-purple-950/60 text-purple-300 uppercase font-mono text-[10px] tracking-wider border-b border-purple-900/40">
                  <tr>
                    <th className="p-4">नाम</th>
                    <th className="p-4">ईमेल</th>
                    <th className="p-4">रोल (Role)</th>
                    <th className="p-4">VIP सदस्यता</th>
                    <th className="p-4">अंतिम लॉगिन</th>
                    <th className="p-4">खाता स्थिति</th>
                    <th className="p-4 text-right">कार्रवाई</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/30">
                  {users
                    .filter(
                      (u) =>
                        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                        u.email.toLowerCase().includes(userSearch.toLowerCase())
                    )
                    .map((u) => {
                      const isOwner =
                        u.email.toLowerCase() === (settings?.adminEmail || '').toLowerCase() ||
                        u.email.toLowerCase() === 'divinecult2007@gmail.com' ||
                        u.email.toLowerCase() === 'ganish9784@gmail.com';

                      return (
                        <tr key={u.id} className="hover:bg-purple-900/20 transition">
                          <td className="p-4 font-bold text-white whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isOwner && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  Owner
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-purple-300">{u.email}</td>
                          <td className="p-4 font-semibold">
                            {u.role === 'admin' ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold inline-flex items-center gap-1">
                                <Shield className="w-3 h-3 text-amber-400" />
                                <span>ADMIN</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-500/20 font-semibold">
                                📖 READER
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            {u.membership?.isActive ? (
                              u.membership.expiresAt && new Date(u.membership.expiresAt).getTime() <= Date.now() ? (
                                <span className="text-red-400 font-bold flex items-center gap-1">
                                  <span>⌛ VIP Expired</span>
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                                  <span>VIP Active</span>
                                </span>
                              )
                            ) : (
                              <span className="text-purple-400 font-mono">Free Reader</span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-[11px] text-purple-300 whitespace-nowrap">
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('hi-IN') : 'हाल ही में'}
                          </td>
                          <td className="p-4">
                            {u.isBlocked ? (
                              <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-500/40 font-bold">
                                🚫 अवरुद्ध (Blocked)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                                🟢 सक्रिय (Active)
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                            {/* View User Auth History */}
                            <button
                              onClick={() => {
                                setAuthLogsSelectedUser(u.id);
                                setActiveTab('authLogs');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-sky-950/60 hover:bg-sky-900 text-sky-300 border border-sky-500/30 text-[11px] font-bold"
                              title="इस उपयोगकर्ता का लॉगिन इतिहास देखें"
                            >
                              🔍 इतिहास
                            </button>

                            {/* Role Toggle Button */}
                            {!isOwner && (
                              <button
                                onClick={() =>
                                  handleUpdateUserRole(u.id, u.role === 'admin' ? 'reader' : 'admin')
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                                  u.role === 'admin'
                                    ? 'bg-purple-950/60 hover:bg-purple-900 text-purple-300 border-purple-500/30'
                                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                                }`}
                                title={u.role === 'admin' ? 'पाठक बनाएं' : 'एडमिन बनाएं'}
                              >
                                {u.role === 'admin' ? 'Make Reader' : '🛡️ Make Admin'}
                              </button>
                            )}

                            {/* VIP Membership Toggle */}
                            <button
                              onClick={() => handleToggleMembership(u.id, Boolean(u.membership?.isActive))}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold"
                            >
                              {u.membership?.isActive ? 'Revoke VIP' : 'Grant VIP (30d)'}
                            </button>

                            {/* Block / Unblock Toggle */}
                            {!isOwner && (
                              <button
                                onClick={() => handleToggleBlock(u.id, Boolean(u.isBlocked))}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                                  u.isBlocked
                                    ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/40'
                                    : 'bg-red-950/80 hover:bg-red-900 text-red-300 border-red-500/30'
                                }`}
                              >
                                {u.isBlocked ? '🟢 Unblock' : '🚫 Block'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {users.filter(
              (u) =>
                u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                u.email.toLowerCase().includes(userSearch.toLowerCase())
            ).length === 0 && (
              <div className="py-12 text-center text-xs text-purple-400">
                कोई उपयोगकर्ता नहीं मिला।
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: WEBSITE & UPI SETTINGS */}
      {activeTab === 'settings' && settings && (
        <div className="max-w-2xl mx-auto rounded-3xl bg-[#120726] border border-purple-500/30 p-6 sm:p-8 space-y-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <span>वेबसाइट & UPI सेटिंग्स (Site Settings)</span>
          </h2>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">
                वेबसाइट का नाम (Website Name)
              </label>
              <input
                type="text"
                value={settings.websiteName}
                onChange={(e) => setSettings({ ...settings, websiteName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">
                अधिकृत एडमिन ईमेल (Authorized Admin Email)
              </label>
              <input
                type="email"
                value={settings.adminEmail}
                onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs sm:text-sm font-mono"
              />
              <p className="text-[11px] text-amber-400 mt-1">
                ⚠️ केवल इस ईमेल को एडमिन अनुमतियां प्राप्त होंगी।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  सहायता ईमेल (Support Email)
                </label>
                <input
                  type="email"
                  value={settings.supportEmail || ''}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs sm:text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  सहायता फोन / व्हाट्सएप (Support Phone / WhatsApp)
                </label>
                <input
                  type="text"
                  value={settings.supportPhone || ''}
                  onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs sm:text-sm font-mono"
                />
              </div>
            </div>

            {/* UPI Settings */}
            <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-3">
              <h3 className="text-sm font-bold text-amber-400">मैनुअल UPI भुगतान सेटिंग्स</h3>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  UPI ID (e.g. crazystoryes@upi)
                </label>
                <input
                  type="text"
                  value={settings.upiId}
                  onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs sm:text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  UPI QR कोड इमेज अपलोड (Upload / Replace QR)
                </label>
                <div className="flex items-center gap-3">
                  <label className="btn-3d btn-3d-subtle px-4 py-2 rounded-xl text-xs font-bold text-purple-200 cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{qrUploading ? 'अपलोड हो रहा है...' : 'QR इमेज चुनें'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleQrUpload}
                    />
                  </label>
                  {settings.upiQrCodeUrl && (
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, upiQrCodeUrl: '' })}
                      className="text-xs text-red-400 hover:underline"
                    >
                      QR हटाएं
                    </button>
                  )}
                </div>
                {settings.upiQrCodeUrl && (
                  <div className="mt-2 p-2 rounded-xl bg-white w-24 h-24 border">
                    <img
                      src={settings.upiQrCodeUrl}
                      alt="Uploaded QR"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Announcement Banner */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-purple-200">घोषणा बार (Announcement Bar)</label>
                <label className="flex items-center gap-1 text-xs text-purple-300">
                  <input
                    type="checkbox"
                    checked={settings.announcementActive}
                    onChange={(e) =>
                      setSettings({ ...settings, announcementActive: e.target.checked })
                    }
                  />
                  <span>सक्रिय (Active)</span>
                </label>
              </div>
              <input
                type="text"
                value={settings.announcement}
                onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs sm:text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full btn-3d btn-3d-gold py-3 rounded-xl font-black text-xs sm:text-sm text-amber-950"
            >
              सेटिंग्स सुरक्षित रूप से सहेजें (Save Settings)
            </button>
          </form>
        </div>
      )}

      {/* TAB 7: SUPPORT TICKETS */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">उपयोगकर्ता सहायता टिकट ({tickets.length})</h2>

          <div className="space-y-3">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="p-5 rounded-2xl bg-[#120726] border border-purple-500/20 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{t.subject}</h3>
                    <p className="text-purple-300/80">
                      प्रेषक: <strong>{t.userName}</strong> ({t.userEmail}) • {new Date(t.createdAt).toLocaleDateString('hi-IN')}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                      t.status === 'answered'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-950 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/20 text-purple-200">
                  {t.message}
                </div>

                {t.adminReply && (
                  <div className="p-3 rounded-xl bg-purple-900/50 border border-purple-400/40">
                    <span className="font-bold text-amber-400 block mb-0.5">आपका उत्तर:</span>
                    <p className="text-white">{t.adminReply}</p>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setReplyTicketId(t.id);
                      setReplyText(t.adminReply || '');
                    }}
                    className="btn-3d btn-3d-subtle px-3 py-1.5 rounded-lg text-xs font-bold text-purple-200"
                  >
                    {t.adminReply ? 'उत्तर संपादित करें' : 'उत्तर भेजें (Reply)'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: TELEGRAM VIP & CHANNEL MANAGEMENT */}
      {activeTab === 'telegram' && (
        <div className="space-y-6 w-full max-w-full min-w-0">
          {/* Bot Diagnostics & Status Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Bot Health Card */}
            <div className="lg:col-span-7 p-6 rounded-3xl bg-gradient-to-br from-[#120826] to-[#0a0316] border border-[#229ED9]/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#229ED9]/20 border border-[#229ED9]/40 flex items-center justify-center text-[#229ED9] shadow-md">
                    <Send className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      <span>Crazy Storyes Manager Bot</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#229ED9]/20 text-[#229ED9] border border-[#229ED9]/40 font-mono">
                        Official
                      </span>
                    </h2>
                    <p className="text-xs text-purple-300/80">
                      Telegram बॉट स्थिति एवं वेबहुक डायग्नोस्टिक्स
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={loadTelegramData}
                  disabled={telegramLoading}
                  className="btn-3d btn-3d-subtle px-3 py-1.5 rounded-xl text-xs font-bold text-sky-200 border border-sky-500/30 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${telegramLoading ? 'animate-spin' : ''}`} />
                  <span>रिफ्रेश</span>
                </button>
              </div>

              {/* Status details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-1">
                  <span className="text-purple-400 font-semibold block text-[11px]">बॉट स्थिति (Bot Status)</span>
                  <div className="flex items-center gap-2">
                    {telegramBotStatus?.configured ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        सक्रिय / ऑनलाइन (Token Configured)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-bold text-amber-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        टोकन आवश्यक (TELEGRAM_BOT_TOKEN)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-purple-300">
                    बॉट: @{telegramBotStatus?.bot?.username || telegramBotStatus?.envUsername || 'CrazyStoryesManagerBot'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-1">
                  <span className="text-purple-400 font-semibold block text-[11px]">वेबहुक (Webhook Status)</span>
                  <div className="flex items-center gap-2">
                    {telegramBotStatus?.webhook?.url ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400">
                        <Check className="w-4 h-4" /> सक्रिय (Active)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-bold text-purple-300">
                        वेबहुक सेट नहीं है
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-purple-300 truncate" title={telegramBotStatus?.webhook?.url}>
                    {telegramBotStatus?.webhook?.url || 'URL सेट करें'}
                  </p>
                </div>
              </div>

              {/* Secret and Deduplication diagnostics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-1">
                  <span className="text-purple-400 font-semibold block text-[11px]">वेबहुक सीक्रेट (Webhook Secret)</span>
                  <div className="flex items-center gap-2">
                    {telegramBotStatus?.secretConfigured ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400">
                        <Check className="w-4 h-4" /> सक्रिय / सुरक्षित
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-bold text-amber-400">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        सीक्रेट अनुपलब्ध (.env)
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-1">
                  <span className="text-purple-400 font-semibold block text-[11px]">अपडेट डिडुपिकेशन (Update Deduplication)</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400">
                      <Check className="w-4 h-4" /> सक्रिय (update_id सुरक्षित)
                    </span>
                  </div>
                </div>
              </div>

              {telegramBotStatus?.webhookSecretWarning && (
                <div className="p-3 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{telegramBotStatus.webhookSecretWarning}</span>
                </div>
              )}

              {/* Webhook Configuration Input */}
              <div className="p-4 rounded-2xl bg-purple-950/60 border border-purple-500/30 space-y-2">
                <label className="block text-xs font-semibold text-purple-200">
                  🌐 Telegram Webhook URL कॉन्फ़िगर करें:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    placeholder="https://your-domain.com/api/telegram/webhook"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-purple-950 border border-purple-500/40 text-white font-mono text-xs"
                  />
                  <button
                    type="button"
                    disabled={webhookSetting || !webhookUrlInput.trim()}
                    onClick={handleSetWebhook}
                    className="btn-3d btn-3d-gold px-4 py-2 rounded-xl text-xs font-black text-amber-950 shrink-0 disabled:opacity-50"
                  >
                    {webhookSetting ? 'सहेजा जा रहा है...' : 'वेबहुक सेट करें (Set Webhook)'}
                  </button>
                </div>
              </div>
            </div>

            {/* Manual VIP Expiry Action Card */}
            <div className="lg:col-span-5 p-6 rounded-3xl bg-gradient-to-br from-[#170a2f] to-[#0d041c] border border-amber-500/30 shadow-xl space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-2 border-b border-purple-900/40 text-amber-400">
                  <Crown className="w-5 h-5" />
                  <h3 className="text-base font-black text-white">
                    VIP सदस्यता ऑटो-एक्सपायरी रनर
                  </h3>
                </div>

                <p className="text-xs text-purple-200/90 leading-relaxed mt-3">
                  Crazy Storyes का बैकग्राउंड शेड्यूलर हर <strong>10 मिनट</strong> में स्वचालित रूप से समाप्त VIP सदस्यों को VIP ऑडियो चैनल्स से रिमूव कर देता है।
                </p>

                <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/20 text-[11px] text-amber-200/80 mt-3 space-y-1">
                  <p>✓ फ्री चैनलों का एक्सेस कभी नहीं छीना जाता</p>
                  <p>✓ रिमूव होने पर यूज़र स्थायी बैन नहीं होता, रिन्यू करने पर तुरंत नया लिंक मिलता है</p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  disabled={manualRunningExpiries}
                  onClick={handleProcessExpiriesManually}
                  className="btn-3d w-full py-3 rounded-xl font-black text-xs text-amber-950 btn-3d-gold flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-transform disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${manualRunningExpiries ? 'animate-spin' : ''}`} />
                  <span>
                    {manualRunningExpiries
                      ? 'प्रोसेसिंग जारी है...'
                      : '⚡ अभी तुरंत VIP एक्सपायरी चेक करें (Run Now)'}
                  </span>
                </button>

                {manualExpiriesResult && (
                  <div className="mt-3 p-3 rounded-xl bg-purple-950/70 border border-purple-500/30 text-xs text-purple-200 space-y-1">
                    <p className="font-bold text-emerald-400">
                      ✓ परिणाम: {manualExpiriesResult.processedUsers} यूज़र जांचे गए | {manualExpiriesResult.kickedCount} रिमूव हुए | {manualExpiriesResult.errorsCount} त्रुटियां
                    </p>
                    {manualExpiriesResult.details?.length > 0 && (
                      <div className="max-h-24 overflow-y-auto text-[10px] font-mono text-purple-300 space-y-0.5 pt-1">
                        {manualExpiriesResult.details.map((d: string, i: number) => (
                          <div key={i}>{d}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NOVELS TELEGRAM CHANNELS TABLE */}
          <div className="rounded-3xl bg-[#120726] border border-purple-500/20 shadow-xl overflow-hidden space-y-4 p-5">
            {/* Multi-Group Private Architecture Guide Card */}
            <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 space-y-2">
              <div className="flex items-center gap-2 text-sky-300 font-bold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>Private Join-Request सुरक्षा नीति (Strict Private VIP Groups & Bot Approval)</span>
              </div>
              <p className="text-xs text-purple-200/90 leading-relaxed">
                सभी Premium/VIP Telegram ग्रुप्स व चैनल्स का <strong>Private (बिना Public @username और खुले लिंक के)</strong> होना अनिवार्य है। एक ही बॉट (<code className="text-white font-mono">@{telegramBotStatus?.bot?.username || 'CrazyStoryesManagerBot'}</code>) प्रत्येक Join Request पर Telegram ID + सक्रिय VIP की पुष्टि करके प्रवेश Approve या Reject करेगा।
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 text-[11px] text-purple-300/90">
                <div className="p-2.5 rounded-xl bg-purple-900/30 border border-purple-500/20 space-y-0.5">
                  <span className="font-bold text-amber-300">1. Private ग्रुप सेटिंग</span>
                  <p className="text-[10px] text-purple-400">ग्रुप/चैनल को Private रखें (@username हटाएं) और Approve New Members चालू रखें।</p>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-900/30 border border-purple-500/20 space-y-0.5">
                  <span className="font-bold text-amber-300">2. बॉट को Admin बनाएं</span>
                  <p className="text-[10px] text-purple-400">बॉट को Invite Users (Join Request Approve) व Ban Users अनुमतियां दें।</p>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-900/30 border border-purple-500/20 space-y-0.5">
                  <span className="font-bold text-amber-300">3. संख्यात्मक Chat ID दर्ज करें</span>
                  <p className="text-[10px] text-purple-400">ग्रुप का ID (-100...) दर्ज करें। खुला Invite URL न डालें।</p>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-900/30 border border-purple-500/20 space-y-0.5">
                  <span className="font-bold text-amber-300">4. ऑटो-एक्सपायरी सुरक्षा</span>
                  <p className="text-[10px] text-purple-400">VIP समाप्त होने पर स्वचालित रिमूव और नई Join Request अस्वीकार होगी।</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-purple-900/40">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-sky-400" />
                  <span>उपन्यास-वार Telegram चैनल्स (Novel Channels)</span>
                </h3>
                <p className="text-xs text-purple-300/80">
                  सभी उपन्यासों के लिए अलग-अलग कॉन्फ़िगर किए गए Telegram ऑडियो चैनल्स
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-amber-400 px-3 py-1 rounded-lg bg-purple-950 border border-purple-500/30 self-start sm:self-auto">
                {novels.filter((n) => n.telegramChannelId || n.telegramIntegrationEnabled).length} सक्रिय चैनल्स
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-purple-200 border-collapse">
                <thead className="bg-purple-950/60 text-purple-300 uppercase font-mono text-[10px] tracking-wider border-b border-purple-900/40">
                  <tr>
                    <th className="p-3">उपन्यास शीर्षक</th>
                    <th className="p-3">चैनल ID / लिंक</th>
                    <th className="p-3">चैनल का नाम</th>
                    <th className="p-3 text-center">एक्सेस प्रकार</th>
                    <th className="p-3 text-center">डिलीवरी स्थिति</th>
                    <th className="p-3 text-right">कार्रवाई</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/30">
                  {novels.map((novel) => {
                    const accessType = novel.telegramAccessType || (novel.isPremium ? 'premium' : 'free');
                    const isVipChannel = accessType === 'premium' || novel.isPremium;
                    const isPrivate = isVipChannel || novel.telegramChannelPrivacy === 'private' || Boolean(novel.telegramChannelId);
                    const hasChannel = Boolean(novel.telegramChannelId || novel.telegramChannelLink);
                    const isEnabled = Boolean(novel.telegramIntegrationEnabled);
                    const hasInvalidId = Boolean(
                      novel.telegramChannelId &&
                        (novel.telegramChannelId.startsWith('http') ||
                          novel.telegramChannelId.includes('t.me/') ||
                          novel.telegramChannelId.includes('/+'))
                    );
                    const vipMissingNumericId = Boolean(isVipChannel && isEnabled && (!novel.telegramChannelId || hasInvalidId));

                    return (
                      <tr key={novel.id} className="hover:bg-purple-900/20 transition">
                        <td className="p-3 font-bold text-white max-w-[200px] truncate">
                          <div>
                            <span>{novel.title || novel.hindiTitle}</span>
                            {!hasChannel && (
                              <span className="block text-[10px] text-purple-400 font-normal">
                                (ग्रुप अभी सेट नहीं है)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-purple-300">
                          {hasInvalidId ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>अमान्य ID (URL दर्ज है)</span>
                            </span>
                          ) : vipMissingNumericId ? (
                            <span className="text-red-400 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span>Private Chat ID अनिवार्य!</span>
                            </span>
                          ) : !isPrivate ? (
                            novel.telegramChannelLink || <span className="text-purple-500 italic">पब्लिक लिंक नहीं</span>
                          ) : (
                            <span>
                              🔒 {novel.telegramChannelId || <span className="text-purple-500 italic">Chat ID सेट नहीं</span>}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-purple-200">
                          {novel.telegramChannelName || novel.title}
                        </td>
                        <td className="p-3 text-center">
                          {accessType === 'premium' ? (
                            <span className="vip-badge-3d px-2 py-0.5 rounded text-[10px] font-black text-amber-950">
                              👑 VIP (Private)
                            </span>
                          ) : (
                            <span className="free-badge-3d px-2 py-0.5 rounded text-[10px] font-bold text-white">
                              🆓 100% फ्री
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleNovelTelegramDelivery(novel)}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition ${
                              isEnabled
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900'
                                : 'bg-purple-950 text-purple-400 border-purple-800/40 hover:bg-purple-900'
                            }`}
                            title="डिलीवरी स्थिति बदलें (Toggle Delivery)"
                          >
                            {isEnabled ? '🟢 सक्रिय' : '⚪ निष्क्रिय'}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {hasChannel && novel.telegramChannelId && !hasInvalidId && (
                              <button
                                type="button"
                                disabled={Boolean(telegramTestingChannel)}
                                onClick={() => handleCheckBotChannel(novel.telegramChannelId!)}
                                className="btn-3d btn-3d-subtle px-2.5 py-1 rounded-lg text-[10px] font-bold text-sky-300 border border-sky-500/30 flex items-center gap-1"
                                title="इस ग्रुप में बॉट एडमिन अनुमति जांचें"
                              >
                                <Activity className="w-3.5 h-3.5" />
                                <span>जांचें</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenNovelModal(novel)}
                              className="btn-3d btn-3d-subtle px-2.5 py-1 rounded-lg text-[10px] font-bold text-purple-200 flex items-center gap-1"
                              title="इस उपन्यास के लिए Telegram सेटिंग्स बदलें"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>संपादित करें</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* LINKED USERS TABLE */}
          <div className="rounded-3xl bg-[#120726] border border-purple-500/20 shadow-xl overflow-hidden space-y-3 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-purple-900/40">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>लिंक्ड Telegram उपयोगकर्ता (Linked Users)</span>
                </h3>
                <p className="text-xs text-purple-300/80">
                  वे पाठक जिन्होंने अपना Crazy Storyes खाता Telegram बॉट से लिंक किया है
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-emerald-400 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 self-start sm:self-auto">
                {users.filter((u) => u.telegram?.telegramUserId).length} लिंक्ड सदस्य
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-purple-200 border-collapse">
                <thead className="bg-purple-950/60 text-purple-300 uppercase font-mono text-[10px] tracking-wider border-b border-purple-900/40">
                  <tr>
                    <th className="p-3">यूज़र विवरण</th>
                    <th className="p-3">Telegram ID</th>
                    <th className="p-3">Telegram नाम</th>
                    <th className="p-3 text-center">VIP सदस्यता</th>
                    <th className="p-3">लिंक्ड समय</th>
                    <th className="p-3 text-right">कार्रवाई</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/30">
                  {users.filter((u) => u.telegram?.telegramUserId).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-purple-400/80">
                        अभी तक किसी पाठक ने Telegram खाता लिंक नहीं किया है।
                      </td>
                    </tr>
                  ) : (
                    users
                      .filter((u) => u.telegram?.telegramUserId)
                      .map((u) => {
                        const isUserVip = Boolean(
                          u.role === 'admin' ||
                          (u.membership?.isActive &&
                            (!u.membership.expiresAt || new Date(u.membership.expiresAt).getTime() > Date.now()))
                        );

                        return (
                          <tr key={u.id} className="hover:bg-purple-900/20 transition">
                            <td className="p-3">
                              <span className="font-bold text-white block">{u.name}</span>
                              <span className="text-[11px] text-purple-300 font-mono">{u.email}</span>
                            </td>
                            <td className="p-3 font-mono font-bold text-amber-400">
                              {u.telegram?.telegramUserId}
                            </td>
                            <td className="p-3">
                              {u.telegram?.telegramUsername ? (
                                <a
                                  href={`https://t.me/${u.telegram.telegramUsername}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sky-400 hover:underline flex items-center gap-1"
                                >
                                  <span>@{u.telegram.telegramUsername}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span>{u.telegram?.telegramFirstName || 'N/A'}</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {isUserVip ? (
                                <span className="vip-badge-3d px-2 py-0.5 rounded text-[10px] font-black text-amber-950">
                                  👑 VIP सक्रिय
                                </span>
                              ) : (
                                <span className="free-badge-3d px-2 py-0.5 rounded text-[10px] font-bold text-white">
                                  सामान्य
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-[11px] text-purple-300">
                              {u.telegram?.linkedAt
                                ? new Date(u.telegram.linkedAt).toLocaleDateString('hi-IN')
                                : 'हाल ही में'}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleUnlinkUserTelegram(u.id)}
                                className="btn-3d btn-3d-subtle px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-300 border border-red-500/30 hover:bg-red-950/60"
                              >
                                अनलिंक करें
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RECENT ACCESS & AUDIT LOGS */}
          {telegramOverview?.recentLogs && telegramOverview.recentLogs.length > 0 && (
            <div className="rounded-3xl bg-[#120726] border border-purple-500/20 shadow-xl overflow-hidden space-y-3 p-5">
              <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                  <span>हालिया Telegram ऑडिट व एक्सेस लॉग्स (Audit Logs)</span>
                </h3>
                <span className="text-[11px] font-mono text-purple-400">
                  {telegramOverview.recentLogs.length} रिकॉर्ड्स
                </span>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs text-purple-200 border-collapse">
                  <thead className="bg-purple-950/60 text-purple-300 uppercase font-mono text-[10px] tracking-wider border-b border-purple-900/40 sticky top-0">
                    <tr>
                      <th className="p-3">समय</th>
                      <th className="p-3">कार्रवाई (Action)</th>
                      <th className="p-3">उपयोगकर्ता</th>
                      <th className="p-3">Telegram ID</th>
                      <th className="p-3 text-center">स्थिति</th>
                      <th className="p-3">कारण / विवरण</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-900/30">
                    {telegramOverview.recentLogs.map((log: any) => {
                      const rawTime = log.createdAt || log.timestamp;
                      const formattedTime = rawTime
                        ? new Date(rawTime).toLocaleString('hi-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : '-';
                      const logDetails = log.details || log.reason || log.error || '-';
                      return (
                        <tr key={log.id} className="hover:bg-purple-900/20 transition font-mono text-[11px]">
                          <td className="p-3 text-purple-400 whitespace-nowrap">
                            {formattedTime}
                          </td>
                          <td className="p-3 font-bold text-white">
                            {log.action}
                          </td>
                          <td className="p-3 text-purple-300">
                            {log.userEmail || log.userId}
                          </td>
                          <td className="p-3 text-amber-400">
                            {log.telegramUserId || '-'}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.status === 'success'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                  : log.status === 'pending'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                                  : 'bg-red-950 text-red-300 border border-red-500/30'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="p-3 text-purple-300/80 max-w-xs truncate" title={logDetails}>
                            {logDetails}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PENDING & FAILED REMOVAL OPERATIONS */}
          <div className="rounded-3xl bg-[#120726] border border-purple-500/30 shadow-xl overflow-hidden space-y-3 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-900/40">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span>लंबित व असफल VIP निष्कासन (Pending VIP Removals & Auto-Retry Queue)</span>
                </h3>
                <p className="text-xs text-purple-300/80">
                  समाप्त सदस्यता वाले यूज़र्स जिन्हें बॉट नेटवर्क या परमिशन त्रुटि के कारण तुरंत नहीं हटा सका। बैकग्राउंड में सिस्टम स्वतः 5 बार पुनः प्रयास करता है।
                </p>
              </div>

              {telegramOverview?.pendingOps && telegramOverview.pendingOps.filter((o: any) => o.status === 'pending').length > 0 && (
                <button
                  type="button"
                  onClick={handleRetryAllPendingOps}
                  className="btn-3d btn-3d-gold px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-950 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>सभी लंबित पुनः प्रयास करें (Retry All)</span>
                </button>
              )}
            </div>

            {(!telegramOverview?.pendingOps || telegramOverview.pendingOps.length === 0) ? (
              <div className="p-6 text-center text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>कोई भी लंबित निष्कासन नहीं है। सभी VIP सदस्यताओं का निष्कासन पूरी तरह अप-टू-डेट है।</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-purple-200 border-collapse">
                  <thead className="bg-purple-950/60 text-purple-300 uppercase font-mono text-[10px] tracking-wider border-b border-purple-900/40">
                    <tr>
                      <th className="p-3">ऑपरेशन प्रकार</th>
                      <th className="p-3">Telegram ID</th>
                      <th className="p-3">चैनल ID</th>
                      <th className="p-3 text-center">प्रयास संख्या</th>
                      <th className="p-3">अंतिम त्रुटि</th>
                      <th className="p-3 text-center">स्थिति</th>
                      <th className="p-3 text-right">कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-900/30 font-mono text-[11px]">
                    {telegramOverview.pendingOps.map((op: any) => (
                      <tr key={op.id} className="hover:bg-purple-900/20 transition">
                        <td className="p-3 font-bold text-white uppercase">{op.operationType}</td>
                        <td className="p-3 text-amber-400">{op.telegramUserId}</td>
                        <td className="p-3 text-purple-300">{op.channelId}</td>
                        <td className="p-3 text-center">{op.retryCount} / 5</td>
                        <td className="p-3 text-red-300 max-w-xs truncate" title={op.lastError}>
                          {op.lastError || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              op.status === 'completed'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                : op.status === 'failed'
                                ? 'bg-red-950 text-red-300 border border-red-500/30'
                                : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {op.status === 'completed' ? 'पूर्ण' : op.status === 'failed' ? 'असफल (5 बार)' : 'प्रतीक्षारत (Pending)'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {op.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleRetryPendingOp(op.id)}
                              className="btn-3d btn-3d-subtle px-2.5 py-1 rounded-lg text-[10px] font-bold text-sky-200 border border-sky-500/30"
                            >
                              पुनः प्रयास
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: LOGIN & SECURITY HISTORY AUDIT */}
      {activeTab === 'authLogs' && (
        <div className="space-y-6 w-full max-w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-purple-900/40">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <span>उपयोगकर्ता लॉगिन, सत्र व सुरक्षा इतिहास (Auth & Security Audit Logs)</span>
              </h2>
              <p className="text-xs text-purple-300/80">
                प्रत्येक पंजीकरण, सफल लॉगिन, असफल प्रयास एवं लॉगआउट टोकन निरस्तीकरण का पूर्ण ऑडिट रिकॉर्ड।
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {authLogsSelectedUser && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthLogsSelectedUser(null);
                    loadAuthLogs();
                  }}
                  className="btn-3d px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>फ़िल्टर हटाएं (All Users)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => loadAuthLogs(authLogsSelectedUser || undefined)}
                disabled={authLogsLoading}
                className="btn-3d px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-950/60 hover:bg-purple-900 text-purple-200 border border-purple-500/30 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${authLogsLoading ? 'animate-spin' : ''}`} />
                <span>रिफ्रेश</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-[#120726] border border-purple-500/20 space-y-1">
              <span className="text-[11px] font-bold text-purple-400 block">कुल लॉग रिकॉर्ड्स</span>
              <div className="text-xl font-black text-white">{authLogs.length}</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#120726] border border-emerald-500/30 space-y-1">
              <span className="text-[11px] font-bold text-emerald-400 block">सफल लॉगिन (Logins)</span>
              <div className="text-xl font-black text-emerald-300">
                {authLogs.filter(l => l.eventType === 'login').length}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#120726] border border-red-500/30 space-y-1">
              <span className="text-[11px] font-bold text-red-400 block">असफल प्रयास (Security Alerts)</span>
              <div className="text-xl font-black text-red-300">
                {authLogs.filter(l => l.eventType === 'failed_login').length}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#120726] border border-blue-500/30 space-y-1">
              <span className="text-[11px] font-bold text-blue-400 block">सत्र समाप्ति (Logouts)</span>
              <div className="text-xl font-black text-blue-300">
                {authLogs.filter(l => l.eventType === 'logout').length}
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'सभी (All)' },
                { id: 'login', label: '🔑 सफल लॉगिन' },
                { id: 'failed_login', label: '❌ असफल प्रयास' },
                { id: 'logout', label: '🚪 लॉगआउट' },
                { id: 'registration', label: '✨ पंजीकरण' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAuthLogsFilter(f.id as any)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 border ${
                    authLogsFilter === f.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-purple-950/40 text-purple-300 border-purple-500/20 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative max-w-xs w-full">
              <input
                type="text"
                placeholder="ईमेल, IP या विवरण से खोजें..."
                value={authLogsSearch}
                onChange={(e) => setAuthLogsSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white text-xs"
              />
              <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Logs Table */}
          <div className="rounded-3xl bg-[#120726] border border-purple-500/20 overflow-hidden shadow-xl">
            {authLogsLoading ? (
              <div className="p-12 text-center text-xs text-purple-300">लॉगिन इतिहास लोड हो रहा है...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-purple-200 border-collapse">
                  <thead className="bg-purple-950/60 text-purple-300 uppercase font-mono text-[10px] tracking-wider border-b border-purple-900/40">
                    <tr>
                      <th className="p-3.5">समय (Timestamp)</th>
                      <th className="p-3.5">घटना प्रकार (Event)</th>
                      <th className="p-3.5">उपयोगकर्ता ईमेल</th>
                      <th className="p-3.5">IP पता</th>
                      <th className="p-3.5">डिवाइस / ब्राउज़र</th>
                      <th className="p-3.5">स्थिति</th>
                      <th className="p-3.5">कारण / विवरण</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-900/30 font-mono text-[11px]">
                    {authLogs
                      .filter(l => {
                        if (authLogsFilter !== 'all' && l.eventType !== authLogsFilter) return false;
                        if (authLogsSearch.trim()) {
                          const s = authLogsSearch.toLowerCase();
                          const matchesEmail = l.email?.toLowerCase().includes(s);
                          const matchesIp = l.ipAddress?.toLowerCase().includes(s);
                          const matchesReason = l.failureReason?.toLowerCase().includes(s);
                          const matchesDevice = l.deviceInfo?.toLowerCase().includes(s);
                          if (!matchesEmail && !matchesIp && !matchesReason && !matchesDevice) return false;
                        }
                        return true;
                      })
                      .map(log => {
                        const isSuccess = log.status === 'success';
                        const isFailed = log.eventType === 'failed_login';
                        const isLogout = log.eventType === 'logout';
                        const isReg = log.eventType === 'registration';

                        return (
                          <tr key={log.id} className="hover:bg-purple-900/20 transition">
                            <td className="p-3.5 text-purple-400 whitespace-nowrap">
                              {new Date(log.timestamp || log.createdAt).toLocaleString('hi-IN')}
                            </td>
                            <td className="p-3.5 font-bold">
                              {isReg ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-purple-900/60 text-purple-300 border border-purple-500/30">
                                  ✨ नया पंजीकरण
                                </span>
                              ) : isLogout ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950 text-blue-300 border border-blue-500/30">
                                  🚪 लॉगआउट (रिवोक्ड)
                                </span>
                              ) : isFailed ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-red-950 text-red-300 border border-red-500/40">
                                  ❌ असफल लॉगिन
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                  🔑 सफल लॉगिन
                                </span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span
                                onClick={() => {
                                  if (log.userId) {
                                    setAuthLogsSelectedUser(log.userId);
                                    loadAuthLogs(log.userId);
                                  }
                                }}
                                className={`font-bold ${log.userId ? 'text-sky-300 hover:underline cursor-pointer' : 'text-purple-300'}`}
                                title={log.userId ? 'इस यूज़र के लॉग फ़िल्टर करें' : undefined}
                              >
                                {log.email || log.userId || '-'}
                              </span>
                            </td>
                            <td className="p-3.5 text-purple-300">{log.ipAddress || '-'}</td>
                            <td className="p-3.5 text-purple-300/80 max-w-[160px] truncate" title={log.userAgent}>
                              {log.deviceInfo || 'ब्राउज़र'}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isSuccess
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-red-950 text-red-300 border border-red-500/30'
                                }`}
                              >
                                {isSuccess ? 'सफल' : 'विफल'}
                              </span>
                            </td>
                            <td className="p-3.5 text-purple-300/90 max-w-xs truncate" title={log.failureReason}>
                              {log.failureReason || '-'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NOVEL MODAL */}
      {novelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl bg-[#120726] border border-purple-500/40 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setNovelModalOpen(false)}
              className="absolute top-4 right-4 text-purple-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white mb-4">
              {editingNovel ? 'उपन्यास संपादित करें (Edit Novel)' : 'नया उपन्यास जोड़ें (Add Novel)'}
            </h3>

            <form onSubmit={handleSaveNovel} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  उपन्यास का शीर्षक (Novel Title) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="उदा. अमर योद्धा की दास्तान"
                  value={novelForm.title}
                  onChange={(e) => setNovelForm({ ...novelForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
                />
              </div>

              {/* 16:9 Cover Image Section */}
              <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-purple-200">
                    16:9 कवर इमेज (YouTube Thumbnail Aspect Ratio) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCropperOpen(true)}
                    className="btn-3d btn-3d-gold px-3 py-1 rounded-lg text-xs font-bold text-amber-950 flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>16:9 क्रॉपर खोलें (Crop Image)</span>
                  </button>
                </div>

                <div className="relative aspect-video rounded-xl overflow-hidden border border-purple-500/40 bg-black max-w-sm flex items-center justify-center">
                  {novelForm.coverImage ? (
                    <>
                      <img
                        src={novelForm.coverImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono text-purple-200 border border-purple-500/30">
                        {/^https?:\/\/.*supabase/i.test(novelForm.coverImage) ? '✓ Supabase Storage' : '16:9 HD'}
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCropperOpen(true)}
                      className="w-full h-full flex flex-col items-center justify-center gap-2 text-purple-300/80 hover:text-white hover:bg-purple-950/30 transition p-4 text-center"
                    >
                      <ImageIcon className="w-7 h-7 text-purple-400" />
                      <span className="text-xs font-semibold">
                        कवर इमेज अपलोड करने के लिए क्लिक करें (Supabase Storage)
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  विवरण / कथानक (Description) *
                </label>
                <textarea
                  rows={4}
                  required
                  value={novelForm.description}
                  onChange={(e) => setNovelForm({ ...novelForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  श्रेणियां (Categories)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allCategories.map((cat) => {
                    const isSelected = novelForm.categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          const updated = isSelected
                            ? novelForm.categories.filter((c) => c !== cat)
                            : [...novelForm.categories, cat];
                          setNovelForm({ ...novelForm, categories: updated });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                          isSelected
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-purple-950/50 border-purple-500/20 text-purple-300'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  टैग्स (अल्पविराम से अलग करें)
                </label>
                <input
                  type="text"
                  placeholder="Rebirth, OP MC, Action"
                  value={novelForm.tags}
                  onChange={(e) => setNovelForm({ ...novelForm, tags: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={novelForm.isPremium}
                    onChange={(e) => {
                      const nextPremium = e.target.checked;
                      setNovelForm((prev) => ({
                        ...prev,
                        isPremium: nextPremium,
                        telegramAccessType: nextPremium ? 'premium' : 'free',
                        telegramChannelPrivacy: nextPremium ? 'private' : prev.telegramChannelPrivacy,
                        telegramChannelLink: nextPremium ? '' : prev.telegramChannelLink,
                      }));
                    }}
                  />
                  <span>👑 VIP प्रीमियम उपन्यास</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={novelForm.isFeatured}
                    onChange={(e) => setNovelForm({ ...novelForm, isFeatured: e.target.checked })}
                  />
                  <span>⭐ होमपेज पर फ़ीचर्ड करें</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={novelForm.isPublished}
                    onChange={(e) => setNovelForm({ ...novelForm, isPublished: e.target.checked })}
                  />
                  <span>✅ प्रकाशित (Published)</span>
                </label>
              </div>

              {/* Telegram Channel Delivery Section */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#120a26] to-[#0b0417] border border-[#229ED9]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white">
                    <input
                      type="checkbox"
                      checked={novelForm.telegramIntegrationEnabled}
                      onChange={(e) => setNovelForm({ ...novelForm, telegramIntegrationEnabled: e.target.checked })}
                    />
                    <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                    <span>✈️ Telegram चैनल डिलीवरी सक्षम करें (Enable Telegram Delivery)</span>
                  </label>
                  <span className="text-[10px] text-purple-300 font-mono">
                    ऑडियो/वीडियो डायरेक्ट डिलीवरी
                  </span>
                </div>

                {novelForm.telegramIntegrationEnabled && (
                  <div className="space-y-3 pt-2 border-t border-purple-900/40 text-xs">
                    {/* Privacy Selector: Strict Private for VIP/Premium */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-purple-200 font-semibold mb-1">
                          चैनल प्रकार (Channel Privacy) *
                        </label>
                        {(novelForm.isPremium || novelForm.telegramAccessType === 'premium') ? (
                          <div className="px-3 py-2 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs font-bold">
                            🔒 केवल Private चैनल / ग्रुप (Strict Join-Request Approval)
                          </div>
                        ) : (
                          <select
                            value={novelForm.telegramChannelPrivacy}
                            onChange={(e) => setNovelForm({ ...novelForm, telegramChannelPrivacy: e.target.value as any })}
                            className="w-full px-3 py-2 rounded-xl bg-purple-950 border border-purple-500/30 text-white text-xs"
                          >
                            <option value="public">📢 पब्लिक चैनल (Public Link - केवल फ्री)</option>
                            <option value="private">🔒 प्राइवेट चैनल / ग्रुप (Private Chat ID + Bot Invites)</option>
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-purple-200 font-semibold mb-1">
                          चैनल का शीर्षक (Channel Title)
                        </label>
                        <input
                          type="text"
                          placeholder="उदा. Crazy Storyes - अमर योद्धा"
                          value={novelForm.telegramChannelName}
                          onChange={(e) => setNovelForm({ ...novelForm, telegramChannelName: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-purple-950 border border-purple-500/30 text-white text-xs"
                        />
                      </div>
                    </div>

                    {/* Conditional Input: Public Link vs Private Chat ID (VIP always forced to Private) */}
                    {(novelForm.telegramChannelPrivacy === 'public' && !(novelForm.isPremium || novelForm.telegramAccessType === 'premium')) ? (
                      <div>
                        <label className="block text-purple-200 font-semibold mb-1">
                          पब्लिक Telegram चैनल लिंक (Public Channel URL) *
                        </label>
                        <input
                          type="text"
                          placeholder="https://t.me/YourChannelName या @YourChannelName"
                          value={novelForm.telegramChannelLink}
                          onChange={(e) => setNovelForm({ ...novelForm, telegramChannelLink: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-purple-950 border border-purple-500/30 text-white font-mono text-xs"
                        />
                        <p className="text-[11px] text-purple-400/80 mt-1">
                          पाठक 'Listen on Telegram' दबाते ही सीधे इस पब्लिक चैनल में पहुँच जाएंगे।
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(novelForm.isPremium || novelForm.telegramAccessType === 'premium') && (
                          <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200/90">
                            🛡️ <strong>VIP सुरक्षा नियम:</strong> किसी भी Premium ग्रुप में Public @username या खुला लिंक नहीं होना चाहिए। Telegram में <em>Approve New Members</em> चालू रखें और बॉट को Invite + Ban एडमिन अनुमतियां दें।
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-purple-200 font-semibold mb-1">
                              प्राइवेट Telegram Chat ID *
                            </label>
                            <input
                              type="text"
                              placeholder="उदा. -1001928374650"
                              value={novelForm.telegramChannelId}
                              onChange={(e) => setNovelForm({ ...novelForm, telegramChannelId: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-purple-950 border border-purple-500/30 text-white font-mono text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-purple-200 font-semibold mb-1">
                              चैट प्रकार (Chat Type)
                            </label>
                            <select
                              value={novelForm.telegramChannelType}
                              onChange={(e) => setNovelForm({ ...novelForm, telegramChannelType: e.target.value as any })}
                              className="w-full px-3 py-2 rounded-xl bg-purple-950 border border-purple-500/30 text-white text-xs"
                            >
                              <option value="channel">📢 ब्रॉडकास्ट चैनल (Channel)</option>
                              <option value="supergroup">👥 सुपरग्रुप (Supergroup)</option>
                            </select>
                          </div>
                        </div>

                        {/* Invite URL Warning Box */}
                        {Boolean(
                          novelForm.telegramChannelId &&
                            (novelForm.telegramChannelId.trim().startsWith('http://') ||
                              novelForm.telegramChannelId.trim().startsWith('https://') ||
                              novelForm.telegramChannelId.trim().startsWith('t.me/') ||
                              novelForm.telegramChannelId.trim().includes('t.me/+') ||
                              novelForm.telegramChannelId.trim().includes('/+'))
                        ) && (
                          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-200 space-y-1.5 animate-in fade-in duration-200">
                            <div className="font-bold flex items-center gap-1.5 text-amber-300">
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>⚠️ यह एक इनवाइट लिंक (URL) है, संख्यात्मक Chat ID नहीं!</span>
                            </div>
                            <p className="text-amber-200/90 leading-relaxed">
                              प्राइवेट ग्रुप्स में व्यक्तिगत Join-Request इनवाइट लिंक और सदस्य नियंत्रण के लिए टेलीग्राम बॉट को <strong>संख्यात्मक Chat ID</strong> (उदा. <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300 font-mono">-1001928374650</code>) की आवश्यकता होती है।
                            </p>
                            <div className="pt-1 text-[10px] text-amber-300/80 leading-normal border-t border-amber-500/20">
                              <strong>💡 संख्यात्मक Chat ID कैसे प्राप्त करें?</strong><br />
                              1. बॉट को अपने नए Private ग्रुप में जोड़कर <strong>एडमिन (Admin)</strong> बनाएं।<br />
                              2. ग्रुप में <code className="text-white font-mono">@RawDataBot</code> जोड़ें या ग्रुप का कोई मैसेज <code className="text-white font-mono">@userinfobot</code> को फॉरवर्ड करें। वहाँ आपको <code className="text-white font-mono">"id": -100xxxxxxxxxx</code> मिलेगा।<br />
                              3. खुला Invite Link या @username दर्ज न करें।
                            </div>
                          </div>
                        )}

                        {/* Test Bot Admin Permission Button */}
                        <div className="pt-1 space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={!novelForm.telegramChannelId || Boolean(telegramTestingChannel)}
                              onClick={() => handleCheckBotChannel(novelForm.telegramChannelId)}
                              className="btn-3d btn-3d-subtle px-3 py-1.5 rounded-lg text-[11px] font-bold text-sky-300 border border-sky-500/30 flex items-center gap-1.5 disabled:opacity-40 self-start sm:self-auto"
                            >
                              <Activity className="w-3.5 h-3.5" />
                              <span>
                                {telegramTestingChannel === novelForm.telegramChannelId
                                  ? 'जाँच जारी है...'
                                  : '🤖 बॉट एडमिन व अनुमतियां जांचें (Check Bot Admin)'}
                              </span>
                            </button>

                            {channelTestResult[novelForm.telegramChannelId] && (
                              <span
                                className={`text-[11px] font-bold ${
                                  channelTestResult[novelForm.telegramChannelId].isAdmin &&
                                  channelTestResult[novelForm.telegramChannelId].hasRequiredPermissions !== false &&
                                  !channelTestResult[novelForm.telegramChannelId].isPublicChat
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {channelTestResult[novelForm.telegramChannelId].isAdmin &&
                                channelTestResult[novelForm.telegramChannelId].hasRequiredPermissions !== false
                                  ? `✓ एडमिन सक्रिय (Invite: ${channelTestResult[novelForm.telegramChannelId].canInviteUsers ? '✓' : '✗'}, Ban: ${channelTestResult[novelForm.telegramChannelId].canRestrictMembers ? '✓' : '✗'})`
                                  : `✗ ${channelTestResult[novelForm.telegramChannelId].error}`}
                              </span>
                            )}
                          </div>

                          {channelTestResult[novelForm.telegramChannelId]?.warning && (
                            <p className="text-[11px] text-red-300 bg-red-950/60 border border-red-500/40 p-2 rounded-lg">
                              {channelTestResult[novelForm.telegramChannelId].warning}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Access Eligibility: VIP vs Free */}
                    <div>
                      <label className="block text-purple-200 font-semibold mb-1">
                        एक्सेस पात्रता (Access Eligibility)
                      </label>
                      <select
                        value={novelForm.telegramAccessType}
                        onChange={(e) => {
                          const nextAccess = e.target.value as 'free' | 'premium';
                          setNovelForm((prev) => ({
                            ...prev,
                            telegramAccessType: nextAccess,
                            telegramChannelPrivacy: nextAccess === 'premium' ? 'private' : prev.telegramChannelPrivacy,
                            telegramChannelLink: nextAccess === 'premium' ? '' : prev.telegramChannelLink,
                          }));
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-purple-950 border border-purple-500/30 text-white text-xs"
                      >
                        <option value="free" disabled={novelForm.isPremium}>🆓 100% फ्री (सभी पंजीकृत पाठकों के लिए)</option>
                        <option value="premium">👑 केवल VIP सदस्य (Private Join-Request + Bot Approval)</option>
                      </select>
                    </div>

                    {/* Clear Telegram Config Button */}
                    <div className="pt-2 flex items-center justify-between border-t border-purple-900/30">
                      <span className="text-[11px] text-purple-400/80">
                        💡 आप बाद में कभी भी नए ग्रुप बना सकते हैं और इस उपन्यास से जोड़ सकते हैं।
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setNovelForm({
                            ...novelForm,
                            telegramIntegrationEnabled: false,
                            telegramChannelPrivacy: 'public',
                            telegramChannelLink: '',
                            telegramChannelId: '',
                            telegramChannelName: '',
                            telegramChannelType: 'channel',
                            telegramAccessType: 'free',
                          });
                        }}
                        className="text-[11px] font-bold text-red-400 hover:text-red-300 underline transition"
                      >
                        🗑️ इस उपन्यास से Telegram कॉन्फ़िगरेशन हटाएं (Clear)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-purple-900/40">
                <button
                  type="button"
                  onClick={() => setNovelModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-purple-300"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  className="btn-3d btn-3d-primary px-6 py-2.5 rounded-xl font-bold text-xs text-white"
                >
                  सहेजें (Save Novel)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHAPTER MODAL */}
      {chapterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl bg-[#120726] border border-purple-500/40 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setChapterModalOpen(false)}
              className="absolute top-4 right-4 text-purple-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white mb-4">
              {editingChapter ? 'अध्याय संपादित करें (Edit Chapter)' : 'नया अध्याय जोड़ें (Add Chapter)'}
            </h3>

            <form onSubmit={handleSaveChapter} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-purple-200 mb-1">
                    अध्याय # *
                  </label>
                  <input
                    type="number"
                    required
                    value={chapterForm.chapterNumber}
                    onChange={(e) =>
                      setChapterForm({ ...chapterForm, chapterNumber: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-purple-200 mb-1">
                    अध्याय शीर्षक (Title) *
                  </label>
                  <input
                    type="text"
                    required
                    value={chapterForm.title}
                    onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
                  />
                </div>
              </div>

              {/* Telegram Chapter Audio Configuration (Exclusive Audio Delivery) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/70 via-purple-950/60 to-purple-900/40 border border-sky-500/40 space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-sky-400" />
                    <span>Telegram अध्याय ऑडियो लिंक (Chapter Telegram Audio Link)</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-900/80 text-sky-300 border border-sky-500/30">
                    TELEGRAM AUDIO ONLY
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="उदा: https://t.me/c/2147483648/103 या https://t.me/CrazyStoryesOfficial/101"
                      value={chapterForm.telegramMessageLink}
                      onChange={(e) => handleAutoDetectTelegramLink(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-purple-950/80 border border-sky-500/40 text-white text-xs font-mono focus:outline-none focus:border-sky-400"
                    />
                    <button
                      type="button"
                      onClick={handleTestTelegramLink}
                      className="btn-3d px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#229ED9] to-[#0088cc] hover:from-[#29b6f6] hover:to-[#0288d1] text-white flex items-center gap-1.5 shrink-0 shadow-md"
                      title="Telegram में यह लिंक खोलकर जाँचें"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>टेस्ट लिंक</span>
                    </button>
                    {chapterForm.telegramMessageLink && (
                      <button
                        type="button"
                        onClick={() =>
                          setChapterForm((prev) => ({
                            ...prev,
                            telegramMessageLink: '',
                            telegramMessageId: '',
                            telegramChatId: ''
                          }))
                        }
                        className="px-2.5 py-2.5 rounded-xl text-xs text-purple-400 hover:text-white bg-purple-900/40 hover:bg-purple-900/80 transition"
                        title="लिंक साफ़ करें"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-purple-300/80 leading-normal">
                    Telegram चैनल या सुपरग्रुप में अपलोड किए गए ऑडियो मैसेज का लिंक पेस्ट करें। Message ID व Chat ID स्वतः पहचान लिए जाएँगे।
                  </p>
                </div>

                {/* Additional Telegram Routing Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-300 mb-1">
                      Telegram Message ID
                    </label>
                    <input
                      type="number"
                      placeholder="उदा: 101"
                      value={chapterForm.telegramMessageId}
                      onChange={(e) =>
                        setChapterForm({ ...chapterForm, telegramMessageId: e.target.value ? parseInt(e.target.value, 10) : '' })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-purple-300 mb-1">
                      Telegram Chat / Channel ID
                    </label>
                    <input
                      type="text"
                      placeholder="-1002147483648 या @Channel"
                      value={chapterForm.telegramChatId}
                      onChange={(e) =>
                        setChapterForm({ ...chapterForm, telegramChatId: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-purple-300 mb-1">
                      ऑडियो एक्सेस प्रकार (Audio Access)
                    </label>
                    <select
                      value={chapterForm.telegramAudioAccessType}
                      onChange={(e) =>
                        setChapterForm({
                          ...chapterForm,
                          telegramAudioAccessType: e.target.value as 'free' | 'premium',
                          isPremium: e.target.value === 'premium' ? true : chapterForm.isPremium
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
                    >
                      <option value="free">FREE (सभी के लिए नि:शुल्क)</option>
                      <option value="premium">👑 VIP (केवल सक्रिय VIP सदस्य)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={chapterForm.isPremium}
                    onChange={(e) => setChapterForm({ ...chapterForm, isPremium: e.target.checked })}
                  />
                  <span>👑 VIP अध्याय (केवल प्रीमियम सदस्यों के लिए)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={chapterForm.isPublished}
                    onChange={(e) => setChapterForm({ ...chapterForm, isPublished: e.target.checked })}
                  />
                  <span>✅ प्रकाशित (Published)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-purple-900/40">
                <button
                  type="button"
                  onClick={() => setChapterModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-purple-300"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  className="btn-3d btn-3d-primary px-6 py-2.5 rounded-xl font-bold text-xs text-white"
                >
                  सहेजें (Save Chapter)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectionModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#120726] border border-purple-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span>भुगतान अस्वीकार करने का कारण</span>
              </h3>
              <button
                onClick={() => setRejectionModalId(null)}
                className="text-purple-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-purple-300">
              कृपया अस्वीकार करने का कारण चुनें या दर्ज करें। यह कारण उपयोगकर्ता को दिखाया जाएगा:
            </p>

            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'अमान्य या डुप्लीकेट UTR नंबर',
                'स्क्रीनशॉट स्पष्ट नहीं है',
                'बैंक खाते में राशि प्राप्त नहीं हुई',
                'गलत राशि का भुगतान किया गया'
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectionReason(reason)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                    rejectionReason === reason
                      ? 'bg-red-950 text-red-200 border-red-500'
                      : 'bg-purple-950/50 text-purple-300 border-purple-500/20 hover:border-purple-500/40'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="कारण लिखें (e.g. UTR नंबर मेल नहीं खा रहा है)..."
              className="w-full p-3 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectionModalId(null)}
                className="px-4 py-2 text-xs font-bold text-purple-300 hover:text-white"
              >
                रद्द करें
              </button>
              <button
                onClick={handleRejectPayment}
                className="btn-3d px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg"
              >
                पुष्टि करें (Reject Payment)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST INFO MODAL */}
      {requestInfoModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#120726] border border-purple-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                <span>उपयोगकर्ता से जानकारी मांगें</span>
              </h3>
              <button
                onClick={() => setRequestInfoModalId(null)}
                className="text-purple-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-purple-300">
              उपयोगकर्ता को स्पष्टीकरण या सही स्क्रीनशॉट/UTR भेजने का संदेश भेजें:
            </p>

            <div className="flex flex-wrap gap-1.5">
              {[
                'कृपया 12 अंकों का सही UTR नंबर प्रदान करें',
                'कृपया पूरा और स्पष्ट पेमेंट स्क्रीनशॉट भेजें',
                'भुगतान की सही तारीख और समय की पुष्टि करें'
              ].map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => setRequestInfoNote(template)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                    requestInfoNote === template
                      ? 'bg-amber-950 text-amber-200 border-amber-500'
                      : 'bg-purple-950/50 text-purple-300 border-purple-500/20 hover:border-purple-500/40'
                  }`}
                >
                  {template}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={requestInfoNote}
              onChange={(e) => setRequestInfoNote(e.target.value)}
              placeholder="संदेश लिखें..."
              className="w-full p-3 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRequestInfoModalId(null)}
                className="px-4 py-2 text-xs font-bold text-purple-300 hover:text-white"
              >
                रद्द करें
              </button>
              <button
                onClick={handleSubmitRequestInfo}
                className="btn-3d btn-3d-gold px-4 py-2 rounded-xl text-xs font-black text-amber-950 shadow-lg"
              >
                अनुरोध भेजें (Request Info)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBERSHIP PLAN CREATE / EDIT MODAL */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl bg-[#120726] border border-purple-500/40 p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/50">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <span>{editingPlanId ? 'Membership Plan संपादित करें (Edit Plan)' : 'नया Membership Plan जोड़ें'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setPlanModalOpen(false)}
                className="text-purple-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {planFormError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span>{planFormError}</span>
              </div>
            )}

            {planFormSqlHint && (
              <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-200">
                    Supabase SQL Editor में यह Migration चलाएं:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(planFormSqlHint);
                      showFeedback('SQL कॉपी किया गया!');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 text-amber-950 text-[11px] font-black flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>SQL कॉपी करें</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-amber-100 bg-black/50 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {planFormSqlHint}
                </pre>
              </div>
            )}

            <form onSubmit={handleSavePlan} className="space-y-4">
              {/* Names & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-purple-200 mb-1">
                    Membership Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Monthly VIP"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-purple-200 mb-1">
                    Hindi Name (हिंदी नाम) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="उदा. मासिक वीआईपी"
                    value={planForm.hindiName}
                    onChange={(e) => setPlanForm({ ...planForm, hindiName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-purple-200 mb-1">
                    Badge Text (वैकल्पिक)
                  </label>
                  <input
                    type="text"
                    placeholder="POPULAR / BEST VALUE"
                    value={planForm.badgeText}
                    onChange={(e) => setPlanForm({ ...planForm, badgeText: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs uppercase"
                  />
                </div>
              </div>

              {/* Duration Days */}
              <div className="p-4 rounded-2xl bg-purple-950/35 border border-purple-500/25 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-purple-100">
                    Membership Duration (Days) *
                  </label>
                  <span className="text-[11px] font-bold text-amber-300">
                    अनुमानित अवधि: {formatPlanDurationPreview(Number(planForm.durationDays))}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[7, 15, 30, 90, 180, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPlanForm({ ...planForm, durationDays: String(d) })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        Number(planForm.durationDays) === d
                          ? 'bg-amber-500 text-amber-950 border-amber-400'
                          : 'bg-purple-950/60 text-purple-300 border-purple-500/25 hover:text-white'
                      }`}
                    >
                      {d} दिन
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  step={1}
                  required
                  value={planForm.durationDays}
                  onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white text-xs font-mono"
                />
              </div>

              {/* Price & Discount Calculator */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/50 to-[#1a0936] border border-amber-500/30 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-black text-amber-300">
                    💰 Price और Discount प्रबंधन (Auto-Calculated Final Price)
                  </span>
                  {planForm.discountType !== 'none' && (
                    <button
                      type="button"
                      onClick={() => handlePlanDiscountModeChange('none')}
                      className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-500/40 text-[11px] font-bold text-red-200"
                    >
                      ✕ Discount हटाएं (Original Price लागू करें)
                    </button>
                  )}
                </div>

                {/* Mutually Exclusive Discount Type Selector */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'none', label: 'कोई Discount नहीं' },
                    { id: 'percentage', label: 'प्रतिशत (%) Discount' },
                    { id: 'fixed', label: 'रुपये (₹) Discount' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        handlePlanDiscountModeChange(mode.id as 'none' | 'percentage' | 'fixed')
                      }
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition ${
                        planForm.discountType === mode.id
                          ? 'bg-amber-500 text-amber-950 border-amber-400 shadow-md'
                          : 'bg-purple-950/60 text-purple-300 border-purple-500/25 hover:text-white'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-200 mb-1">
                      Original Price (मूल कीमत ₹) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      value={planForm.originalPrice}
                      onChange={(e) => handlePlanOriginalPriceChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/70 border border-purple-500/35 text-white text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    {planForm.discountType === 'percentage' ? (
                      <>
                        <label className="block text-[11px] font-semibold text-emerald-300 mb-1">
                          Discount Percentage (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="99.99"
                          step="0.01"
                          value={planForm.discountPercentage}
                          onChange={(e) => handlePlanDiscountPctChange(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/45 text-emerald-200 text-sm font-mono font-bold"
                        />
                      </>
                    ) : planForm.discountType === 'fixed' ? (
                      <>
                        <label className="block text-[11px] font-semibold text-emerald-300 mb-1">
                          Discount Amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={planForm.discountAmount}
                          onChange={(e) => handlePlanDiscountAmtChange(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/45 text-emerald-200 text-sm font-mono font-bold"
                        />
                      </>
                    ) : (
                      <>
                        <label className="block text-[11px] font-semibold text-purple-400 mb-1">
                          Discount (कोई छूट नहीं)
                        </label>
                        <input
                          type="text"
                          disabled
                          value="0 (लागू नहीं)"
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-purple-900/40 text-purple-400 text-xs"
                        />
                      </>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                      Current Selling Price (अंतिम ₹) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      value={planForm.price}
                      onChange={(e) => handlePlanSellingPriceChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-300 text-sm font-mono font-black"
                    />
                  </div>
                </div>

                {/* Live Calculation Summary */}
                <div className="p-2.5 rounded-xl bg-black/40 border border-purple-500/20 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="text-purple-200">
                    गणना: मूल मूल्य <strong>₹{planForm.originalPrice || 0}</strong>
                    {planForm.discountType === 'percentage' && Number(planForm.discountPercentage) > 0
                      ? ` − ${planForm.discountPercentage}% छूट`
                      : planForm.discountType === 'fixed' && Number(planForm.discountAmount) > 0
                        ? ` − ₹${planForm.discountAmount} छूट`
                        : ' (बिना Discount)'}
                  </span>
                  <span className="text-sm font-black text-amber-400">
                    अंतिम मूल्य: ₹{planForm.price || 0}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  Description (विवरण) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="इस प्लान के लाभों का संक्षिप्त विवरण..."
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-xs"
                />
              </div>

              {/* Features List Editor */}
              <div className="p-4 rounded-2xl bg-purple-950/35 border border-purple-500/25 space-y-2.5">
                <label className="block text-xs font-bold text-purple-100">
                  Features List (प्लान की विशेषताएँ) *
                </label>
                <div className="space-y-2">
                  {planForm.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={feat}
                        onChange={(e) => {
                          const next = [...planForm.features];
                          next[idx] = e.target.value;
                          setPlanForm({ ...planForm, features: next });
                        }}
                        placeholder={`Feature #${idx + 1}`}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = planForm.features.filter((_, i) => i !== idx);
                          setPlanForm({ ...planForm, features: next.length > 0 ? next : [''] });
                        }}
                        className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-500/30"
                        title="फ़ीचर हटाएं"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="नया Feature लिखें और जोड़ें..."
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newFeatureText.trim()) {
                          setPlanForm((prev) => ({
                            ...prev,
                            features: [...prev.features.filter(Boolean), newFeatureText.trim()]
                          }));
                          setNewFeatureText('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newFeatureText.trim()) {
                        setPlanForm((prev) => ({
                          ...prev,
                          features: [...prev.features.filter(Boolean), newFeatureText.trim()]
                        }));
                        setNewFeatureText('');
                      } else {
                        setPlanForm((prev) => ({
                          ...prev,
                          features: [...prev.features, '']
                        }));
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-800 hover:bg-purple-700 text-xs font-bold text-white flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>जोड़ें</span>
                  </button>
                </div>
              </div>

              {/* Active Status */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-950/40 border border-purple-500/25 cursor-pointer">
                <input
                  type="checkbox"
                  checked={planForm.isActive}
                  onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                <div>
                  <span className="text-xs font-bold text-white block">
                    Active Status (यूज़र्स को Premium पेज पर दिखाएं)
                  </span>
                  <span className="text-[11px] text-purple-300/75">
                    Inactive करने पर यह प्लान नई खरीद के लिए छिप जाएगा, लेकिन पुराने पेमेंट व यूज़र्स सुरक्षित रहेंगे।
                  </span>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-purple-900/50">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-purple-300 hover:text-white"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={planSaving}
                  className="btn-3d btn-3d-gold px-5 py-2 rounded-xl text-xs font-black text-amber-950 shadow-lg disabled:opacity-50"
                >
                  {planSaving
                    ? 'Supabase में सहेजा जा रहा है...'
                    : editingPlanId
                      ? 'बदलाव सहेजें (Save Changes)'
                      : 'नया प्लान बनाएं (Create Plan)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MEMBERSHIP PLAN CONFIRMATION MODAL */}
      {deletePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#120726] border border-red-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>Membership Plan हटाने की पुष्टि</span>
              </h3>
              <button
                type="button"
                onClick={() => setDeletePlanModal(null)}
                className="text-purple-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-purple-950/50 border border-purple-500/25 text-xs space-y-1">
              <div className="font-bold text-white">
                {deletePlanModal.plan.hindiName} ({deletePlanModal.plan.name})
              </div>
              <div className="text-purple-300">
                कीमत: ₹{formatMoneyDisplay(deletePlanModal.plan.price)} • अवधि: {deletePlanModal.plan.durationDays} दिन
              </div>
            </div>

            {(deletePlanModal.paymentsCount > 0 || deletePlanModal.activeUsersCount > 0) ? (
              <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-xs text-amber-100 space-y-1.5">
                <p className="font-bold text-amber-300">
                  ⚠️ चेतावनी: इस प्लान से पुराने रिकॉर्ड जुड़े हैं!
                </p>
                <p>
                  • जुड़े पेमेंट रिकॉर्ड: <strong>{deletePlanModal.paymentsCount}</strong>
                  <br />
                  • वर्तमान Active VIP यूज़र्स: <strong>{deletePlanModal.activeUsersCount}</strong>
                </p>
                <p className="text-amber-200/85">
                  स्थायी रूप से हटाने पर पुराने Payment Records और सक्रिय Users की Membership History पूरी तरह सुरक्षित रहेगी, लेकिन नई खरीद के लिए प्लान हट जाएगा। सुरक्षित विकल्प के लिए आप इसे केवल <strong>Inactive</strong> कर सकते हैं।
                </p>
              </div>
            ) : (
              <p className="text-xs text-purple-200">
                क्या आप वाकई इस Membership Plan को Supabase डेटाबेस से स्थायी रूप से हटाना चाहते हैं?
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletePlanModal(null)}
                className="px-3.5 py-2 text-xs font-bold text-purple-300 hover:text-white"
              >
                रद्द करें
              </button>

              {deletePlanModal.plan.isActive &&
                (deletePlanModal.paymentsCount > 0 || deletePlanModal.activeUsersCount > 0) && (
                  <button
                    type="button"
                    disabled={deletingPlan}
                    onClick={async () => {
                      await handleTogglePlanActive(deletePlanModal.plan);
                      setDeletePlanModal(null);
                    }}
                    className="btn-3d btn-3d-gold px-4 py-2 rounded-xl text-xs font-black text-amber-950"
                  >
                    केवल Inactive करें (सुझावित)
                  </button>
                )}

              <button
                type="button"
                disabled={deletingPlan}
                onClick={() =>
                  handleConfirmDeletePlan(
                    deletePlanModal.paymentsCount > 0 || deletePlanModal.activeUsersCount > 0
                  )
                }
                className="btn-3d px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg disabled:opacity-50"
              >
                {deletingPlan ? 'हटाया जा रहा है...' : 'स्थायी रूप से Delete करें'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 16:9 NOVEL CROPPER MODAL */}
      <NovelCropperModal
        isOpen={cropperOpen}
        onClose={() => setCropperOpen(false)}
        initialImageUrl={novelForm.coverImage}
        onCropped={(croppedUrl) => {
          setNovelForm((prev) => ({ ...prev, coverImage: croppedUrl }));
          showFeedback('16:9 कवर सफलतापूर्वक सेव हुआ!');
        }}
      />
    </div>
  );
};
