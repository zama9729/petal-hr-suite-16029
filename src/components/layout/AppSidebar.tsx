import { 
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Clock,
  Workflow,
  Settings,
  BarChart3,
  Building2,
  Network,
  UserCheck,
  CalendarClock,
  Award,
  Bot,
  CheckSquare,
  Upload,
  History,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Navigation items for different roles
const hrItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, showBadge: false },
  { title: "My Profile", url: "/my/profile", icon: Users, showBadge: false },
  { title: "Employees", url: "/employees", icon: Users, showBadge: false },
  { title: "Onboarding", url: "/onboarding-tracker", icon: UserCheck, showBadge: false },
  { title: "Org Chart", url: "/org-chart", icon: Network, showBadge: false },
  { title: "Timesheets", url: "/timesheets", icon: Clock, showBadge: false },
  { title: "Timesheet Approvals", url: "/timesheet-approvals", icon: CheckSquare, showBadge: true },
  { title: "Leave Requests", url: "/leaves", icon: Calendar, showBadge: true },
  { title: "Shift Management", url: "/shifts", icon: CalendarClock, showBadge: false },
  { title: "Attendance Upload", url: "/attendance/upload", icon: Upload, showBadge: false },
  { title: "Upload History", url: "/attendance/history", icon: History, showBadge: false },
  { title: "Workflows", url: "/workflows", icon: Workflow, showBadge: false },
  { title: "Skills", url: "/profile/skills", icon: Award, showBadge: false },
  { title: "New Project", url: "/projects/new", icon: Building2, showBadge: false },
  { title: "CEO Dashboard", url: "/ceo/dashboard", icon: BarChart3, showBadge: false },
  { title: "Project Calendar", url: "/calendar", icon: CalendarClock, showBadge: false },
  { title: "Holiday Management", url: "/holidays", icon: Calendar, showBadge: false },
  { title: "Policies", url: "/policies", icon: FileText, showBadge: false },
  { title: "Analytics", url: "/analytics", icon: BarChart3, showBadge: false },
  { title: "Employee Stats", url: "/employee-stats", icon: Users, showBadge: false },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot, showBadge: false },
];

const managerItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, showBadge: false },
  { title: "My Profile", url: "/my/profile", icon: Users, showBadge: false },
  { title: "My Team", url: "/employees", icon: Users, showBadge: false },
  { title: "Org Chart", url: "/org-chart", icon: Network, showBadge: false },
  { title: "Timesheets", url: "/timesheets", icon: Clock, showBadge: false },
  { title: "Timesheet Approvals", url: "/timesheet-approvals", icon: CheckSquare, showBadge: true },
  { title: "Leave Requests", url: "/leaves", icon: Calendar, showBadge: true },
  { title: "Project Calendar", url: "/calendar", icon: CalendarClock, showBadge: false },
  { title: "Appraisals", url: "/appraisals", icon: Award, showBadge: false },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot, showBadge: false },
];

const employeeItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, showBadge: false },
  { title: "My Profile", url: "/my/profile", icon: Users, showBadge: false },
  { title: "My Timesheets", url: "/timesheets", icon: Clock, showBadge: false },
  { title: "Leave Requests", url: "/leaves", icon: Calendar, showBadge: false },
  { title: "Project Calendar", url: "/calendar", icon: CalendarClock, showBadge: false },
  { title: "Org Chart", url: "/org-chart", icon: Network, showBadge: false },
  { title: "My Appraisal", url: "/my-appraisal", icon: Award, showBadge: false },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot, showBadge: false },
];

