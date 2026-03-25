import React, { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User,
  googleProvider,
  auth,
  db,
  OperationType,
  handleFirestoreError
} from './firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  addDoc, 
  Timestamp, 
  doc, 
  setDoc, 
  getDoc 
} from 'firebase/firestore';
import { 
  Home, 
  PieChart, 
  Settings, 
  Plus, 
  ArrowRight, 
  ChevronRight, 
  Wallet, 
  Utensils, 
  Car, 
  ShoppingBag, 
  Coffee, 
  Zap, 
  Dumbbell, 
  Briefcase, 
  GraduationCap,
  X,
  Delete,
  LogOut,
  Bell,
  Shield,
  Moon,
  Download,
  Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, isToday, isYesterday, parseISO } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import { cn, formatCurrency } from './lib/utils';
import { UserProfile, Expense, Category, Budget, AppView } from './types';

// --- Constants ---
const SYSTEM_CATEGORIES: Category[] = [
  { id: 'dining', uid: null, name: 'Dining', icon: 'Utensils', color: '#FF6321' },
  { id: 'transport', uid: null, name: 'Transport', icon: 'Car', color: '#7C3AED' },
  { id: 'groceries', uid: null, name: 'Groceries', icon: 'ShoppingBag', color: '#10B981' },
  { id: 'coffee', uid: null, name: 'Coffee', icon: 'Coffee', color: '#F59E0B' },
  { id: 'bills', uid: null, name: 'Bills', icon: 'Zap', color: '#3B82F6' },
  { id: 'fitness', uid: null, name: 'Fitness', icon: 'Dumbbell', color: '#EF4444' },
  { id: 'work', uid: null, name: 'Work', icon: 'Briefcase', color: '#6B7280' },
  { id: 'education', uid: null, name: 'Education', icon: 'GraduationCap', color: '#8B5CF6' },
];

const ICON_MAP: Record<string, any> = {
  Utensils, Car, ShoppingBag, Coffee, Zap, Dumbbell, Briefcase, GraduationCap, Wallet
};

// --- Components ---

const IconRenderer = ({ name, className, size = 24 }: { name: string, className?: string, size?: number }) => {
  const Icon = ICON_MAP[name] || Wallet;
  return <Icon className={className} size={size} />;
};

const BottomNav = ({ activeView, setView }: { activeView: AppView, setView: (v: AppView) => void }) => {
  const navItems: { id: AppView, icon: any, label: string }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'budgets', icon: Wallet, label: 'Budgets' },
    { id: 'analytics', icon: PieChart, label: 'Analytics' },
    { id: 'vault', icon: Settings, label: 'Vault' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 px-6 py-4 pb-8 flex justify-between items-center z-50">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setView(item.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all duration-300",
            activeView === item.id ? "text-orange-400 scale-110" : "text-white/40 hover:text-white/60"
          )}
        >
          <item.icon size={24} />
          <span className="text-[10px] font-medium uppercase tracking-widest">{item.label}</span>
        </button>
      ))}
      <button 
        onClick={() => setView('add')}
        className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-orange-200 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(254,215,170,0.3)] hover:scale-110 transition-transform duration-300 z-50"
      >
        <Plus size={32} className="text-black" />
      </button>
    </div>
  );
};

const ExpenseItem = ({ expense, category }: { expense: Expense, category?: Category }) => {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-4 flex items-center justify-between group hover:bg-white/10 transition-all duration-300 cursor-pointer">
      <div className="flex items-center gap-4">
        <div 
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: category?.color + '20', color: category?.color }}
        >
          <IconRenderer name={category?.icon || 'Wallet'} size={24} />
        </div>
        <div>
          <h4 className="text-white font-medium">{expense.note || category?.name || 'Expense'}</h4>
          <p className="text-white/40 text-xs">{category?.name} • {format(expense.date.toDate(), 'h:mm a')}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-white font-semibold">-{formatCurrency(expense.amount)}</p>
      </div>
    </div>
  );
};

