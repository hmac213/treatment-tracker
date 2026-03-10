"use client";

import { useLocation } from 'react-router-dom';
import { TopBar } from '@/components/TopBar';

export function ConditionalTopBar() {
  const { pathname } = useLocation();
  const isAdminPage = pathname.startsWith('/admin');

  if (isAdminPage) {
    return null;
  }

  return <TopBar />;
}
