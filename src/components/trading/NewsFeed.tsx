import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewsEvent {
  id: string;
  headline: string;
  content: string;
  event_type: string;
  impact_type: string;
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
        .limit(20);

      if (data) {
        setNews(data);
      }
    };

    fetchNews();

    const channel = supabase
      .channel("news-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "news_events",
        },
        (payload) => {
          setNews((prev) => [payload.new as NewsEvent, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getImpactIcon = (impactType: string) => {
    switch (impactType) {
      case "bullish":
        return <TrendingUp className="w-4 h-4 text-success" />;
      case "bearish":
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEventTypeBadge = (eventType: string) => {
    const variants: Record<string, string> = {
      earnings: "bg-purple-500/20 text-purple-300",
      macro: "bg-blue-500/20 text-blue-300",
      geopolitical: "bg-red-500/20 text-red-300",
      sentiment: "bg-yellow-500/20 text-yellow-300",
    };

    return (
      <Badge variant="outline" className={cn("text-xs", variants[eventType])}>
        {eventType}
      </Badge>
    );
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Market News</h2>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {news.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No news events yet. The market is calm.
            </p>
          ) : (
            news.map((event) => (
              <div
                key={event.id}
                className="p-3 rounded-lg bg-secondary/50 border border-border hover:bg-secondary transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {getImpactIcon(event.impact_type)}
                    {getEventTypeBadge(event.event_type)}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <h3 className="font-semibold text-sm mb-1">{event.headline}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {event.content}
                </p>

                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          event.impact_type === "bullish"
                            ? "bg-success"
                            : event.impact_type === "bearish"
                            ? "bg-destructive"
                            : "bg-muted-foreground"
                        )}
                        style={{ width: `${event.impact_strength * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Impact: {Math.round(event.impact_strength * 100)}%
                    </span>
                  </div>
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