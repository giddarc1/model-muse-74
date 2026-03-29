import { useUserLevelStore, type UserLevel } from '@/hooks/useUserLevel';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const LEVELS: { value: UserLevel; label: string; description: string }[] = [
  { value: 'novice', label: 'Novice', description: 'Simplified view. Core fields only.' },
  { value: 'standard', label: 'Standard', description: 'Balanced view. Most fields visible.' },
  { value: 'advanced', label: 'Advanced', description: 'Full view. All parameters and formula columns.' },
];

export function UserProfileDropdown() {
  const { user, signOut } = useAuth();
  const { userLevel, setUserLevel } = useUserLevelStore();
  const [open, setOpen] = useState(false);

  const email = user?.email || '';
  const initial = email.charAt(0).toUpperCase();

  const handleLevelChange = async (level: UserLevel) => {
    await setUserLevel(level);
    toast.success(`Switched to ${LEVELS.find(l => l.value === level)?.label} mode`);
  };

  const handleSignOut = () => {
    setOpen(false);
    signOut();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
          <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
            {initial}
          </span>
          <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-[160px]">{email}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium truncate">{email}</p>
        </div>

        {/* Mode selector */}
        <div className="p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            User Mode
          </p>
          <div className="space-y-1.5">
            {LEVELS.map((lvl) => (
              <button
                key={lvl.value}
                onClick={() => handleLevelChange(lvl.value)}
                className={`w-full text-left rounded-[5px] border px-3 py-2 transition-colors ${
                  userLevel === lvl.value
                    ? 'border-primary bg-[#F0FAFA] text-[#009A8E]'
                    : 'border-[#E5E7EB] hover:border-[#9CA3AF] hover:bg-[#F9FAFB] text-[#374151]'
                }`}
              >
                <span className="text-sm font-medium">{lvl.label}</span>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{lvl.description}</p>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Sign out */}
        <div className="p-1.5">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
