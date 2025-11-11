import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewsEvent {
  id: string;
  headline: string;
  content: string;
  event_type: string;
  impact_type: 'bullish' | 'bearish' | 'neutral';
  impact_strength: number;
  created_at: string;
  scheduled_for: string | null;
}

const NewsFeed = () => {
  const [news, setNews] = useState<NewsEvent[]>([]);

  useEffect(() => {
    const fetchNews = async () => {
      const { data } = await supabase
        .from("news_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (data) setNews(data as NewsEvent[]);
    };

    fetchNews();

    // Update countdown every second
    const interval = setInterval(() => {
      setNews(prev => [...prev]); // Force re-render to update countdown
    }, 1000);

    const channel = supabase
      .channel('news-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'news_events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Play notification sound for new news
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => {}); // Ignore errors if sound fails
            
            setNews(prev => [payload.new as NewsEvent, ...prev].slice(0, 10));
          } else if (payload.eventType === 'UPDATE') {
            setNews(prev => 
              prev.map(item => item.id === payload.new.id ? payload.new as NewsEvent : item)
            );
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const getImpactColor = (impactType: string) => {
    switch (impactType) {
      case 'bullish': return 'text-success';
      case 'bearish': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getImpactIcon = (impactType: string) => {
    switch (impactType) {
      case 'bullish': return <TrendingUp className="w-3 h-3" />;
      case 'bearish': return <TrendingDown className="w-3 h-3" />;
      default: return <Newspaper className="w-3 h-3" />;
    }
  };

  const getCountdown = (scheduledFor: string | null) => {
    if (!scheduledFor) return null;
    
    const now = Date.now();
    const scheduled = new Date(scheduledFor).getTime();
    const diff = scheduled - now;
    
    if (diff <= 0) return "Triggering...";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Market News</h2>
      </div>
      
      <ScrollArea className="h-[350px]">
        <div className="space-y-3 pr-4">
          {news.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No news events yet. Market events will appear here.
            </p>
          ) : (
            news.map((item) => {
              const countdown = getCountdown(item.scheduled_for);
              const isPending = countdown !== null;
              
              return (
                <div
                  key={item.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all",
                    isPending 
                      ? "bg-primary/5 border-primary/20 animate-pulse" 
                      : "bg-secondary/50 border-border hover:bg-secondary"
                  )}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className={cn("mt-0.5", getImpactColor(item.impact_type))}>
                      {getImpactIcon(item.impact_type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      {isPending && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-primary">
                            📢 New event in {countdown}
                          </span>
                        </div>
                      )}
                      <h3 className="text-sm font-semibold line-clamp-2">{item.headline}</h3>
                      {!isPending && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {item.content}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {item.event_type}
                    </Badge>
                    {!isPending && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default NewsFeed;
