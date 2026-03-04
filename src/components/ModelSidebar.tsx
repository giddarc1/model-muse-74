import { useLocation } from 'react-router-dom';
import { useModelStore } from '@/stores/modelStore';
import { useUserLevelStore, canAccess } from '@/hooks/useUserLevel';
import { NavLink } from '@/components/NavLink';
import {
  LayoutDashboard, Settings2, Users, Cpu, Package, GitBranch,
  Network, Play, FlaskConical, FileText, Wrench, Grid3X3
} from 'lucide-react';

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, path: 'overview', feature: null },
  { label: 'General Data', icon: Settings2, path: 'general', feature: null },
  { label: 'Labor', icon: Users, path: 'labor', feature: null },
  { label: 'Equipment', icon: Cpu, path: 'equipment', feature: null },
  { label: 'Products', icon: Package, path: 'products', feature: null },
  { label: 'Operations', icon: GitBranch, path: 'operations', feature: null },
  { label: 'All Operations', icon: Grid3X3, path: 'all-operations', feature: 'all-operations' },
  { label: 'IBOM', icon: Network, path: 'ibom', feature: null },
  { label: 'Run & Results', icon: Play, path: 'run', feature: null },
  { label: 'What-If Studio', icon: FlaskConical, path: 'whatif', feature: null },
  { label: 'Reports', icon: FileText, path: 'reports', feature: null },
  { label: 'Model Settings', icon: Wrench, path: 'settings', feature: null },
];

export function ModelSidebar() {
  const model = useModelStore((s) => s.getActiveModel());
  const location = useLocation();
  const userLevel = useUserLevelStore((s) => s.userLevel);

  if (!model) return null;

  const basePath = `/models/${model.id}`;
  const visibleItems = navItems.filter(item => !item.feature || canAccess(userLevel, item.feature));

  return (
    <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="text-xs font-mono text-sidebar-foreground/50 uppercase tracking-wider">Model Workspace</div>
      </div>
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const to = `${basePath}/${item.path}`;
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={item.path}
              to={to}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
              activeClassName=""
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/40">
          {model.products.length} products · {model.equipment.length} equip · {model.labor.length} labor
        </div>
      </div>
    </aside>
  );
}
