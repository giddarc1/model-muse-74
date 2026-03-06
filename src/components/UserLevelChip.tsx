import { useUserLevelStore, type UserLevel } from '@/hooks/useUserLevel';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';
import { toast } from 'sonner';

const LEVEL_CONFIG: Record<UserLevel, { label: string; className: string; description: string }> = {
  novice: {
    label: 'Novice',
    className: 'bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer',
    description: 'Simplified interface — core features only',
  },
  standard: {
    label: 'Standard',
    className: 'bg-primary/15 text-primary hover:bg-primary/25 cursor-pointer',
    description: 'Most features including advanced parameters',
  },
  advanced: {
    label: 'Advanced',
    className: 'bg-accent text-accent-foreground hover:bg-accent/80 cursor-pointer',
    description: 'All features including optimization tools',
  },
};

export function UserLevelChip() {
  const { userLevel, setUserLevel } = useUserLevelStore();
  const [open, setOpen] = useState(false);
  const config = LEVEL_CONFIG[userLevel];

  const handleChange = async (level: UserLevel) => {
    await setUserLevel(level);
    setOpen(false);
    toast.success(`Switched to ${LEVEL_CONFIG[level].label} mode`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge className={`text-[10px] px-2 py-0.5 border-0 shrink-0 transition-colors ${config.className}`}>
          {config.label}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1.5" align="end" sideOffset={6}>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
          User Level
        </p>
        {(Object.entries(LEVEL_CONFIG) as [UserLevel, typeof config][]).map(([level, cfg]) => (
          <button
            key={level}
            onClick={() => handleChange(level)}
            className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
              level === userLevel
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-accent/50 text-foreground'
            }`}
          >
            <span className="font-medium">{cfg.label}</span>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{cfg.description}</p>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
