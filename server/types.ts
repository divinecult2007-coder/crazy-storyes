export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'reader';
  isBlocked: boolean;
  membership: {
    isActive: boolean;
    planId?: string;
    planName?: string;
    expiresAt?: string; // ISO date string
  };
  bookmarks: string[]; // novelIds
  readingHistory: {
    novelId: string;
    chapterId: string;
    chapterNumber: number;
    novelTitle: string;
    chapterTitle: string;
    progressPercent: number;
    mode?: 'text' | 'audio';
    updatedAt: string;
  }[];
  telegram?: {
    telegramUserId: number; // Telegram numeric ID
    telegramUsername?: string;
    telegramFirstName?: string;
    linkedAt: string;
  };
  lastLoginAt?: string;
  lastLogoutAt?: string;
  createdAt: string;
}

export interface Chapter {
  id: string;
  novelId: string;
  chapterNumber: number;
  title: string;
  content?: string; // Optional in audio-only system
  audioUrl?: string; // Direct audio streaming URL (Linkulu, Telegram stream, R2)
  audioDurationSeconds?: number;
  duration?: string; // e.g. "14:20"
  isPremium: boolean;
  isPublished: boolean;
  // Chapter-wise Telegram audio message destination
  telegramMessageLink?: string; // e.g. "https://t.me/c/1234567890/42" or "https://t.me/channel_name/42"
  telegramMessageId?: number; // e.g. 42
  telegramChatId?: string; // e.g. "-1001234567890" or channel reference
  telegramDestinationType?: 'channel' | 'supergroup' | 'group';
  telegramAudioAccessType?: 'free' | 'premium';
  telegramAudioConfigured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NovelReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Novel {
  id: string;
  title: string;
  hindiTitle?: string;
  author: string;
  description: string;
  coverImage: string; // strictly 16:9 aspect ratio image URL
  categories: string[];
  tags: string[];
  isPremium: boolean; // whole novel premium flag
  isPublished: boolean;
  isFeatured: boolean;
  isTrending?: boolean;
  isPopular?: boolean;
  views: number;
  rating: number;
  ratingCount?: number;
  userRatings?: Record<string, number>;
  likes?: number;
  likedBy?: string[];
  reviews?: NovelReview[];
  totalChapters: number;
  // Novel-wise Telegram Channel Configuration
  telegramChannelPrivacy?: 'public' | 'private';
  telegramChannelLink?: string; // e.g. "https://t.me/mychannel"
  telegramChannelId?: string; // e.g. "-1001234567890" for private channels/groups
  telegramChannelName?: string;
  telegramChannelType?: 'channel' | 'supergroup';
  telegramAccessType?: 'free' | 'premium';
  telegramIntegrationEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  itemType: 'membership' | 'novel';
  itemId: string;
  itemName: string;
  amount: number;
  utrNumber?: string;
  paymentProofUrl?: string;
  screenshotPath?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface MembershipPlan {
  id: string;
  name: string;
  hindiName: string;
  originalPrice?: number;
  price: number;
  durationDays: number;
  discountType?: 'none' | 'percentage' | 'fixed';
  discountPercentage?: number;
  discountAmount?: number;
  description: string;
  features: string[];
  isActive: boolean;
  badgeText?: string;
  updatedAt?: string;
}

export interface SiteSettings {
  websiteName: string;
  tagline: string;
  adminEmail: string;
  upiId: string;
  upiQrCodeUrl: string;
  announcement: string;
  announcementActive: boolean;
  supportEmail: string;
  supportPhone: string;
  enableAiAssistant: boolean;
}

export interface SupportTicket {
  id: string;
  userId?: string;
  userName: string;
  userEmail: string;
  category: 'question' | 'problem' | 'feedback' | 'payment';
  subject: string;
  message: string;
  adminReply?: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
  repliedAt?: string;
}

// -------------------------------------------------------------
// Telegram Integration Models
// -------------------------------------------------------------

export interface TelegramLinkCode {
  id: string;
  code: string;
  userId: string;
  userEmail: string;
  userName: string;
  expiresAt: string; // ISO date string (15 mins)
  usedAt?: string;
  createdAt: string;
}

export interface TelegramAccessRecord {
  id: string;
  userId: string;
  telegramUserId: number;
  novelId: string;
  novelTitle?: string;
  channelId: string;
  channelName?: string;
  accessType: 'free' | 'premium';
  inviteLink?: string;
  status: 'pending' | 'active' | 'expired' | 'revoked' | 'rejected';
  joinedAt: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramAccessLog {
  id: string;
  userId: string;
  telegramUserId?: number;
  channelId?: string;
  novelId?: string;
  action:
    | 'link_generated'
    | 'join_requested'
    | 'join_approved'
    | 'join_rejected'
    | 'join_approval_failed'
    | 'link_revoked'
    | 'member_joined'
    | 'member_removed'
    | 'unauthorized_join_removed'
    | 'removal_failed'
    | 'retry_removal'
    | 'unlinked'
    | 'account_linked'
    | 'chapter_audio_accessed';
  status: 'success' | 'failed' | 'pending';
  details?: string;
  createdAt: string;
}

export interface TelegramPendingOperation {
  id: string;
  operationType: 'remove_member';
  userId: string;
  telegramUserId: number;
  channelId: string;
  novelId: string;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface UserAuthLog {
  id: string;
  userId?: string;
  userEmail?: string;
  email?: string;
  userName?: string;
  eventType: 'registration' | 'login' | 'logout' | 'failed_login' | 'token_revoked';
  ip?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  status?: 'success' | 'failed';
  details?: string;
  failureReason?: string;
  createdAt: string;
  timestamp?: string;
}

export interface RevokedToken {
  id: string;
  token: string;
  userId?: string;
  expiresAt: string;
  revokedAt: string;
  reason?: string;
}

export interface DatabaseSchema {
  users: User[];
  novels: Novel[];
  chapters: Chapter[];
  payments: PaymentRequest[];
  membershipPlans: MembershipPlan[];
  settings: SiteSettings;
  supportTickets: SupportTicket[];
  telegramLinkCodes: TelegramLinkCode[];
  telegramAccess: TelegramAccessRecord[];
  telegramAccessLogs: TelegramAccessLog[];
  telegramPendingOperations: TelegramPendingOperation[];
  userAuthLogs: UserAuthLog[];
  revokedTokens: RevokedToken[];
}
