"use client";

import { usePathname } from 'next/navigation';
import { TopBar } from '@/components/TopBar';

export function ConditionalTopBar() {
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');

  // Only show TopBar on non-admin pages (admin pages have their own TopBar in AdminLayout)
  if (isAdminPage) {
    return null;
  }

  return <TopBar />;
}