export function AppSidebar() {
  const { user, userRole } = useAuth();
  const [pendingCounts, setPendingCounts] = useState<{ timesheets: number; leaves: number }>({
    timesheets: 0,
    leaves: 0,
  });
  const [organization, setOrganization] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    if (user) {
      fetchOrganization();
      fetchIsSuperadmin();
      
      if (userRole && ['manager', 'hr', 'director', 'ceo', 'admin'].includes(userRole)) {
        fetchPendingCounts();
        
        // Poll for updates every 30 seconds (replaces realtime)
        const interval = setInterval(() => {
          fetchPendingCounts();
        }, 30000);

        return () => {
          clearInterval(interval);
        };
      }
    }
  }, [user, userRole]);

  const fetchOrganization = async () => {
    if (!user) return;

    try {
      const org = await api.getOrganization();
      if (org) {
        setOrganization(org);
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
    }
  };

  const fetchIsSuperadmin = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/access`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setIsSuperadmin(!!data.superadmin);
    } catch (e) {
      // ignore
    }
  };

  const fetchPendingCounts = async () => {
    if (!user) return;

    try {
      const counts = await api.getPendingCounts();
      setPendingCounts({
        timesheets: counts.timesheets || 0,
        leaves: counts.leaves || 0,
      });
    } catch (error) {
      console.error('Error fetching pending counts:', error);
    }
  };
  
  // Determine which navigation items to show based on role
  const getNavigationItems = () => {
    switch (userRole) {
      case 'ceo':
      case 'director':
      case 'hr':
      case 'admin':
        return hrItems;
      case 'manager':
        return managerItems;
      case 'employee':
      default:
        return employeeItems;
    }
  };
  
  const navigationItems = getNavigationItems();
  
  // Debug: Log what menu items are being shown
  if (navigationItems && navigationItems.length > 0) {
    console.log('✅ Navigation items loaded:', navigationItems.map(i => i.title));
    console.log('✅ User role:', userRole);
    const hasApprovals = navigationItems.some(item => item.title === 'Timesheet Approvals');
    console.log('✅ Has Timesheet Approvals:', hasApprovals);
  } else {
    console.warn('⚠️ No navigation items found! User role:', userRole);
  }

  const getBadgeCount = (url: string) => {
    if (url === '/timesheet-approvals') return pendingCounts.timesheets;
    if (url === '/leaves') return pendingCounts.leaves;
    return 0;
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-shrink-0">
            {organization?.logo_url ? (
              <div className="relative h-10 w-10 rounded-lg overflow-hidden border border-sidebar-border shadow-sm bg-background">
                <img 
                  src={organization.logo_url} 
                  alt={organization.name || 'Organization'}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // Fallback to default icon if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.fallback-icon')) {
                      const fallback = document.createElement('div');
                      fallback.className = 'fallback-icon h-full w-full flex items-center justify-center bg-primary/10';
                      fallback.innerHTML = '<svg class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>';
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-sidebar-border flex items-center justify-center shadow-sm">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
          </div>
          <div className="hidden lg:block min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-sidebar-foreground leading-tight truncate">
              {organization?.name || 'HR Platform'}
            </h2>
            <p className="text-[10px] text-sidebar-foreground/60 leading-tight mt-0.5">Powered by AI</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
              <SidebarGroupLabel>
                {userRole === 'hr' || userRole === 'director' || userRole === 'ceo' || userRole === 'admin'
                  ? 'HR Dashboard' 
                  : userRole === 'manager' 
                  ? 'Manager Dashboard' 
                  : 'My Dashboard'}
              </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems && navigationItems.length > 0 ? (
                navigationItems.map((item) => {
                  const badgeCount = item.showBadge ? getBadgeCount(item.url) : 0;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url}
                          className={({ isActive }) => 
                            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                          }
                        >
                          <item.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="flex-1 text-xs hidden lg:block">{item.title}</span>
                          {badgeCount > 0 && (
                            <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-medium text-destructive-foreground shrink-0">
                              {badgeCount > 9 ? '9+' : badgeCount}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              ) : (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Loading menu items...
                  </div>
                </SidebarMenuItem>
              )}
              {isSuperadmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin">
                      <BarChart3 className="h-4 w-4" />
                      <span>Admin</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}