// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginResponse {
  userId: number;
  accessToken: string;
  refreshToken: string;
  email: string;
  displayName: string;
  hasContext: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  displayName: string;
}

export interface UpdateProfileResponse {
  message: string;
  displayName: string;
  email: string;
}

// ─── Forgot / Reset Password ──────────────────────────────────────────────────

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  /** BE luôn trả "Nếu email tồn tại, mã OTP đã được gửi." */
  message: string;
}

export interface ResetPasswordRequest {
  email: string;
  /** Đúng 6 ký tự số */
  otpCode: string;
  /** Tối thiểu 6 ký tự */
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  hasContext: boolean;
  tier: 'Free' | 'Pro' | 'Ultra' | 'Enterprise';
  dailyQuotaLimit: number;
  remainingQuota: number;
  isUnlimited: boolean;
  roles: string[];
}

export interface QuotaResponse {
  userId: number;
  tier: 'Free' | 'Pro' | 'Ultra' | 'Enterprise';
  dailyQuotaLimit: number;
  remainingQuota: number;
  usedToday: number;
  isUnlimited: boolean;
  usagePercent: number;
  lastQuotaReset: string;
  nextResetAt: string;
  tierBenefits: {
    free: string;
    pro: string;
    enterprise: string;
  };
}

// ─── Persona ─────────────────────────────────────────────────────────────────

export interface PersonaProfile {
  userId: number;
  version: number;
  language: string;
  jobTitle: string;
  toneOfVoice: string;
  platformPreferences: string[];
  targetAudience: string[];
  contentFormats: string[];
  negativeConstraints: string[];
  updatedAt: string;
}

export interface OnboardingRequest {
  language: string;
  answers: string[];
}

export interface OnboardingResponse {
  personaVersion: number;
  status: string;
}

export interface UpdatePersonaRequest {
  jobTitle?: string;
  toneOfVoice?: string;
  language?: string;
  platformPreferences?: string[];
  targetAudience?: string[];
  contentFormats?: string[];
  negativeConstraints?: string[];
}

// ─── Content ─────────────────────────────────────────────────────────────────

export type ContentMode = 'TrendBased' | 'PersonaDriven';
export type ContentLanguage = 'vi' | 'en';

export interface GenerateContentRequest {
  outputCount: 1 | 2 | 3;
  language: ContentLanguage;
  targetPlatforms: string[];
  generateImage: boolean;
  mode: ContentMode;
  trendId?: number;
  userInstruction?: string;
}

export interface GeneratedContentItem {
  platform: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  language: string;
  mediaUrl: string | null;
  bannerImagePrompt: string;
  bestTimeToPost: string;
}

export interface GenerateContentResponse {
  items: GeneratedContentItem[];
  selectedTrendTitle: string | null;
  smartMatchReason: string;
}

export interface CheckAlignmentRequest {
  draftContent: string;
}

export interface CheckAlignmentResponse {
  brandScore: number;
  analysis: string;
  /** Gợi ý cải thiện — BE trả về string (có thể chứa nhiều dòng) */
  suggestions: string;
  refinedContent: string;
}

export interface ContentHistoryItem {
  id: number;
  userId: number;
  originalTrendId: number | null;
  generatedContent: GeneratedContentItem[];
  userEditedContent: Partial<GeneratedContentItem> | null;
  isEdited: boolean;
  mediaUrl: string | null;
  createdAt: string;
}

export interface PaginatedHistoryResponse {
  totalCount: number;
  page: number;
  pageSize: number;
  items: ContentHistoryItem[];
}

export interface EditHistoryRequest {
  body?: string;
  hook?: string;
  cta?: string;
}

// ─── Trends ──────────────────────────────────────────────────────────────────

export interface TagItem {
  id: number;
  name: string;
  slug: string;
}

export interface TrendItem {
  id: number;
  title: string;
  summary: string;
  sourceUrl: string;
  hotLevel: number;
  createdAt: string;
  tags: TagItem[];
}

export interface TrendListResponse {
  page: number;
  pageSize: number;
  total: number;
  items: TrendItem[];
}

// ─── Knowledge ───────────────────────────────────────────────────────────────

export interface KnowledgeManualRequest {
  title: string;
  rawContent: string;
}

export interface KnowledgeScrapeRequest {
  targetUrl: string;
}

export interface KnowledgeResponse {
  message: string;
  itemId: number;
  title?: string;
  fileName?: string;
  sourceUrl?: string;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type PaymentTier = 'Pro' | 'Ultra';
export type OrderStatus = 'Pending' | 'Paid' | 'Cancelled' | 'Expired';

export interface PaymentPlan {
  tier: string;
  price: number;
  billingCycle: string;
  features: string[];
}

export interface PaymentPlansResponse {
  plans: PaymentPlan[];
}

export interface CreatePaymentRequest {
  tier: PaymentTier;
}

export interface BankTransferInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
}