const BudgetProgress = ({ budget, spent, category }: { budget: Budget, spent: number, category?: Category }) => {
  const percent = Math.min((spent / budget.amount) * 100, 100);
  const isWarning = percent > 80;

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: category?.color + '20', color: category?.color }}
          >
            <IconRenderer name={category?.icon || 'Wallet'} size={20} />
          </div>
          <h4 className="text-white font-medium">{category?.name}</h4>
        </div>
        <div className="text-right">
          <p className="text-white font-semibold">{formatCurrency(spent)}</p>
          <p className="text-white/40 text-xs">of {formatCurrency(budget.amount)}</p>
        </div>
      </div>
      
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={cn("h-full rounded-full", isWarning ? "bg-orange-500" : "bg-green-500")}
          style={{ backgroundColor: category?.color }}
        />
      </div>
      
      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold">
        {isWarning && (
          <span className="text-orange-500 flex items-center gap-1">
            <Zap size={10} /> Nearing limit
          </span>
        )}
        <span className={cn("ml-auto", isWarning ? "text-orange-500" : "text-white/40")}>
          {Math.round(percent)}% used
        </span>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<AppView>('home');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Expense State
  const [amount, setAmount] = useState('0');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch/Create Profile
        const userDoc = doc(db, 'users', u.uid);
        const snap = await getDoc(userDoc);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            displayName: u.displayName,
            email: u.email,
            photoURL: u.photoURL,
            createdAt: Timestamp.now(),
            currency: '$'
          };
          await setDoc(userDoc, newProfile);
          setProfile(newProfile);
        }

        // Listen for Expenses
        const q = query(
          collection(db, 'expenses'),
          where('uid', '==', u.uid),
          orderBy('date', 'desc'),
          limit(50)
        );
        const unsubExpenses = onSnapshot(q, (snapshot) => {
          setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

        // Listen for Budgets
        const bq = query(collection(db, 'budgets'), where('uid', '==', u.uid));
        const unsubBudgets = onSnapshot(bq, (snapshot) => {
          setBudgets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Budget)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets'));

        setLoading(false);
        return () => {
          unsubExpenses();
          unsubBudgets();
        };
      } else {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExpense = async () => {
    if (!user || parseFloat(amount) <= 0 || !selectedCategory) return;

    try {
      await addDoc(collection(db, 'expenses'), {
        uid: user.uid,
        amount: parseFloat(amount),
        category: selectedCategory,
        note: note,
        date: Timestamp.now(),
        createdAt: Timestamp.now()
      });
      setAmount('0');
      setSelectedCategory('');
      setNote('');
      setView('home');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'expenses');
    }
  };

  const totalSpentToday = useMemo(() => {
    return expenses
      .filter(e => isToday(e.date.toDate()))
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses]);

  const totalSpentMonth = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return expenses
      .filter(e => e.date.toDate() >= start && e.date.toDate() <= end)
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses]);

  const chartData = useMemo(() => {
    // Simple daily trend for the last 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return format(d, 'EEE');
    });

    return days.map(day => {
      const dayTotal = expenses
        .filter(e => format(e.date.toDate(), 'EEE') === day)
        .reduce((acc, curr) => acc + curr.amount, 0);
      return { name: day, amount: dayTotal };
    });
  }, [expenses]);

  const handleExportCSV = () => {
    if (expenses.length === 0) return;
    const headers = ['Date', 'Category', 'Amount', 'Note'];
    const rows = expenses.map(e => [
      format(e.date.toDate(), 'yyyy-MM-dd HH:mm'),
      SYSTEM_CATEGORIES.find(c => c.id === e.category)?.name || e.category,
      e.amount,
      e.note || ''
    ]);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 bg-orange-200 rounded-full blur-xl"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="w-24 h-24 bg-orange-200 rounded-[40px] mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(254,215,170,0.2)]">
            <Wallet size={48} className="text-black" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white tracking-tight">Obsidian</h1>
            <p className="text-white/40 text-lg">Master your financial energy.</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full max-w-xs bg-white text-black font-bold py-4 rounded-3xl hover:bg-orange-200 transition-colors duration-300 flex items-center justify-center gap-3"
          >
            Continue with Google
            <ArrowRight size={20} />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 font-sans selection:bg-orange-200 selection:text-black">
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="p-6 space-y-8"
          >
            <header className="flex justify-between items-center pt-4">
              <div className="space-y-1">
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Spent Today</p>
                <h2 className="text-5xl font-bold tracking-tighter">{formatCurrency(totalSpentToday)}</h2>
              </div>
              <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <Settings size={20} className="text-white/20" />
                  </div>
                )}
              </div>
            </header>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FE6321" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#FE6321" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#FE6321" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorAmt)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Recent Transactions</h3>
                <button className="text-orange-400 text-sm font-medium">See all</button>
              </div>
              <div className="space-y-3">
                {expenses.slice(0, 5).map(expense => (
                  <ExpenseItem 
                    key={expense.id} 
                    expense={expense} 
                    category={SYSTEM_CATEGORIES.find(c => c.id === expense.category)} 
                  />
                ))}
                {expenses.length === 0 && (
                  <div className="text-center py-12 text-white/20">
                    <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No transactions yet</p>
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        )}

        {view === 'budgets' && (
          <motion.div
            key="budgets"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="p-6 space-y-8"
          >
            <header className="pt-4 flex justify-between items-center">
              <h2 className="text-3xl font-bold">Budgets</h2>
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                <Plus size={20} />
              </button>
            </header>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {['October', 'November', 'December'].map((m, i) => (
                <button 
                  key={m}
                  className={cn(
                    "px-6 py-2 rounded-full text-sm font-medium transition-all duration-300",
                    i === 1 ? "bg-purple-600 text-white" : "bg-white/5 text-white/40"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="relative flex flex-col items-center justify-center py-8">
              <div className="w-64 h-64 rounded-full border-[12px] border-white/5 flex flex-col items-center justify-center text-center">
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Total Spent</p>
                <h3 className="text-4xl font-bold">{formatCurrency(totalSpentMonth)}</h3>
                <p className="text-white/40 text-xs mt-1">of {formatCurrency(2000)}</p>
              </div>
              <div className="mt-8 text-center space-y-1">
                <p className="text-white/60 text-sm">62% of monthly budget used.</p>
                <p className="text-white/40 text-xs">12 days left.</p>
              </div>
            </div>

            <div className="space-y-4">
              {SYSTEM_CATEGORIES.slice(0, 3).map(cat => (
                <BudgetProgress 
                  key={cat.id}
                  category={cat}
                  budget={{ id: '1', uid: '', categoryId: cat.id, amount: 400, month: '2026-03' }}
                  spent={expenses.filter(e => e.category === cat.id).reduce((a, b) => a + b.amount, 0)}
                />
              ))}
              <button className="w-full py-6 border-2 border-dashed border-white/10 rounded-3xl text-white/40 font-medium flex items-center justify-center gap-2 hover:border-white/20 hover:text-white/60 transition-all">
                <Plus size={20} /> Create New Budget
              </button>
            </div>
          </motion.div>
        )}

        {view === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="p-6 space-y-8"
          >
            <header className="pt-4 flex justify-between items-center">
              <h2 className="text-3xl font-bold">Analytics</h2>
              <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                <Settings size={20} />
              </button>
            </header>

            <div className="bg-white/5 p-1 rounded-2xl flex">
              {['W', 'M', 'Y'].map((t, i) => (
                <button 
                  key={t}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                    i === 1 ? "bg-purple-600 text-white shadow-lg" : "text-white/40"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="text-center space-y-1">
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Total Spent</p>
              <h3 className="text-4xl font-bold">{formatCurrency(totalSpentMonth)}</h3>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <Bar dataKey="amount" radius={[10, 10, 10, 10]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 3 ? '#FE6321' : '#1A1A1A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-bold">Top Categories</h4>
              {SYSTEM_CATEGORIES.slice(0, 3).map(cat => {
                const spent = expenses.filter(e => e.category === cat.id).reduce((a, b) => a + b.amount, 0);
                const percent = Math.round((spent / totalSpentMonth) * 100) || 0;
                return (
                  <div key={cat.id} className="bg-white/5 border border-white/10 rounded-3xl p-4 flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: cat.color + '20', color: cat.color }}
                    >
                      <IconRenderer name={cat.icon} size={24} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{cat.name}</span>
                        <span className="font-bold">{formatCurrency(spent)}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${percent}%`, backgroundColor: cat.color }} />
                      </div>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{percent}% of total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {view === 'vault' && (
          <motion.div
            key="vault"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="p-6 space-y-8"
          >
            <header className="pt-4 text-center">
              <h2 className="text-3xl font-bold">Vault</h2>
            </header>

            <div className="flex flex-col items-center space-y-4">
              <div className="w-24 h-24 rounded-[40px] overflow-hidden border-4 border-white/5 shadow-[0_0_50px_rgba(255,255,255,0.05)]">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <Settings size={40} className="text-white/20" />
                  </div>
                )}
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold">{profile?.displayName}</h3>
                <p className="text-white/40 text-sm">Mindful Member since {profile?.createdAt ? format(profile.createdAt.toDate(), 'yyyy') : '2026'}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest ml-4">Accounts</p>
                <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
                  <button className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5">
                    <div className="flex items-center gap-4">
                      <Home size={20} className="text-white/60" />
                      <span className="font-medium">Linked Banks</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/40">
                      <span className="text-sm">2 Active</span>
                      <ChevronRight size={16} />
                    </div>
                  </button>
                  <button className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <ShoppingBag size={20} className="text-white/60" />
                      <span className="font-medium">Cards & Apple Pay</span>
                    </div>
                    <ChevronRight size={16} className="text-white/40" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest ml-4">Preferences</p>
                <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
                  <div className="p-5 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-4">
                      <Bell size={20} className="text-white/60" />
                      <span className="font-medium">Daily Review Reminder</span>
                    </div>
                    <div className="w-12 h-6 bg-orange-500 rounded-full relative">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                  <div className="p-5 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-4">
                      <Zap size={20} className="text-white/60" />
                      <span className="font-medium">Ambient Health Glow</span>
                    </div>
                    <div className="w-12 h-6 bg-orange-500 rounded-full relative">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                  <button className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <Moon size={20} className="text-white/60" />
                      <span className="font-medium">Appearance</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/40">
                      <span className="text-sm">Obsidian</span>
                      <ChevronRight size={16} />
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest ml-4">Data & Security</p>
                <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
                  <button 
                    onClick={handleExportCSV}
                    className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <Download size={20} className="text-white/60" />
                      <span className="font-medium">Export CSV</span>
                    </div>
                    <ChevronRight size={16} className="text-white/40" />
                  </button>
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Fingerprint size={20} className="text-white/60" />
                      <span className="font-medium">Require FaceID</span>
                    </div>
                    <div className="w-12 h-6 bg-white/10 rounded-full relative">
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white/40 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => signOut(auth)}
                className="w-full py-6 text-white/40 font-bold uppercase tracking-widest hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        )}

        {view === 'add' && (
          <motion.div
            key="add"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 bg-[#050505] z-[100] p-6 flex flex-col"
          >
            <header className="flex justify-between items-center pt-4">
              <button onClick={() => setView('home')} className="w-10 h-10 flex items-center justify-center text-white/40">
                <X size={24} />
              </button>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">New Entry</h2>
              <div className="w-10" />
            </header>

            <div className="flex-1 flex flex-col items-center justify-center space-y-12">
              <div className="text-center space-y-2">
                <h3 className="text-7xl font-bold text-orange-200 tracking-tighter">
                  ${parseFloat(amount).toFixed(2)}
                </h3>
                <p className="text-white/20 font-medium">Tap to add note</p>
              </div>

              <div className="w-full max-w-xs space-y-6">
                <div className="relative">
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-3xl p-5 appearance-none text-white font-medium focus:outline-none focus:border-orange-200 transition-colors"
                  >
                    <option value="" disabled>Select Category</option>
                    {SYSTEM_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">
                    <ChevronRight size={20} className="rotate-90" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        if (num === '.') {
                          if (!amount.includes('.')) setAmount(amount + '.');
                        } else {
                          setAmount(amount === '0' ? String(num) : amount + num);
                        }
                      }}
                      className="w-full aspect-square bg-white/5 rounded-full flex items-center justify-center text-2xl font-bold hover:bg-white/10 active:scale-95 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmount(amount.length > 1 ? amount.slice(0, -1) : '0')}
                    className="w-full aspect-square bg-white/5 rounded-full flex items-center justify-center text-white/40 hover:bg-white/10 active:scale-95 transition-all"
                  >
                    <Delete size={24} />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleAddExpense}
              disabled={parseFloat(amount) <= 0 || !selectedCategory}
              className="w-full bg-orange-200 text-black font-bold py-6 rounded-[32px] text-lg hover:bg-white transition-all disabled:opacity-20 disabled:grayscale"
            >
              Seal Entry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {view !== 'add' && <BottomNav activeView={view} setView={setView} />}
    </div>
  );
}
