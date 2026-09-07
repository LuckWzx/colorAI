import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, Wallet } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const navLinks = [
  { name: '首页', path: '/' },
  { name: '一键校正', path: '/image-correction' },
  { name: '智能取色', path: '/color-picker' },
  { name: '色彩转换', path: '/color-converter' },
  { name: '颜色对比', path: '/color-compare' },
  { name: '手机校色', path: '/phone-correction' },
  { name: '知识问答', path: '/knowledge' },
  { name: '色研社区', path: '/community' },
];

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

  const goWorkspace = () => navigate('/workspace');
  const goProfile = () => navigate('/profile');
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
          ? 'bg-brand-darker/90 backdrop-blur-xl border-b border-white/5'
          : 'bg-brand-darker/40 backdrop-blur-md'
      }`}
    >
      <div className="container flex items-center justify-between h-16 px-4 lg:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-spectrum-gradient bg-[length:200%_200%] animate-gradient-shift shadow-glow" />
          <span className="font-serif text-xl font-bold tracking-wide bg-gradient-to-r from-brand-cream via-brand-accent to-brand-teal bg-clip-text text-transparent">
            曲泉AI
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === link.path
                  ? 'text-white bg-white/10'
                  : 'text-brand-text/80 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={goWorkspace}
            className="hidden sm:inline-flex btn-primary !py-2 !px-5 text-sm"
          >
            开始使用
          </button>

          {/* 登录 / 用户菜单 */}
          {isAuthenticated && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="用户菜单"
              >
                <div className="w-7 h-7 rounded-lg bg-spectrum-gradient bg-[length:200%_200%] animate-gradient-shift flex items-center justify-center shadow-glow shrink-0">
                  <span className="text-xs font-bold text-white">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                </div>
                <span className="hidden sm:inline text-sm text-brand-text max-w-[80px] truncate">
                  {user.username}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 glass-card p-2 animate-fade-in-up shadow-glow-accent">
                  <div className="px-3 py-2 border-b border-white/5 mb-1">
                    <div className="text-sm font-medium text-brand-text truncate">{user.username}</div>
                    <div className="text-[11px] text-brand-muted">个人中心</div>
                  </div>
                  <button
                    onClick={goProfile}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-text hover:bg-white/5 transition-colors"
                  >
                    <User className="w-4 h-4 text-brand-muted" />
                    个人主页
                  </button>
                  <button
                    onClick={() => { goProfile(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-text hover:bg-white/5 transition-colors"
                  >
                    <Wallet className="w-4 h-4 text-brand-muted" />
                    我的钱包
                  </button>
                  <div className="border-t border-white/5 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-300 hover:bg-rose-500/10 transition-colors"
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
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-brand-text border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
            >
              <User className="w-4 h-4" />
              登录
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-brand-text/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="切换菜单"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/5 bg-brand-darker/95 backdrop-blur-xl">
          <div className="container px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === link.path
                    ? 'text-white bg-white/10'
                    : 'text-brand-text/80 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <button
              onClick={goWorkspace}
              className="sm:hidden btn-primary !py-2 !px-5 text-sm mt-2"
            >
              开始使用
            </button>
            {!isAuthenticated && (
              <button
                onClick={goLogin}
                className="sm:hidden btn-secondary !py-2 !px-5 text-sm mt-2 inline-flex items-center justify-center gap-1.5"
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
