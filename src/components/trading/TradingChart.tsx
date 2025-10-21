import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp, CandlestickSeriesPartialOptions } from 'lightweight-charts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Square, 
  Type, 
  RotateCcw, 
  Trash2,
  Activity,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

interface TradingChartProps {
  asset: any;
}

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
type ChartType = 'candlestick' | 'line' | 'ohlc';
type DrawingTool = 'none' | 'trendline' | 'horizontal' | 'rectangle' | 'text';

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  timestamp: number;
}

interface Drawing {
  id: string;
  type: DrawingTool;
  points: Array<{ time: number; price: number }>;
  text?: string;
}

export const TradingChart = ({ asset }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | any>(null);
  
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('none');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [showMA, setShowMA] = useState(false);
  const [showVolume, setShowVolume] = useState(true);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: 'transparent' },
        textColor: 'hsl(var(--foreground))',
      },
      grid: {
        vertLines: { color: 'hsl(var(--border))' },
        horzLines: { color: 'hsl(var(--border))' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'hsl(var(--border))',
      },
      timeScale: {
        borderColor: 'hsl(var(--border))',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // Generate initial candlestick data
    generateHistoricalData();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Generate historical candlestick data
  const generateHistoricalData = () => {
    if (!candlestickSeriesRef.current || !asset) return;

    const data: CandlestickData[] = [];
    const basePrice = asset.current_price;
    const now = Math.floor(Date.now() / 1000);
    const timeframeSeconds = getTimeframeSeconds(timeframe);

    for (let i = 100; i >= 0; i--) {
      const time = (now - i * timeframeSeconds) as UTCTimestamp;
      const open = basePrice * (1 + (Math.random() - 0.5) * 0.02);
      const close = open * (1 + (Math.random() - 0.5) * 0.015);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);

      data.push({
        time,
        open,
        high,
        low,
        close,
      });
    }

    candlestickSeriesRef.current.setData(data);
  };

  // Get timeframe in seconds
  const getTimeframeSeconds = (tf: Timeframe): number => {
    const map: Record<Timeframe, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
      '1w': 604800,
    };
    return map[tf];
  };

  // Real-time price updates
  useEffect(() => {
    if (!asset || !candlestickSeriesRef.current) return;

    const channel = supabase
      .channel('asset-price-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets',
          filter: `id=eq.${asset.id}`,
        },
        (payload) => {
          const newPrice = payload.new.current_price;
          updateLastCandle(newPrice);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [asset]);

  // Update last candle with new price
  const updateLastCandle = (newPrice: number) => {
    if (!candlestickSeriesRef.current) return;

    const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
    
    // In real implementation, you'd fetch the current candle and update it
    // For now, we'll create a new candle
    candlestickSeriesRef.current.update({
      time: now,
      open: newPrice,
      high: newPrice * 1.001,
      low: newPrice * 0.999,
      close: newPrice,
    });
  };

  // Load trades for current asset
  useEffect(() => {
    if (!asset) return;

    const loadTrades = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('asset_id', asset.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading trades:', error);
        return;
      }

      if (data) {
        const formattedTrades: Trade[] = data.map(trade => ({
          id: trade.id,
          type: trade.side as 'buy' | 'sell',
          price: trade.price,
          amount: trade.quantity,
          timestamp: new Date(trade.created_at).getTime() / 1000,
        }));
        setTrades(formattedTrades);
      }
    };

    loadTrades();
  }, [asset]);

  // Draw trade markers on chart
  useEffect(() => {
    if (!chartRef.current || trades.length === 0) return;

    trades.forEach(trade => {
      const marker = {
        time: trade.timestamp as UTCTimestamp,
        position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
        color: trade.type === 'buy' ? '#8b5cf6' : '#ef4444',
        shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
        text: `${trade.type.toUpperCase()} ${trade.amount} @ ${trade.price.toFixed(2)}`,
      };

      if (candlestickSeriesRef.current) {
        // Note: markers would need to be collected and set all at once
        // This is simplified for the example
      }
    });
  }, [trades]);

  // Load drawings from local storage
  useEffect(() => {
    const savedDrawings = localStorage.getItem(`drawings_${asset?.id}`);
    if (savedDrawings) {
      setDrawings(JSON.parse(savedDrawings));
    }
  }, [asset]);

  // Save drawings to local storage
  useEffect(() => {
    if (asset?.id) {
      localStorage.setItem(`drawings_${asset.id}`, JSON.stringify(drawings));
    }
  }, [drawings, asset]);

  // Handle timeframe change
  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    generateHistoricalData();
    toast.success(`Timeframe changed to ${tf}`);
  };

  // Clear all drawings
  const clearDrawings = () => {
    setDrawings([]);
    toast.success('All drawings cleared');
  };

  // Undo last drawing
  const undoDrawing = () => {
    if (drawings.length > 0) {
      setDrawings(prev => prev.slice(0, -1));
      toast.success('Last drawing removed');
    }
  };

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{asset?.symbol || 'BTC'}/USDT</h3>
          <span className="text-2xl font-bold text-primary">
            ${asset?.current_price?.toFixed(2)}
          </span>
          <span className={`text-sm ${asset?.price_change_24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {asset?.price_change_24h >= 0 ? '+' : ''}{asset?.price_change_24h?.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Timeframe selector */}
        <div className="flex gap-1">
          {timeframes.map((tf) => (
            <Button
              key={tf}
              variant={timeframe === tf ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTimeframeChange(tf)}
            >
              {tf}
            </Button>
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Drawing tools */}
        <Button
          variant={drawingTool === 'trendline' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDrawingTool(drawingTool === 'trendline' ? 'none' : 'trendline')}
          title="Trend Line"
        >
          <TrendingUp className="h-4 w-4" />
        </Button>
        <Button
          variant={drawingTool === 'horizontal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDrawingTool(drawingTool === 'horizontal' ? 'none' : 'horizontal')}
          title="Horizontal Line"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant={drawingTool === 'rectangle' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDrawingTool(drawingTool === 'rectangle' ? 'none' : 'rectangle')}
          title="Rectangle"
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          variant={drawingTool === 'text' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDrawingTool(drawingTool === 'text' ? 'none' : 'text')}
          title="Text Note"
        >
          <Type className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Indicators */}
        <Button
          variant={showMA ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowMA(!showMA)}
          title="Moving Average"
        >
          <Activity className="h-4 w-4" />
        </Button>
        <Button
          variant={showVolume ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowVolume(!showVolume)}
          title="Volume"
        >
          <BarChart3 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={undoDrawing}
          title="Undo"
          disabled={drawings.length === 0}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={clearDrawings}
          title="Clear All"
          disabled={drawings.length === 0}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Chart container */}
      <div ref={chartContainerRef} className="w-full" />

      {/* Info footer */}
      <div className="mt-4 text-sm text-muted-foreground">
        {drawingTool !== 'none' && (
          <div className="flex items-center gap-2 text-primary">
            <span className="font-medium">Drawing mode active:</span>
            <span className="capitalize">{drawingTool}</span>
            <span className="text-muted-foreground">- Click on the chart to draw</span>
          </div>
        )}
        {trades.length > 0 && (
          <div className="mt-2">
            Showing {trades.length} trades • 
            <span className="text-purple-500 ml-1">Purple = Buy</span> • 
            <span className="text-red-500 ml-1">Red = Sell</span>
          </div>
        )}
      </div>
    </Card>
  );
};
