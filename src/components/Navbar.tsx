import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, Wallet } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

/** 四色套印标：C/M/Y/K 四块，呼应品牌色彩研究基因 */
function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`grid grid-cols-2 gap-[3px] ${className}`} aria-hidden="true">
      <span className="w-[9px] h-[9px] rounded-[2.5px] bg-[#0E6F9C]" />
      <span className="w-[9px] h-[9px] rounded-[2.5px] bg-[#E4007E]" />
      <span className="w-[9px] h-[9px] rounded-[2.5px] bg-[#FFD200]" />
      <span className="w-[9px] h-[9px] rounded-[2.5px] bg-[#26323B]" />
    </span>
  );
}

export default function Navbar() {
  const scrolled = useScrolled();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // 点击外部关闭用户菜单
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const goProfile = () => navigate('/profile');
  const goWallet = () => navigate('/wallet');
  const goLogin = () => navigate('/login');

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/', { replace: true });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl border-b border-brand-line shadow-[0_1px_0_rgba(23,35,44,0.02),0_8px_24px_-16px_rgba(23,35,44,0.25)]'
          : 'bg-white/70 backdrop-blur-md border-b border-transparent'
      }`}
    >
      <div className="container flex items-center justify-between h-16 px-4 lg:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <BrandMark />
          <span className="font-serif text-xl font-bold text-brand-ink tracking-wide">
            曲泉AI
          </span>
        </Link>

        <div className="flex items-center gap-2.5">
          {/* 登录 / 用户菜单（工作台入口由首页「立即体验」承担，避免重复 CTA） */}
          {isAuthenticated && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-lg hover:bg-brand-ink/[0.05] transition-colors"
                aria-label="用户菜单"
              >
                <span className="w-7 h-7 rounded-md bg-brand-primary flex items-center justify-center text-white text-xs font-semibold shrink-0">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline text-sm text-brand-ink max-w-[80px] truncate">
                  {user.username}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-brand-surface border border-brand-line rounded-xl shadow-lift p-2 animate-fade-in-up">
                  <div className="px-3 py-2 border-b border-brand-line mb-1">
                    <div className="text-sm font-medium text-brand-ink truncate">{user.username}</div>
                    <div className="text-[11px] text-brand-muted">个人中心</div>
                  </div>
                  <button
                    onClick={goProfile}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-ink hover:bg-brand-ink/[0.05] transition-colors"
                  >
                    <User className="w-4 h-4 text-brand-muted" />
                    个人主页
                  </button>
                  <button
                    onClick={() => { goWallet(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-ink hover:bg-brand-ink/[0.05] transition-colors"
                  >
                    <Wallet className="w-4 h-4 text-brand-muted" />
                    我的钱包
                  </button>
                  <div className="border-t border-brand-line my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={goLogin}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-brand-ink border border-brand-lineStrong hover:border-brand-primary/50 hover:text-brand-primary hover:bg-white transition-all"
            >
              <User className="w-4 h-4" />
              登录
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-brand-muted hover:text-brand-ink hover:bg-brand-ink/[0.05] transition-colors"
            aria-label="切换菜单"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-brand-line bg-white/95 backdrop-blur-xl">
          <div className="container px-4 py-4 flex flex-col gap-1">
            {!isAuthenticated && (
              <button
                onClick={goLogin}
                className="sm:hidden btn-secondary !py-2 !px-5 text-sm inline-flex items-center justify-center gap-1.5"
              >
                <User className="w-4 h-4" />
                登录 / 注册
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return scrolled;
}
