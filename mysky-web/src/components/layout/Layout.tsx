import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Home, Users, Calendar, Compass, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    authApi.logout();
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="text-2xl font-bold text-primary">
            My-sky
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary"
            >
              <Home className="h-4 w-4" />
              フィード
            </Link>
            <Link
              to="/circles"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary"
            >
              <Users className="h-4 w-4" />
              サークル
            </Link>
            <Link
              to="/events"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary"
            >
              <Calendar className="h-4 w-4" />
              イベント
            </Link>
            <Link
              to="/explore"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary"
            >
              <Compass className="h-4 w-4" />
              探索
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm">{user?.displayName}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto py-6 px-4">
        <Outlet />
      </main>
    </div>
  );
}
