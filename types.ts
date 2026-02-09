

export type ViewState = 'AUTH' | 'DASHBOARD' | 'CREATE' | 'TIMELINE' | 'ADD_ITEM' | 'ITEM_FORM' | 'EDIT_TRIP' | 'ITEM_DETAILS' | 'MANAGE_TEAM' | 'INVITE_MEMBER' | 'PROFILE' | 'BUDGET' | 'LOG_EXPENSE' | 'LEDGER' | 'JOIN_MISSION' | 'GLOBAL_LEDGER' | 'PRIVACY' | 'TERMS' | 'ONBOARDING' | 'VERIFIED' | 'FORGOT_PASSWORD' | 'UPDATE_PASSWORD';


export enum ItemType {
  STAY = 'STAY',
  TRANSPORT = 'TRANSPORT',
  ACTIVITY = 'ACTIVITY',
  FOOD = 'FOOD',
  ESSENTIALS = 'ESSENTIALS',
  SETTLEMENT = 'SETTLEMENT'
}

export type Role = 'PATHFINDER' | 'SCOUT' | 'PASSENGER';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  isCurrentUser?: boolean;
  status?: 'ACTIVE' | 'BLOCKED' | 'PENDING';
  budget?: number; // Personal budget for the trip
  pendingPastExpensesInvitation?: boolean; // Flag for late joiners invited to share past expenses
  onboardingCompleted?: boolean;
  dailyBudget?: number; // Optional daily spending limit
}

export interface ReceiptItem {
  id: string; // generated UUID for internal tracking
  name: string;
  nameRomanized?: string; // Latin characters representation (e.g. for Pinyin, Cyrillic Transliteration)
  nameEnglish?: string; // English translation
  quantity: number;
  price: number;
  type: 'food' | 'drink' | 'service' | 'tip' | 'tax' | 'deposit' | 'discount' | 'other';
  assignedTo?: string[]; // IDs of members responsible
}

export interface ResourceLink {
  id: string;
  title: string;
  url: string;
}

export interface ItineraryItem {
  id: string;
  tripId: string;
  type: ItemType;
  title: string;
  location: string;
  endLocation?: string; // Added for Transport (Origin -> Destination)
  startDate: Date;
  endDate?: Date;
  details?: string;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  endLatitude?: number;
  endLongitude?: number;
  endCountryCode?: string;
  cost: number; // Making it mandatory for budget logic
  mapUri?: string; // Google Maps URL from grounding
  rating?: string; // From Maps grounding
  tags?: string[]; // Custom labels/tags
  durationMinutes?: number; // Explicit duration from document (e.g. "8h 29m" -> 509)
  createdBy: string; // User ID of the creator
  isPrivate?: boolean; // If true, only visible to createdBy
  splitWith: string[]; // IDs of members sharing this expense
  splitDetails?: Record<string, number>; // Optional: Custom amount per member ID
  paidBy: string; // ID of the member who paid
  showInTimeline?: boolean; // Defaults to true for standard items, false for logged expenses

  // Multi-Currency Fields
  originalAmount?: number;
  currencyCode?: string;
  exchangeRate?: number;

  // Receipt Breakdown
  receiptItems?: ReceiptItem[];

  // Resources / Hyperlinks
  resources?: ResourceLink[];

  updatedAt?: number;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  startDate: Date;
  endDate: Date;
  budget: number; // Kept as reference or default
  items: ItineraryItem[];
  members: Member[];
  status?: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETE';
  coverImage?: string;
  baseCurrency?: string; // Default 'USD'
  budgetViewMode?: 'SMART' | 'DIRECT'; // Shared view setting controlled by Pathfinder
  updatedAt?: number;
}