export interface PaymentOrder {
  orderId: number;
  orderCode: number;
  checkoutUrl: string;
  qrCodeUrl: string;
  bankTransfer: BankTransferInfo;
  expiresAt: string;
}

export interface OrderStatusResponse {
  orderId: number;
  orderCode: number;
  status: OrderStatus;
  tier: string;
  amount: number;
  paidAt: string | null;
  createdAt: string;
}

export interface SubscriptionResponse {
  userId: number;
  tier: string;
  status: 'Active' | 'NoSubscription' | 'Expired' | 'Cancelled' | 'None';
  startedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  isActive: boolean;
}

export interface PaymentHistoryItem {
  orderId: number;
  orderCode: number;
  tier: string;
  amount: number;
  status: OrderStatus;
  paidAt: string | null;
  createdAt: string;
}

export interface PaginatedPaymentHistory {
  totalCount: number;
  page: number;
  pageSize: number;
  items: PaymentHistoryItem[];
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminDashboard {
  totalUsers: number;
  activeUsers: number;
  totalContentGenerated: number;
  totalKnowledgeItems: number;
  totalTrends: number;
  activeApiKeys: number;
  coolingDownApiKeys: number;
  last7DaysContent: Array<{
    date: string;
    contentGenerated: number;
    newUsers: number;
  }>;
}

export interface AdminUser {
  id: number;
  email: string;
  displayName: string;
  isActive: boolean;
  hasContext: boolean;
  tier: string;
  dailyQuotaLimit: number;
  remainingQuota: number;
  lastQuotaReset: string;
  createdAt: string;
  roles: string[];
  totalContentGenerated: number;
}

export interface AdminUsersResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  data: AdminUser[];
}

export interface ApiKeyItem {
  id: number;
  label: string;
  keySuffix: string;
  provider: string;
  modelOverride: string | null;
  supportsImageGen: boolean;
  isActive: boolean;
  isEncrypted: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  isInCooldown: boolean;
  cooldownExpiresAt: string | null;
}

export interface CreateApiKeyRequest {
  label: string;
  keyValue: string;
  provider?: string;
  modelOverride?: string;
  supportsImageGen?: boolean;
  notes?: string;
}

export interface UpdateApiKeyRequest {
  label?: string;
  keyValue?: string;
  isActive?: boolean;
  provider?: string;
  modelOverride?: string;
  supportsImageGen?: boolean;
  notes?: string;
}

export interface SupportedModel {
  provider: string;
  modelId: string;
  displayName: string;
  supportsImageGen: boolean;
  isFree: boolean;
  notes: string;
}

export interface SupportedModelsResponse {
  total: number;
  freeModels: SupportedModel[];
  imageModels: SupportedModel[];
  allModels: SupportedModel[];
}

export interface StatsCompareRequest {
  period: 'day' | 'month' | 'quarter' | 'year';
  periodA: string;
  periodB: string;
}

export interface StatsPeriod {
  label: string;
  newUsers: number;
  activeUsers: number;
  totalContentGenerated: number;
  newKnowledgeItems: number;
  newTrends: number;
  // BE PeriodStats có thêm field này
  totalApiCalls: number;
}

export interface StatsCompareResponse {
  periodA: StatsPeriod;
  periodB: StatsPeriod;
  diff: {
    newUsersDiff: number;
    newUsersChangePercent: number;
    contentGeneratedDiff: number;
    contentGeneratedChangePercent: number;
    // BE PeriodDiff có thêm 2 fields này
    newKnowledgeDiff: number;
    newKnowledgeChangePercent: number;
    newTrendsDiff: number;
    newTrendsChangePercent: number;
  };
}

// ─── Image Generation ────────────────────────────────────────────────────────

export interface ClarifyingQuestion {
  id: string;
  question: string;
  /** yesno | choice | text_optional */
  type: 'yesno' | 'choice' | 'text_optional';
  options?: string[];
}

export interface BannerSpecs {
  platform: string;
  dimensions: string;
  aspectRatio: string;
  recommendedStyle: string;
}

export interface ImageAnalyzeRequest {
  contentHistoryId?: number;
  contentText?: string;
  platform: string;
}

export interface ImageAnalyzeResponse {
  imageSummary: string;
  draftPrompt: string;
  detectedIndustry: string;
  clarifyingQuestions: ClarifyingQuestion[];
  bannerSpecs: BannerSpecs;
}

export interface ImageGenerateRequest {
  contentHistoryId?: number;
  contentText?: string;
  platform: string;
  draftPrompt: string;
  detectedIndustry: string;
  answers: Record<string, string>;
}

export interface ImageGenerateResponse {
  imageUrl: string | null;
  finalPrompt: string;
  bannerSpecs: BannerSpecs;
  isGenerated: boolean;
  promptUsageTip: string | null;
}

// ─── Common ──────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  tier?: string;
  remainingQuota?: number;
  dailyLimit?: number;
}
