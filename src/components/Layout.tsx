import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trophy, Users, User, LayoutDashboard, Settings, LogOut, Menu, X, ChevronRight, Activity, UserCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '@/src/lib/utils';
import { useFirebase } from './FirebaseProvider';
import { db, doc, onSnapshot, handleFirestoreError, OperationType } from '../firebase';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Matches', icon: Activity, path: '/matches' },
  { name: 'Teams', icon: Users, path: '/teams' },
  { name: 'Tournaments', icon: Trophy, path: '/tournaments' },
  { name: 'Players', icon: User, path: '/players' },
  { name: 'Profile', icon: UserCircle, path: '/profile' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useFirebase();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [profile, setProfile] = React.useState<any>(null);
  const location = useLocation();

  React.useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data());
      } else {
        setProfile({
          name: user.email?.split('@')[0] || 'User',
          email: user.email,
          photoUrl: user.photoURL
        });
      }
    });
    return () => unsubscribe();
  }, [user]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar for desktop */}
      <aside className="hidden md:flex w-72 flex-col border-r bg-card/50 backdrop-blur-xl sticky top-0 h-screen">
        <div className="p-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg group-hover:scale-110 transition-transform">
              <Trophy size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">CRICSCORE</h1>
              <span className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase">Professional</span>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5">
          <div className="px-4 mb-4">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Main Menu</span>
          </div>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive(item.path)
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} className={cn(
                  "transition-colors",
                  isActive(item.path) ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span className="font-semibold text-sm">{item.name}</span>
              </div>
              {isActive(item.path) && <ChevronRight size={14} className="opacity-50" />}
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t bg-muted/20">
          <Link to="/profile" className="flex items-center gap-3 mb-6 px-2 group hover:bg-muted/50 p-2 rounded-xl transition-colors">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold border-2 border-background overflow-hidden">
              {profile?.photoUrl ? (
                <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                profile?.name?.charAt(0) || 'U'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate group-hover:text-primary transition-colors">{profile?.name}</div>
              <div className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">Administrator</div>
            </div>
          </Link>
          <Button variant="ghost" className="w-full justify-start gap-3 h-11 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={logout}>
            <LogOut size={18} />
            <span className="font-semibold">Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-md">
            <Trophy size={18} />
          </div>
          <h1 className="text-lg font-black tracking-tighter">CRICSCORE</h1>
        </Link>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-md">
          <div className="fixed inset-y-0 left-0 w-[280px] bg-card border-r shadow-2xl flex flex-col">
            <div className="p-6 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                  <Trophy size={18} />
                </div>
                <h1 className="text-lg font-black tracking-tighter">CRICSCORE</h1>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsMobileMenuOpen(false)}>
                <X size={20} />
              </Button>
            </div>
            <nav className="flex-1 p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "hover:bg-accent"
                  )}
                >
                  <item.icon size={20} />
                  <span className="font-bold">{item.name}</span>
                </Link>
              ))}
            </nav>
            <div className="p-6 border-t bg-muted/30">
              <Link to="/profile" className="flex items-center gap-3 mb-6 px-2" onClick={() => setIsMobileMenuOpen(false)}>
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold border-2 border-background overflow-hidden">
                  {profile?.photoUrl ? (
                    <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    profile?.name?.charAt(0) || 'U'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{profile?.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">Administrator</div>
                </div>
              </Link>
              <Button variant="ghost" className="w-full justify-start gap-3 h-12 rounded-xl text-destructive hover:bg-destructive/10" onClick={logout}>
                <LogOut size={20} />
                <span className="font-bold">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-muted/10">
        <div className="max-w-7xl mx-auto p-6 md:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
