import { useLocation } from 'react-router-dom';
import { useModelStore } from '@/stores/modelStore';
import { NavLink } from '@/components/NavLink';
import {
  LayoutDashboard, Settings2, Users, Cpu, Package, GitBranch,
  Network, Play, FlaskConical, FileText, Wrench
} from 'lucide-react';

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, path: 'overview' },
  { label: 'General Data', icon: Settings2, path: 'general' },
  { label: 'Labor', icon: Users, path: 'labor' },
  { label: 'Equipment', icon: Cpu, path: 'equipment' },
  { label: 'Products', icon: Package, path: 'products' },
  { label: 'Operations', icon: GitBranch, path: 'operations' },
  { label: 'IBOM', icon: Network, path: 'ibom' },
  { label: 'Run & Results', icon: Play, path: 'run' },
  { label: 'What-If Studio', icon: FlaskConical, path: 'whatif' },
  { label: 'Reports', icon: FileText, path: 'reports' },
  { label: 'Model Settings', icon: Wrench, path: 'settings' },
];

export function ModelSidebar() {
  const model = useModelStore((s) => s.getActiveModel());
  const location = useLocation();

  if (!model) return null;

  const basePath = `/models/${model.id}`;

  return (
    <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="text-xs font-mono text-sidebar-foreground/50 uppercase tracking-wider">Model Workspace</div>
      </div>
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
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
