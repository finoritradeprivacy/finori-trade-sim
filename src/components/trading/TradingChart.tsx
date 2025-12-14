import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Minus, Square, Type, RotateCcw, Trash2, Activity, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
interface TradingChartProps {
  asset: any;
}
type Timeframe = '1s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
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
  points: Array<{
    time: number;
    price: number;
  }>;
  text?: string;
}
export const TradingChart = ({
  asset
}: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | any>(null);
  // Keep references to overlay elements so we can cleanly re-render drawings
  const priceLinesRef = useRef<any[]>([]);
  const trendlineSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const markersRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1s');
  const [timeframeCooldown, setTimeframeCooldown] = useState(0);
  const lastTimeframeChangeRef = useRef<number>(0);
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('none');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [showMA, setShowMA] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastCandle, setLastCandle] = useState<CandlestickData | null>(null);
  const [drawingInProgress, setDrawingInProgress] = useState<{
    type: DrawingTool;
    points: Array<{
      time: number;
      price: number;
    }>;
  } | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [priceCountdown, setPriceCountdown] = useState(1);

  // Price update countdown - 1 second updates
  useEffect(() => {
    const calculateCountdown = () => {
      if (!asset?.updated_at) return 1;
      const lastUpdate = new Date(asset.updated_at).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - lastUpdate) / 1000);
      const remaining = Math.max(0, 1 - elapsed);
      return remaining;
    };
    setPriceCountdown(calculateCountdown());
    const interval = setInterval(() => {
      setPriceCountdown(calculateCountdown());
    }, 100);
    return () => clearInterval(interval);
  }, [asset?.updated_at]);

  // Timeframe cooldown countdown
  useEffect(() => {
    if (timeframeCooldown <= 0) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastTimeframeChangeRef.current) / 1000);
      const remaining = Math.max(0, 20 - elapsed);
      setTimeframeCooldown(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [timeframeCooldown]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: {
          color: '#0B0E11'
        },
        textColor: '#B7BDC6'
      },
      grid: {
        vertLines: {
          color: 'rgba(42, 46, 57, 0.5)',
          style: 1
        },
        horzLines: {
          color: 'rgba(42, 46, 57, 0.5)',
          style: 1
        }
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: 'rgba(224, 227, 235, 0.1)',
          style: 3
        },
        horzLine: {
          width: 1,
          color: 'rgba(224, 227, 235, 0.1)',
          style: 3
        }
      },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
        borderVisible: true,
        autoScale: true,
        scaleMargins: {
          top: 0.15,
          bottom: 0.15
        }
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
        borderVisible: true,
        timeVisible: true,
        secondsVisible: false
      }
    });
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderVisible: false,
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D'
    });
    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    setIsInitialized(true);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Aggregate 1m candles into larger timeframes
  const aggregateCandles = (data: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>, timeframeSeconds: number): CandlestickData[] => {
    if (timeframeSeconds === 60) {
      // No aggregation needed for 1m
      return data.map(d => ({
        time: d.time as UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close
      }));
    }
    const aggregated: Map<number, CandlestickData> = new Map();
    for (const candle of data) {
      const bucketTime = Math.floor(candle.time / timeframeSeconds) * timeframeSeconds;
      const existing = aggregated.get(bucketTime);
      if (existing) {
        existing.high = Math.max(existing.high, candle.high);
        existing.low = Math.min(existing.low, candle.low);
        existing.close = candle.close; // Last candle's close becomes the aggregated close
      } else {
        aggregated.set(bucketTime, {
          time: bucketTime as UTCTimestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close
        });
      }
    }
    return Array.from(aggregated.values()).sort((a, b) => (a.time as number) - (b.time as number));
  };

  // Define candle limits per timeframe: [min, max]
  const getCandleLimits = (tf: Timeframe): [number, number] => {
    switch (tf) {
      case '1s': return [2000, 2000];
      case '1m': return [2000, 2000];
      case '15m': return [1000, 1750];
      case '5m': return [1000, 1750];
      case '1h': return [500, 1500];
      case '4h': return [300, 500];
      case '1d': return [100, 400];
      case '1w': return [15, 60];
      default: return [100, 500];
    }
  };

  // Determine which table to use for each timeframe
  const getTableForTimeframe = (tf: Timeframe): string => {
    switch (tf) {
      case '1s':
      case '1m':
      case '5m':
      case '15m':
        return 'price_history'; // Use 1m candles and aggregate
      case '1h':
      case '4h':
        return 'price_history_hourly'; // Use hourly candles
      case '1d':
      case '1w':
        return 'price_history_daily'; // Use daily candles
      default:
        return 'price_history';
    }
  };

  // Generate historical candlestick data
  const generateHistoricalData = async () => {
    if (!candlestickSeriesRef.current || !asset) return;
    setIsLoadingData(true);
    const timeframeSeconds = getTimeframeSeconds(timeframe);
    const now = Math.floor(Date.now() / 1000);
    const [minCandles, maxCandles] = getCandleLimits(timeframe);
    const tableName = getTableForTimeframe(timeframe);
    
    try {
      let chartData: CandlestickData[] = [];
      
      if (tableName === 'price_history') {
        // For 1m-based timeframes, load raw 1m candles and aggregate
        const candlesNeeded = maxCandles * (timeframeSeconds / 60) * 1.5; // Extra buffer for aggregation
        const startTime = now - candlesNeeded * 60;
        
        const { data: existingData, error } = await supabase
          .from('price_history')
          .select('*')
          .eq('asset_id', asset.id)
          .gte('time', startTime)
          .order('time', { ascending: true })
          .limit(50000);
        
        if (error) throw error;
        
        if (existingData && existingData.length > 0) {
          const rawData = existingData.map(d => ({
            time: Number(d.time),
            open: Number(d.open),
            high: Number(d.high),
            low: Number(d.low),
            close: Number(d.close)
          }));
          
          // Aggregate candles based on selected timeframe
          const aggregated = aggregateCandles(rawData, timeframeSeconds);
          
          // Apply max limit
          chartData = aggregated.slice(-maxCandles);
          console.log(`Loaded ${existingData.length} 1m candles, aggregated to ${chartData.length} ${timeframe} candles`);
        }
      } else if (tableName === 'price_history_hourly') {
        // For hourly-based timeframes (1h, 4h)
        const candlesNeeded = timeframe === '4h' 
          ? maxCandles * 4 // Need 4x hourly candles for 4h aggregation
          : maxCandles;
        
        const { data: hourlyData, error } = await supabase
          .from('price_history_hourly')
          .select('*')
          .eq('asset_id', asset.id)
          .order('time', { ascending: false })
          .limit(candlesNeeded);
        
        if (error) throw error;
        
        if (hourlyData && hourlyData.length > 0) {
          const rawData = hourlyData.reverse().map(d => ({
            time: Number(d.time),
            open: Number(d.open),
            high: Number(d.high),
            low: Number(d.low),
            close: Number(d.close)
          }));
          
          if (timeframe === '4h') {
            // Aggregate hourly to 4h
            const aggregated = aggregateCandles(rawData, 14400);
            chartData = aggregated.slice(-maxCandles);
          } else {
            chartData = rawData.slice(-maxCandles).map(d => ({
              time: d.time as UTCTimestamp,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close
            }));
          }
          console.log(`Loaded ${hourlyData.length} hourly candles, result: ${chartData.length} ${timeframe} candles`);
        }
      } else if (tableName === 'price_history_daily') {
        // For daily-based timeframes (1d, 1w)
        const candlesNeeded = timeframe === '1w'
          ? maxCandles * 7 // Need 7x daily candles for weekly aggregation
          : maxCandles;
        
        const { data: dailyData, error } = await supabase
          .from('price_history_daily')
          .select('*')
          .eq('asset_id', asset.id)
          .order('time', { ascending: false })
          .limit(candlesNeeded);
        
        if (error) throw error;
        
        if (dailyData && dailyData.length > 0) {
          const rawData = dailyData.reverse().map(d => ({
            time: Number(d.time),
            open: Number(d.open),
            high: Number(d.high),
            low: Number(d.low),
            close: Number(d.close)
          }));
          
          if (timeframe === '1w') {
            // Aggregate daily to weekly
            const aggregated = aggregateCandles(rawData, 604800);
            chartData = aggregated.slice(-maxCandles);
          } else {
            chartData = rawData.slice(-maxCandles).map(d => ({
              time: d.time as UTCTimestamp,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close
            }));
          }
          console.log(`Loaded ${dailyData.length} daily candles, result: ${chartData.length} ${timeframe} candles`);
        }
      }
      
      // Ensure minimum candles requirement is met (log warning if not)
      if (chartData.length < minCandles && chartData.length > 0) {
        console.warn(`Only ${chartData.length} candles available for ${timeframe}, minimum is ${minCandles}`);
      }
      
      if (chartData.length > 0) {
        candlestickSeriesRef.current.setData(chartData);
        setLastCandle(chartData[chartData.length - 1] || null);
      } else {
        candlestickSeriesRef.current.setData([]);
        setLastCandle(null);
        console.log('No history yet — will build from now');
      }
    } catch (error) {
      console.error('Error loading price history:', error);
      candlestickSeriesRef.current.setData([]);
      setLastCandle(null);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Get timeframe in seconds
  const getTimeframeSeconds = (tf: Timeframe): number => {
    const map: Record<Timeframe, number> = {
      '1s': 1,
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
      '1w': 604800
    };
    return map[tf];
  };

  // Handle timeframe change with cooldown
  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    if (timeframeCooldown > 0) {
      toast.error(`Please wait ${timeframeCooldown}s before switching timeframes`);
      return;
    }
    setTimeframe(newTimeframe);
    lastTimeframeChangeRef.current = Date.now();
    setTimeframeCooldown(20);
  };

  // Real-time price updates (subscribe to price_history for selected asset)
  useEffect(() => {
    if (!asset || !candlestickSeriesRef.current) return;

    // Always reset last candle to the latest known DB candle to avoid carry-over
    setLastCandle(null);
    const channel = supabase.channel(`price-history-${asset.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'price_history',
      filter: `asset_id=eq.${asset.id}`
    }, payload => {
      const row: any = payload.new;
      if (!row) return;
      // Extra safeguard: ensure event belongs to the current asset
      if (row.asset_id !== asset.id) {
        return;
      }

      // Extract full OHLC data from the database record
      const open = Number(row.open);
      const high = Number(row.high);
      const low = Number(row.low);
      const close = Number(row.close);
      const time = Number(row.time);
      if (!Number.isFinite(close) || close <= 0) return;
      if (!Number.isFinite(time) || time <= 0) return;

      // Ignore obviously wrong ticks (>30% away from current known price)
      const baseline = Number(asset.current_price);
      if (Number.isFinite(baseline) && baseline > 0) {
        const diff = Math.abs(close - baseline) / baseline;
        if (diff > 0.3) {
          console.warn('Ignored outlier tick', {
            close,
            baseline,
            asset: asset.symbol,
            row
          });
          return;
        }
      }
      updateCandleFromDb({
        time,
        open,
        high,
        low,
        close
      });
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [asset, timeframe]);

  // Update candle from database record with full OHLC data
  const updateCandleFromDb = (dbCandle: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }) => {
    if (!candlestickSeriesRef.current || !asset) return;

    // Get current timeframe interval
    const timeframeSeconds = getTimeframeSeconds(timeframe);

    // Calculate the bucket time for this candle based on current timeframe
    const bucketTime = Math.floor(dbCandle.time / timeframeSeconds) * timeframeSeconds as UTCTimestamp;

    // Sanity check
    if (!Number.isFinite(dbCandle.close) || dbCandle.close <= 0) {
      console.warn('Ignoring invalid candle', dbCandle);
      return;
    }

    // If we have a last candle in the same bucket, merge with it
    if (lastCandle && lastCandle.time === bucketTime) {
      const updatedCandle: CandlestickData = {
        time: bucketTime,
        open: lastCandle.open,
        // Keep original open
        high: Math.max(lastCandle.high, dbCandle.high),
        low: Math.min(lastCandle.low, dbCandle.low),
        close: dbCandle.close // Latest close
      };
      candlestickSeriesRef.current.update(updatedCandle);
      setLastCandle(updatedCandle);
    } else {
      // New candle bucket - use full OHLC from the database record
      const newCandle: CandlestickData = {
        time: bucketTime,
        open: dbCandle.open,
        high: dbCandle.high,
        low: dbCandle.low,
        close: dbCandle.close
      };
      candlestickSeriesRef.current.update(newCandle);
      setLastCandle(newCandle);
    }
  };

  // Load trades for current asset
  useEffect(() => {
    if (!asset) return;
    const loadTrades = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const {
        data,
        error
      } = await supabase.from('trades').select('*').eq('user_id', user.id).eq('asset_id', asset.id).order('created_at', {
        ascending: false
      }).limit(50);
      if (error) {
        console.error('Error loading trades:', error);
        return;
      }
      if (data) {
        // Deduplicate trades by id
        const uniqueTrades = new Map<string, Trade>();
        data.forEach(trade => {
          if (!uniqueTrades.has(trade.id)) {
            uniqueTrades.set(trade.id, {
              id: trade.id,
              type: trade.side as 'buy' | 'sell',
              price: trade.price,
              amount: trade.quantity,
              timestamp: new Date(trade.created_at).getTime() / 1000
            });
          }
        });
        setTrades(Array.from(uniqueTrades.values()));
      }
    };
    loadTrades();

    // Subscribe to new trades for this asset
    const channel = supabase.channel(`trades-${asset.id}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'trades',
      filter: `asset_id=eq.${asset.id}`
    }, () => {
      loadTrades();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [asset?.id]);

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
        price: price as number
      };
      if (drawingTool === 'horizontal') {
        // Create horizontal line
        const newDrawing: Drawing = {
          id: `${Date.now()}`,
          type: 'horizontal',
          points: [newPoint]
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
            text
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
            points: [newPoint]
          });
          toast.info(`Click second point for ${drawingTool}`);
        } else {
          // Second point - complete the drawing
          const newDrawing: Drawing = {
            id: `${Date.now()}`,
            type: drawingInProgress.type,
            points: [...drawingInProgress.points, newPoint]
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
    const series = candlestickSeriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    // CLEAN PREVIOUS OVERLAYS
    if (priceLinesRef.current.length) {
      try {
        priceLinesRef.current.forEach(line => {
          try {
            series.removePriceLine(line);
          } catch {}
        });
      } finally {
        priceLinesRef.current = [];
      }
    }
    if (trendlineSeriesRef.current.size) {
      trendlineSeriesRef.current.forEach(s => {
        try {
          chart.removeSeries(s);
        } catch {}
      });
      trendlineSeriesRef.current.clear();
    }

    // Build new overlays from current drawings
    const markers: any[] = [];
    drawings.forEach(drawing => {
      if (drawing.type === 'horizontal') {
        const line = series.createPriceLine({
          price: drawing.points[0].price,
          color: '#FCD535',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Support/Resistance'
        });
        priceLinesRef.current.push(line);
      } else if (drawing.type === 'rectangle' && drawing.points.length === 2) {
        const highPrice = Math.max(drawing.points[0].price, drawing.points[1].price);
        const lowPrice = Math.min(drawing.points[0].price, drawing.points[1].price);
        const top = series.createPriceLine({
          price: highPrice,
          color: '#8B5CF6',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'Zone Top'
        });
        const bottom = series.createPriceLine({
          price: lowPrice,
          color: '#8B5CF6',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'Zone Bottom'
        });
        priceLinesRef.current.push(top, bottom);
      } else if (drawing.type === 'trendline' && drawing.points.length === 2) {
        // Skip if both points have the same timestamp
        if (drawing.points[0].time === drawing.points[1].time) {
          return;
        }

        // Ensure points are sorted by time (ascending)
        const sortedPoints = [...drawing.points].sort((a, b) => a.time - b.time);
        const isRising = sortedPoints[1].price > sortedPoints[0].price;
        const color = isRising ? '#0ECB81' : '#F6465D';
        const tl = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          lineStyle: 1,
          // Dashed line
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false
        });
        tl.setData([{
          time: sortedPoints[0].time as UTCTimestamp,
          value: sortedPoints[0].price
        }, {
          time: sortedPoints[1].time as UTCTimestamp,
          value: sortedPoints[1].price
        }]);
        trendlineSeriesRef.current.set(drawing.id, tl);
        markers.push({
          time: drawing.points[0].time as UTCTimestamp,
          position: 'inBar' as 'inBar',
          color,
          shape: 'circle' as 'circle',
          text: 'Start'
        });
        markers.push({
          time: drawing.points[1].time as UTCTimestamp,
          position: 'inBar' as 'inBar',
          color,
          shape: (isRising ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
          text: isRising ? 'Up Trend' : 'Down Trend'
        });
      } else if (drawing.type === 'text') {
        // Use marker to render text note
        markers.push({
          time: drawing.points[0].time as UTCTimestamp,
          position: 'aboveBar' as 'aboveBar',
          color: '#FCD535',
          shape: 'square' as 'square',
          text: drawing.text || 'Note'
        });
      }
    });

    // Combine with trade markers - deduplicate by trade ID
    const seenTradeIds = new Set<string>();
    const tradeMarkers = trades.filter(trade => {
      if (seenTradeIds.has(trade.id)) return false;
      seenTradeIds.add(trade.id);
      return true;
    }).map(trade => ({
      time: trade.timestamp as UTCTimestamp,
      position: (trade.type === 'buy' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
      color: trade.type === 'buy' ? '#8B5CF6' : '#F6465D',
      shape: (trade.type === 'buy' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
      text: `${trade.type.toUpperCase()} ${trade.amount.toFixed(4)} @ $${trade.price.toFixed(2)}`
    }));
    const allMarkers = [...tradeMarkers, ...markers];

    // Use lightweight-charts v5 API for markers
    if (!markersRef.current) {
      markersRef.current = createSeriesMarkers(series, allMarkers);
    } else {
      markersRef.current.setMarkers(allMarkers);
    }
  }, [drawings, trades]);

  // Note: handleTimeframeChange is defined above with cooldown logic

  // Generate historical data when asset changes, timeframe changes, or chart initializes
  useEffect(() => {
    if (isInitialized && asset) {
      // Ensure lastCandle aligns with freshly loaded data for this asset
      generateHistoricalData();
    }
  }, [timeframe, isInitialized, asset?.id]);

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
  const timeframes: Timeframe[] = ['1s', '1m', '5m', '15m', '1h', '4h', '1d', '1w'];
  return <Card className="p-0 bg-[#0B0E11] border-[#2A2E39]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#2A2E39]">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-[#EAECEF]">{asset?.symbol || 'BTC'}/USDT</h3>
          <span className="text-2xl font-bold text-[#EAECEF]">
            ${asset?.current_price?.toFixed(2)}
          </span>
          <span className={`text-sm font-medium ${asset?.price_change_24h >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
            {asset?.price_change_24h >= 0 ? '+' : ''}{((asset?.price_change_24h || 0) * 100).toFixed(2)}%
          </span>
          
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 border-b border-[#2A2E39]">
        {/* Timeframe selector */}
        <div className="flex gap-1 relative group">
          {timeframes.map(tf => <div key={tf} className="relative">
              <Button variant={timeframe === tf ? 'default' : 'outline'} size="sm" onClick={() => handleTimeframeChange(tf)} disabled={timeframeCooldown > 0 && timeframe !== tf} className={timeframeCooldown > 0 && timeframe !== tf ? 'opacity-50 cursor-not-allowed' : ''}>
                {tf}
              </Button>
            </div>)}
          {timeframeCooldown > 0 && <div className="absolute -top-8 left-0 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              Cooldown: {timeframeCooldown}s
            </div>}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Drawing tools */}
        <Button variant={drawingTool === 'trendline' ? 'default' : 'outline'} size="sm" onClick={() => setDrawingTool(drawingTool === 'trendline' ? 'none' : 'trendline')} title="Trend Line">
          <TrendingUp className="h-4 w-4" />
        </Button>
        <Button variant={drawingTool === 'horizontal' ? 'default' : 'outline'} size="sm" onClick={() => setDrawingTool(drawingTool === 'horizontal' ? 'none' : 'horizontal')} title="Horizontal Line">
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant={drawingTool === 'rectangle' ? 'default' : 'outline'} size="sm" onClick={() => setDrawingTool(drawingTool === 'rectangle' ? 'none' : 'rectangle')} title="Rectangle">
          <Square className="h-4 w-4" />
        </Button>
        <Button variant={drawingTool === 'text' ? 'default' : 'outline'} size="sm" onClick={() => setDrawingTool(drawingTool === 'text' ? 'none' : 'text')} title="Text Note">
          <Type className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Indicators */}
        
        

        <div className="w-px h-6 bg-border" />

        {/* Actions */}
        <Button variant="outline" size="sm" onClick={undoDrawing} title="Undo" disabled={drawings.length === 0}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={clearDrawings} title="Clear All" disabled={drawings.length === 0}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Chart container */}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full" />
        {isLoadingData && <div className="absolute inset-0 bg-[#0B0E11]/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading chart data...</p>
            </div>
          </div>}
      </div>

      {/* Info footer */}
      <div className="px-4 py-3 text-sm text-[#848E9C] border-t border-[#2A2E39]">
        {drawingTool !== 'none' && <div className="flex items-center gap-2 text-[#FCD535]">
            <span className="font-medium">Drawing mode active:</span>
            <span className="capitalize">{drawingTool}</span>
            <span className="text-[#848E9C]">
              {drawingInProgress ? '- Click second point' : '- Click on the chart to draw'}
            </span>
          </div>}
        {drawings.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-medium">Drawings ({drawings.length}):</span>
            {drawings.map(drawing => <Button key={drawing.id} variant="outline" size="sm" onClick={() => removeDrawing(drawing.id)} className="h-6 px-2 text-xs">
                {drawing.type} ×
              </Button>)}
          </div>}
        {trades.length > 0 && <div className="mt-2">
            Showing {trades.length} trades • 
            <span className="text-[#8B5CF6] ml-1">Purple = Buy</span> • 
            <span className="text-[#F6465D] ml-1">Red = Sell</span>
          </div>}
      </div>
    </Card>;
};