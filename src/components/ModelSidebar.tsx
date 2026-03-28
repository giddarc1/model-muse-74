import { useLocation } from 'react-router-dom';
import { useModelStore } from '@/stores/modelStore';
import { useUserLevelStore, isVisible, type FeatureKey } from '@/hooks/useUserLevel';
import { NavLink } from '@/components/NavLink';
import {
  LayoutDashboard, Settings2, Users, Cpu, Package, GitBranch,
  Network, Play, FlaskConical, FileText, Wrench, Sparkles, Menu, X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const navItems: { label: string; icon: typeof LayoutDashboard; path: string; feature: FeatureKey | null }[] = [
  { label: 'Overview', icon: LayoutDashboard, path: 'overview', feature: null },
  { label: 'General Data', icon: Settings2, path: 'general', feature: null },
  { label: 'Labor', icon: Users, path: 'labor', feature: null },
  { label: 'Equipment', icon: Cpu, path: 'equipment', feature: null },
  { label: 'Products', icon: Package, path: 'products', feature: null },
  { label: 'Operations', icon: GitBranch, path: 'operations', feature: null },
  { label: 'IBOM', icon: Network, path: 'ibom', feature: null },
  { label: 'Trooba Intelligence', icon: Sparkles, path: 'intelligence', feature: 'all_operations' },
  { label: 'Run & Results', icon: Play, path: 'run', feature: null },
  { label: 'What-If Studio', icon: FlaskConical, path: 'whatif', feature: null },
  { label: 'Reports', icon: FileText, path: 'reports', feature: null },
  { label: 'Model Settings', icon: Wrench, path: 'settings', feature: null },
];

export function ModelSidebar() {
  const model = useModelStore((s) => s.getActiveModel());
  const location = useLocation();
  const userLevel = useUserLevelStore((s) => s.userLevel);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (!model) return null;

  const basePath = `/models/${model.id}`;
  const visibleItems = navItems.filter(item => !item.feature || isVisible(item.feature, userLevel));

  const sidebarContent = (
    <>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase" style={{ letterSpacing: '0.2em' }}>
          Model Workspace
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 md:hidden text-muted-foreground" onClick={() => setMobileOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const to = `${basePath}/${item.path}`;
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={item.path}
              to={to}
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] transition-colors ${
                isActive
                  ? 'text-primary font-medium border-l-[3px] border-primary bg-primary/[0.08]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background border-l-[3px] border-transparent'
              }`}
              activeClassName=""
            >
              <item.icon className={`h-4 w-4 shrink-0 ${item.path === 'intelligence' ? 'text-primary' : ''}`} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-border">
        <div className="font-mono text-[10px] text-muted-foreground">
          {model.products.length} products · {model.equipment.length} equip · {model.labor.length} labor
        </div>
      </div>
    </>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-12 left-2 z-40 h-8 w-8 md:hidden bg-background border"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
           <aside
            className="absolute left-0 top-0 bottom-0 w-64 bg-surface border-r border-border flex flex-col z-50 animate-in slide-in-from-left duration-200"
            onClick={e => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      <aside className="w-56 bg-surface border-r border-border flex-col shrink-0 hidden md:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
