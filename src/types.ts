import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
  monthlyBudget?: number;
  currency?: string;
}

export interface Expense {
  id: string;
  uid: string;
  amount: number;
  category: string;
  date: Timestamp;
  note?: string;
  createdAt: Timestamp;
}

export interface Category {
  id: string;
  uid: string | null; // null for system categories
  name: string;
  icon: string;
  color: string;
}

export interface Budget {
  id: string;
  uid: string;
  categoryId: string;
  amount: number;
  month: string; // YYYY-MM
}

export type AppView = 'home' | 'budgets' | 'analytics' | 'vault' | 'add';
