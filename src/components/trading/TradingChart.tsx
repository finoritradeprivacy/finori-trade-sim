import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp, CandlestickSeries } from 'lightweight-charts';
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastCandle, setLastCandle] = useState<CandlestickData | null>(null);
  const [drawingInProgress, setDrawingInProgress] = useState<{ type: DrawingTool; points: Array<{ time: number; price: number }> } | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#0B0E11' },
        textColor: '#B7BDC6',
      },
      grid: {
        vertLines: { 
          color: 'rgba(42, 46, 57, 0.5)',
          style: 1,
        },
        horzLines: { 
          color: 'rgba(42, 46, 57, 0.5)',
          style: 1,
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: 'rgba(224, 227, 235, 0.1)',
          style: 3,
        },
        horzLine: {
          width: 1,
          color: 'rgba(224, 227, 235, 0.1)',
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
        borderVisible: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
        borderVisible: true,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderVisible: false,
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    setIsInitialized(true);

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

    // Generate exactly 100 candles with unique timestamps
    for (let i = 100; i > 0; i--) {
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

    // Clear existing data and set new data
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

    // Get current timeframe interval
    const timeframeSeconds = getTimeframeSeconds(timeframe);
    const now = Math.floor(Date.now() / 1000);
    
    // Calculate the start time of the current candle
    const currentCandleTime = Math.floor(now / timeframeSeconds) * timeframeSeconds as UTCTimestamp;
    
    // If we have a last candle and it's the same time, update it
    if (lastCandle && lastCandle.time === currentCandleTime) {
      const updatedCandle: CandlestickData = {
        time: currentCandleTime,
        open: lastCandle.open,
        high: Math.max(lastCandle.high, newPrice),
        low: Math.min(lastCandle.low, newPrice),
        close: newPrice,
      };
      candlestickSeriesRef.current.update(updatedCandle);
      setLastCandle(updatedCandle);
    } else {
      // New candle period
      const newCandle: CandlestickData = {
        time: currentCandleTime,
        open: newPrice,
        high: newPrice,
        low: newPrice,
        close: newPrice,
      };
      candlestickSeriesRef.current.update(newCandle);
      setLastCandle(newCandle);
    }
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

  // Note: Trade markers are now rendered together with drawings in the render drawings effect

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

  // Handle chart click for drawing tools
  useEffect(() => {
    if (!chartRef.current || drawingTool === 'none') return;

    const handleClick = (param: any) => {
      if (!param.point || !param.time) return;

      const price = candlestickSeriesRef.current?.coordinateToPrice(param.point.y);
      if (!price) return;

      const newPoint = {
        time: param.time as number,
        price: price as number,
      };

      if (drawingTool === 'horizontal') {
        // Create horizontal line
        const newDrawing: Drawing = {
          id: `${Date.now()}`,
          type: 'horizontal',
          points: [newPoint],
        };
        setDrawings(prev => [...prev, newDrawing]);
        toast.success('Horizontal line added');
        setDrawingTool('none');
      } else if (drawingTool === 'text') {
        // Create text note
        const text = prompt('Enter note text:');
        if (text) {
          const newDrawing: Drawing = {
            id: `${Date.now()}`,
            type: 'text',
            points: [newPoint],
            text,
          };
          setDrawings(prev => [...prev, newDrawing]);
          toast.success('Note added');
        }
        setDrawingTool('none');
      } else if (drawingTool === 'trendline' || drawingTool === 'rectangle') {
        // Handle two-point drawings
        if (!drawingInProgress) {
          // First point
          setDrawingInProgress({
            type: drawingTool,
            points: [newPoint],
          });
          toast.info(`Click second point for ${drawingTool}`);
        } else {
          // Second point - complete the drawing
          const newDrawing: Drawing = {
            id: `${Date.now()}`,
            type: drawingInProgress.type,
            points: [...drawingInProgress.points, newPoint],
          };
          setDrawings(prev => [...prev, newDrawing]);
          toast.success(`${drawingTool} added`);
          setDrawingInProgress(null);
          setDrawingTool('none');
        }
      }
    };

    chartRef.current.subscribeClick(handleClick);

    return () => {
      if (chartRef.current) {
        chartRef.current.unsubscribeClick(handleClick);
      }
    };
  }, [drawingTool, drawingInProgress]);

  // Render drawings on chart
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

    // Note: lightweight-charts doesn't natively support diagonal lines
    // So we'll use markers for trendlines and price lines for rectangles/horizontals
    
    const markers: any[] = [];

    drawings.forEach(drawing => {
      if (drawing.type === 'horizontal') {
        candlestickSeriesRef.current?.createPriceLine({
          price: drawing.points[0].price,
          color: '#FCD535',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Support/Resistance',
        });
      } else if (drawing.type === 'trendline' && drawing.points.length === 2) {
        // Determine color based on trend direction
        const isRising = drawing.points[1].price > drawing.points[0].price;
        const color = isRising ? '#0ECB81' : '#F6465D';
        const shape = isRising ? 'arrowUp' : 'arrowDown';
        
        // Add markers for start and end points
        markers.push({
          time: drawing.points[0].time as UTCTimestamp,
          position: 'inBar' as 'inBar',
          color: color,
          shape: 'circle' as 'circle',
          text: 'Start',
        });
        markers.push({
          time: drawing.points[1].time as UTCTimestamp,
          position: 'inBar' as 'inBar',
          color: color,
          shape: shape,
          text: `${isRising ? 'Up' : 'Down'} Trend`,
        });
      } else if (drawing.type === 'rectangle' && drawing.points.length === 2) {
        // Create two horizontal lines for rectangle
        const highPrice = Math.max(drawing.points[0].price, drawing.points[1].price);
        const lowPrice = Math.min(drawing.points[0].price, drawing.points[1].price);
        
        candlestickSeriesRef.current?.createPriceLine({
          price: highPrice,
          color: '#8B5CF6',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'Zone Top',
        });
        candlestickSeriesRef.current?.createPriceLine({
          price: lowPrice,
          color: '#8B5CF6',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'Zone Bottom',
        });
      }
    });

    // Combine with existing trade markers
    if (markers.length > 0 || trades.length > 0) {
      const tradeMarkers = trades.map(trade => ({
        time: trade.timestamp as UTCTimestamp,
        position: (trade.type === 'buy' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
        color: trade.type === 'buy' ? '#8b5cf6' : '#F6465D',
        shape: (trade.type === 'buy' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
        text: `${trade.type.toUpperCase()} ${trade.amount.toFixed(4)} @ $${trade.price.toFixed(2)}`,
      }));
      
      candlestickSeriesRef.current.setMarkers([...tradeMarkers, ...markers]);
    }
  }, [drawings, trades]);

  // Handle timeframe change
  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    // Generate will be called by useEffect watching timeframe
    toast.success(`Timeframe changed to ${tf}`);
  };

  // Generate historical data only once on init and when timeframe changes
  useEffect(() => {
    if (isInitialized) {
      generateHistoricalData();
    }
  }, [timeframe, isInitialized]);

  // Remove specific drawing
  const removeDrawing = (id: string) => {
    setDrawings(prev => prev.filter(d => d.id !== id));
    toast.success('Drawing removed');
  };

  // Clear all drawings
  const clearDrawings = () => {
    setDrawings([]);
    setDrawingInProgress(null);
    toast.success('All drawings cleared');
  };

  // Undo last drawing
  const undoDrawing = () => {
    if (drawingInProgress) {
      setDrawingInProgress(null);
      toast.info('Drawing cancelled');
    } else if (drawings.length > 0) {
      setDrawings(prev => prev.slice(0, -1));
      toast.success('Last drawing removed');
    }
  };

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

  return (
    <Card className="p-0 bg-[#0B0E11] border-[#2A2E39]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#2A2E39]">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-[#EAECEF]">{asset?.symbol || 'BTC'}/USDT</h3>
          <span className="text-2xl font-bold text-[#EAECEF]">
            ${asset?.current_price?.toFixed(2)}
          </span>
          <span className={`text-sm font-medium ${asset?.price_change_24h >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
            {asset?.price_change_24h >= 0 ? '+' : ''}{asset?.price_change_24h?.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 border-b border-[#2A2E39]">
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
      <div className="px-4 py-3 text-sm text-[#848E9C] border-t border-[#2A2E39]">
        {drawingTool !== 'none' && (
          <div className="flex items-center gap-2 text-[#FCD535]">
            <span className="font-medium">Drawing mode active:</span>
            <span className="capitalize">{drawingTool}</span>
            <span className="text-[#848E9C]">
              {drawingInProgress ? '- Click second point' : '- Click on the chart to draw'}
            </span>
          </div>
        )}
        {drawings.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-medium">Drawings ({drawings.length}):</span>
            {drawings.map(drawing => (
              <Button
                key={drawing.id}
                variant="outline"
                size="sm"
                onClick={() => removeDrawing(drawing.id)}
                className="h-6 px-2 text-xs"
              >
                {drawing.type} ×
              </Button>
            ))}
          </div>
        )}
        {trades.length > 0 && (
          <div className="mt-2">
            Showing {trades.length} trades • 
            <span className="text-[#8B5CF6] ml-1">Purple = Buy</span> • 
            <span className="text-[#F6465D] ml-1">Red = Sell</span>
          </div>
        )}
      </div>
    </Card>
  );
};
