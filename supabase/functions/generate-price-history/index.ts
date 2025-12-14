import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting 4-month price history generation with aggregation...');

    // Fetch all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id, symbol, current_price, asset_type')
      .eq('is_active', true);

    if (assetsError) {
      throw new Error(`Failed to fetch assets: ${assetsError.message}`);
    }

    console.log(`Found ${assets.length} active assets`);

    const now = Math.floor(Date.now() / 1000);
    const DAYS_TO_GENERATE = 120; // 4 months
    const MINUTES_PER_DAY = 1440;
    const TOTAL_CANDLES = DAYS_TO_GENERATE * MINUTES_PER_DAY; // 172,800 candles per asset
    
    // We'll only keep 2 days of 1m candles (2880), but generate hourly and daily for full period
    const MINUTES_TO_KEEP = 2880; // 2 days of 1m data
    const BATCH_SIZE = 1000;

    for (const asset of assets) {
      console.log(`Generating history for ${asset.symbol}...`);

      // Determine volatility based on asset type
      let volatility = 0.0005; // Base volatility (0.05%)
      if (asset.asset_type === 'crypto') {
        volatility = 0.002; // 0.2% for crypto
      } else if (asset.asset_type === 'stocks') {
        volatility = 0.001; // 0.1% for stocks
      } else if (asset.asset_type === 'forex') {
        volatility = 0.0003; // 0.03% for forex
      }

      // Generate price walk for entire 4-month period
      let currentPrice = Number(asset.current_price);
      const startTime = now - (TOTAL_CANDLES * 60);
      
      // Generate price history array (backward from current)
      const priceHistory: number[] = new Array(TOTAL_CANDLES + 1);
      priceHistory[TOTAL_CANDLES] = currentPrice;

      for (let i = TOTAL_CANDLES - 1; i >= 0; i--) {
        const priceChange = priceHistory[i + 1] * volatility * (Math.random() * 2 - 1);
        priceHistory[i] = Math.max(priceHistory[i + 1] - priceChange, 0.0001);
      }

      // Generate 1m candles (only last 2 days)
      const minuteCandles: any[] = [];
      const startMinuteIdx = TOTAL_CANDLES - MINUTES_TO_KEEP;
      
      for (let i = startMinuteIdx; i < TOTAL_CANDLES; i++) {
        const candleTime = startTime + (i * 60);
        const open = priceHistory[i];
        const close = priceHistory[i + 1];
        const range = Math.abs(close - open) + (open * volatility * Math.random());
        const high = Math.max(open, close) + (range * Math.random() * 0.5);
        const low = Math.min(open, close) - (range * Math.random() * 0.5);

        minuteCandles.push({
          asset_id: asset.id,
          time: candleTime,
          open: Number(open.toFixed(8)),
          high: Number(high.toFixed(8)),
          low: Number(Math.max(low, 0.0001).toFixed(8)),
          close: Number(close.toFixed(8))
        });
      }

      // Generate hourly candles (aggregated from full 4-month period)
      const hourlyCandles: any[] = [];
      const CANDLES_PER_HOUR = 60;
      const totalHours = Math.floor(TOTAL_CANDLES / CANDLES_PER_HOUR);
      
      for (let h = 0; h < totalHours; h++) {
        const hourStartIdx = h * CANDLES_PER_HOUR;
        const hourEndIdx = Math.min((h + 1) * CANDLES_PER_HOUR, TOTAL_CANDLES);
        const hourTime = startTime + (hourStartIdx * 60);
        
        let hourOpen = priceHistory[hourStartIdx];
        let hourHigh = -Infinity;
        let hourLow = Infinity;
        let hourClose = priceHistory[hourEndIdx] || priceHistory[hourEndIdx - 1];
        
        for (let i = hourStartIdx; i < hourEndIdx; i++) {
          const price = priceHistory[i];
          hourHigh = Math.max(hourHigh, price);
          hourLow = Math.min(hourLow, price);
        }
        
        // Add some intra-hour volatility
        const range = Math.abs(hourClose - hourOpen) + (hourOpen * volatility * 60 * Math.random());
        hourHigh = Math.max(hourHigh, Math.max(hourOpen, hourClose) + (range * Math.random() * 0.3));
        hourLow = Math.min(hourLow, Math.min(hourOpen, hourClose) - (range * Math.random() * 0.3));

        hourlyCandles.push({
          asset_id: asset.id,
          time: hourTime,
          open: Number(hourOpen.toFixed(8)),
          high: Number(hourHigh.toFixed(8)),
          low: Number(Math.max(hourLow, 0.0001).toFixed(8)),
          close: Number(hourClose.toFixed(8))
        });
      }

      // Generate daily candles (aggregated from hourly)
      const dailyCandles: any[] = [];
      const HOURS_PER_DAY = 24;
      const totalDays = Math.floor(totalHours / HOURS_PER_DAY);
      
      for (let d = 0; d < totalDays; d++) {
        const dayStartHour = d * HOURS_PER_DAY;
        const dayEndHour = Math.min((d + 1) * HOURS_PER_DAY, totalHours);
        const dayTime = startTime + (dayStartHour * 60 * 60);
        
        if (dayStartHour >= hourlyCandles.length) break;
        
        const dayOpen = hourlyCandles[dayStartHour]?.open || priceHistory[dayStartHour * 60];
        let dayHigh = -Infinity;
        let dayLow = Infinity;
        let dayClose = hourlyCandles[dayEndHour - 1]?.close || priceHistory[Math.min(dayEndHour * 60, TOTAL_CANDLES)];
        
        for (let h = dayStartHour; h < dayEndHour && h < hourlyCandles.length; h++) {
          dayHigh = Math.max(dayHigh, Number(hourlyCandles[h].high));
          dayLow = Math.min(dayLow, Number(hourlyCandles[h].low));
        }
        
        if (!isFinite(dayHigh)) dayHigh = Math.max(dayOpen, dayClose) * 1.01;
        if (!isFinite(dayLow)) dayLow = Math.min(dayOpen, dayClose) * 0.99;

        dailyCandles.push({
          asset_id: asset.id,
          time: dayTime,
          open: Number(dayOpen.toFixed(8)),
          high: Number(dayHigh.toFixed(8)),
          low: Number(Math.max(dayLow, 0.0001).toFixed(8)),
          close: Number(dayClose.toFixed(8))
        });
      }

      // Insert 1m candles in batches
      let insertedMinute = 0;
      for (let i = 0; i < minuteCandles.length; i += BATCH_SIZE) {
        const batch = minuteCandles.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('price_history')
          .upsert(batch, { onConflict: 'asset_id,time', ignoreDuplicates: true });
        if (!error) insertedMinute += batch.length;
      }

      // Insert hourly candles in batches
      let insertedHourly = 0;
      for (let i = 0; i < hourlyCandles.length; i += BATCH_SIZE) {
        const batch = hourlyCandles.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('price_history_hourly')
          .upsert(batch, { onConflict: 'asset_id,time', ignoreDuplicates: true });
        if (!error) insertedHourly += batch.length;
      }

      // Insert daily candles in batches
      let insertedDaily = 0;
      for (let i = 0; i < dailyCandles.length; i += BATCH_SIZE) {
        const batch = dailyCandles.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('price_history_daily')
          .upsert(batch, { onConflict: 'asset_id,time', ignoreDuplicates: true });
        if (!error) insertedDaily += batch.length;
      }

      console.log(`${asset.symbol}: ${insertedMinute} 1m, ${insertedHourly} 1h, ${insertedDaily} 1d candles`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated 4 months of price history for ${assets.length} assets (1m: 2 days, 1h: 4 months, 1d: 4 months)` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating price history:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
