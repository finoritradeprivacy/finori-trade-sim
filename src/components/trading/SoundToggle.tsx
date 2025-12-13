import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SoundToggleProps {
  soundEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const SoundToggle = ({ soundEnabled, onToggle }: SoundToggleProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(!soundEnabled)}
            className="h-8 w-8 p-0"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-profit" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{soundEnabled ? 'Sound alerts enabled' : 'Sound alerts disabled'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
