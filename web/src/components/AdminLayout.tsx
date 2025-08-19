"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { AdminTopBar } from '@/components/AdminTopBar';
import { 
  Home, 
  Users, 
  Search, 
  TreePine, 
  Settings,
  LogOut 
} from 'lucide-react';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/users', label: 'Add Users', icon: Users },
  { href: '/admin/patients', label: 'Patient Lookup', icon: Search },
  { href: '/admin/tree', label: 'Decision Tree', icon: TreePine },
  { href: '/admin/settings', label: 'Admin Settings', icon: Settings },
];

function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <h1 className="text-xl font-semibold">Admin Portal</h1>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <form action="/api/logout" method="POST">
          <Button 
            type="submit"
            variant="ghost" 
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <AdminTopBar />
        <div className="flex-1 p-8 min-h-0">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
