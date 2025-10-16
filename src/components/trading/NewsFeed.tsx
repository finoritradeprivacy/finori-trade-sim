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

    const channel = supabase
      .channel('news-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'news_events' },
        (payload) => {
          setNews(prev => [payload.new as NewsEvent, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
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
            news.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-secondary/50 border border-border hover:bg-secondary transition-colors"
              >
                <div className="flex items-start gap-2 mb-1">
                  <span className={cn("mt-0.5", getImpactColor(item.impact_type))}>
                    {getImpactIcon(item.impact_type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold line-clamp-2">{item.headline}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.content}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {item.event_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default NewsFeed;
