"use client";

import { useSidebar } from '@/components/ui/sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { BrandLogo } from '@/components/BrandLogo';

export function AdminTopBar() {
  const sidebar = useSidebar();
  const navigate = useNavigate();
  const { logout: clearSession } = useAuth();

  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      clearSession();
      navigate('/', { replace: true });
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <Button
        variant="outline"
        size="icon"
        onClick={sidebar.toggleSidebar}
        className="h-8 w-8"
      >
        <Menu className="h-4 w-4" />
        <span className="sr-only">Toggle Menu</span>
      </Button>
      <div className="flex flex-1 items-center justify-between">
        <BrandLogo imageClassName="h-7 w-auto" showProductName={false} />
        <Button onClick={logout} variant="outline" size="sm">
          Logout
        </Button>
      </div>
    </header>
  );
}
