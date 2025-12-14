import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Main price update logic - OPTIMIZED with batch operations
async function performPriceUpdate(supabase: any, updateIndex: number, totalUpdates: number = 60) {
  console.log(`[Update ${updateIndex + 1}/${totalUpdates}] Starting price update...`);
  
  // Get all active assets
  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('*')
    .eq('is_active', true);

  if (assetsError) throw assetsError;

  // Only delete old news and process triggered news on first update of the cycle
  if (updateIndex === 0) {
    // Delete news events older than 1 hour (after publication)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { error: deleteNewsError, count: deletedCount } = await supabase
      .from('news_events')
      .delete()
      .is('scheduled_for', null)
      .lt('created_at', oneHourAgo);

    if (deleteNewsError) {
      console.error('Error deleting old news:', deleteNewsError);
    } else if (deletedCount && deletedCount > 0) {
      console.log(`Deleted ${deletedCount} old news events`);
    }
  }

  // Get news events that are ready to trigger (scheduled_for <= now and not yet processed)
  const nowISO = new Date().toISOString();
  const { data: triggeredNews, error: newsError } = await supabase
    .from('news_events')
    .select('*')
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', nowISO);

  if (newsError) throw newsError;

  console.log(`[Update ${updateIndex + 1}/${totalUpdates}] Updating ${assets?.length || 0} assets, ${triggeredNews?.length || 0} triggered news`);

  // Process triggered news events
  const processedNewsIds: string[] = [];
  
  for (const news of triggeredNews || []) {
    if (news.asset_id) {
      const asset = assets?.find((a: any) => a.id === news.asset_id);
      if (asset) {
        const currentPrice = Number(asset.current_price);
        const impactStrength = Number(news.impact_strength);
        const changePercent = news.impact_type === 'bullish' ? impactStrength : -impactStrength;
        const newPrice = currentPrice * (1 + changePercent / 100);
        
        // Determine reversion duration (10-30 minutes)
        const reversionMinutes = Math.floor(Math.random() * 21) + 10;
        const reversionCompleteAt = new Date(Date.now() + reversionMinutes * 60000);
        
        // Update asset price immediately
        await supabase
          .from('assets')
          .update({
            current_price: newPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('id', asset.id);
        
        // Mark news as triggered and store reversion data
        await supabase
          .from('news_events')
          .update({ 
            scheduled_for: null,
            original_price: currentPrice,
            reversion_complete_at: reversionCompleteAt.toISOString()
          })
          .eq('id', news.id);
        
        processedNewsIds.push(news.id);
        console.log(`Applied news to ${asset.symbol}: ${changePercent.toFixed(2)}%, reversion in ${reversionMinutes}min`);
      }
    }
  }

  // Handle mean reversion for active news
  const now = new Date();
  const { data: reversionNews, error: reversionError } = await supabase
    .from('news_events')
    .select('*')
    .not('original_price', 'is', null)
    .not('reversion_complete_at', 'is', null)
    .gte('reversion_complete_at', now.toISOString());

  if (!reversionError && reversionNews && reversionNews.length > 0) {
    for (const news of reversionNews) {
      const asset = assets?.find((a: any) => a.id === news.asset_id);
      if (asset) {
        const currentPrice = Number(asset.current_price);
        const originalPrice = Number(news.original_price);
        
        // Gradually revert price back to original (adjusted for 1-second updates)
        const reversionProgress = 0.003; // Revert 0.3% per second (~18% per minute)
        const newPrice = currentPrice + (originalPrice - currentPrice) * reversionProgress;
        
        await supabase
          .from('assets')
          .update({
            current_price: newPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('id', asset.id);
        
        // If close enough to original price, clear reversion tracking
        if (Math.abs(newPrice - originalPrice) / originalPrice < 0.01) {
          await supabase
            .from('news_events')
            .update({ 
              original_price: null,
              reversion_complete_at: null
            })
            .eq('id', news.id);
          
          console.log(`Reversion complete for ${asset.symbol}`);
        }
      }
    }
  }

  // OPTIMIZED: Batch fetch 24h old prices for all assets in ONE query
  const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 86400;
  const assetIds = (assets || []).map((a: any) => a.id);
  
  // Get the most recent price before 24h ago for each asset
  const { data: oldPricesData } = await supabase
    .from('price_history')
    .select('asset_id, close, time')
    .in('asset_id', assetIds)
    .lte('time', twentyFourHoursAgo)
    .order('time', { ascending: false });

  // Build a map of asset_id -> old price (first occurrence = most recent)
  const oldPriceMap = new Map<string, number>();
  for (const row of oldPricesData || []) {
    if (!oldPriceMap.has(row.asset_id)) {
      oldPriceMap.set(row.asset_id, Number(row.close));
    }
  }

  // OPTIMIZED: Batch fetch existing candles for current minute
  const candleTime = Math.floor(Date.now() / 1000 / 60) * 60;
  const prevCandleTime = candleTime - 60; // Previous minute
  
  const { data: existingCandles } = await supabase
    .from('price_history')
    .select('id, asset_id, open, high, low, close, time')
    .in('asset_id', assetIds)
    .in('time', [candleTime, prevCandleTime]);

  const candleMap = new Map<string, any>();
  const prevCandleMap = new Map<string, any>();
  for (const candle of existingCandles || []) {
    if (Number(candle.time) === candleTime) {
      candleMap.set(candle.asset_id, candle);
    } else if (Number(candle.time) === prevCandleTime) {
      prevCandleMap.set(candle.asset_id, candle);
    }
  }

  // Prepare batch updates
  const assetUpdates: any[] = [];
  const candleUpdates: any[] = [];
  const candleInserts: any[] = [];

  // Update each asset with normal fluctuations
  for (const asset of assets || []) {
    // Skip assets currently under news impact or reversion
    const hasActiveNews = reversionNews?.some((n: any) => n.asset_id === asset.id) || 
                         processedNewsIds.some(id => triggeredNews?.find((n: any) => n.id === id && n.asset_id === asset.id));
    
    if (hasActiveNews) continue;
    
    // Normal small random fluctuation (adjusted for 1-second intervals)
    const priceChange = (Math.random() - 0.5) * 0.02; // -0.01% to +0.01% per second

    // Calculate new price
    const currentPrice = Number(asset.current_price);
    const newPrice = currentPrice * (1 + priceChange / 100);
    
    // Calculate actual 24h change from pre-fetched data
    // If no 24h old price exists, use the current stored price_change_24h with small drift
    const oldPrice = oldPriceMap.get(asset.id);
    let new24hChange: number;
    if (oldPrice && oldPrice > 0) {
      new24hChange = (newPrice - oldPrice) / oldPrice; // Stored as decimal (0.01 = 1%)
    } else {
      // No 24h history yet - apply small random drift to existing change
      const currentChange = Number(asset.price_change_24h) || 0;
      const drift = (Math.random() - 0.5) * 0.0002; // Very small drift
      new24hChange = currentChange + drift;
    }

    // Prepare asset update
    assetUpdates.push({
      id: asset.id,
      current_price: newPrice,
      price_change_24h: new24hChange,
      updated_at: new Date().toISOString(),
    });

    // Handle candle update/insert
    const existingCandle = candleMap.get(asset.id);
    if (existingCandle) {
      candleUpdates.push({
        id: existingCandle.id,
        high: Math.max(Number(existingCandle.high), newPrice),
        low: Math.min(Number(existingCandle.low), newPrice),
        close: newPrice,
      });
    } else {
      // For new candle, use previous candle's close as open for continuity
      const prevCandle = prevCandleMap.get(asset.id);
      const openPrice = prevCandle ? Number(prevCandle.close) : currentPrice;
      
      candleInserts.push({
        asset_id: asset.id,
        time: candleTime,
        open: openPrice,
        high: Math.max(openPrice, newPrice),
        low: Math.min(openPrice, newPrice),
        close: newPrice,
      });
    }
  }

  // OPTIMIZED: Execute batch updates using Promise.all for parallel execution
  if (assetUpdates.length > 0) {
    // Use individual updates in parallel (upsert requires all NOT NULL columns)
    const updatePromises = assetUpdates.map(update => 
      supabase
        .from('assets')
        .update({
          current_price: update.current_price,
          price_change_24h: update.price_change_24h,
          updated_at: update.updated_at,
        })
        .eq('id', update.id)
    );
    
    await Promise.all(updatePromises);
  }

  // Update existing candles in batch
  for (const update of candleUpdates) {
    await supabase
      .from('price_history')
      .update({ high: update.high, low: update.low, close: update.close })
      .eq('id', update.id);
  }

  // Insert new candles using upsert to handle duplicates
  if (candleInserts.length > 0) {
    const { error: candleInsertError } = await supabase
      .from('price_history')
      .upsert(candleInserts, { 
        onConflict: 'asset_id,time',
        ignoreDuplicates: false 
      });
    
    if (candleInsertError) {
      console.error('Batch candle insert error:', candleInsertError);
    }
  }

  // Aggregate to hourly table every minute (on minute 0 of hour, aggregate previous hour)
  const currentMinute = new Date().getUTCMinutes();
  if (currentMinute === 0 && updateIndex === 0) {
    const hourAgo = Math.floor((Date.now() - 3600000) / 1000 / 3600) * 3600;
    const hourEnd = hourAgo + 3600;
    
    for (const asset of assets || []) {
      // Fetch all 1m candles for the past hour
      const { data: hourCandles, error: hourError } = await supabase
        .from('price_history')
        .select('open, high, low, close, time')
        .eq('asset_id', asset.id)
        .gte('time', hourAgo)
        .lt('time', hourEnd)
        .order('time', { ascending: true });
      
      if (hourError || !hourCandles || hourCandles.length === 0) continue;
      
      const hourlyCandle = {
        asset_id: asset.id,
        time: hourAgo,
        open: Number(hourCandles[0].open),
        high: Math.max(...hourCandles.map((c: any) => Number(c.high))),
        low: Math.min(...hourCandles.map((c: any) => Number(c.low))),
        close: Number(hourCandles[hourCandles.length - 1].close)
      };
      
      await supabase.from('price_history_hourly').upsert(hourlyCandle, { onConflict: 'asset_id,time' });
    }
    console.log('Aggregated hourly candles');
  }

  // Aggregate to daily table at midnight UTC (on hour 0, aggregate previous day)
  const currentHour = new Date().getUTCHours();
  if (currentHour === 0 && currentMinute === 0 && updateIndex === 0) {
    const dayAgo = Math.floor((Date.now() - 86400000) / 1000 / 86400) * 86400;
    const dayEnd = dayAgo + 86400;
    
    for (const asset of assets || []) {
      // Fetch all hourly candles for the past day
      const { data: dayCandles, error: dayError } = await supabase
        .from('price_history_hourly')
        .select('open, high, low, close, time')
        .eq('asset_id', asset.id)
        .gte('time', dayAgo)
        .lt('time', dayEnd)
        .order('time', { ascending: true });
      
      if (dayError || !dayCandles || dayCandles.length === 0) continue;
      
      const dailyCandle = {
        asset_id: asset.id,
        time: dayAgo,
        open: Number(dayCandles[0].open),
        high: Math.max(...dayCandles.map((c: any) => Number(c.high))),
        low: Math.min(...dayCandles.map((c: any) => Number(c.low))),
        close: Number(dayCandles[dayCandles.length - 1].close)
      };
      
      await supabase.from('price_history_daily').upsert(dailyCandle, { onConflict: 'asset_id,time' });
    }
    console.log('Aggregated daily candles');
    
    // Cleanup old 1m candles (older than 2 days)
    const twoDaysAgo = Math.floor(Date.now() / 1000) - (2 * 86400);
    const { error: cleanupError, count: deletedCount } = await supabase
      .from('price_history')
      .delete()
      .lt('time', twoDaysAgo);
    
    if (!cleanupError && deletedCount) {
      console.log(`Cleaned up ${deletedCount} old 1m candles`);
    }
    
    // Cleanup old hourly candles (older than 120 days)
    const fourMonthsAgo = Math.floor(Date.now() / 1000) - (120 * 86400);
    await supabase.from('price_history_hourly').delete().lt('time', fourMonthsAgo);
    
    // Cleanup old daily candles (older than 400 days)
    const fourHundredDaysAgo = Math.floor(Date.now() / 1000) - (400 * 86400);
    await supabase.from('price_history_daily').delete().lt('time', fourHundredDaysAgo);
  }

  // Process pending limit and stop orders
  const { data: pendingOrders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .in('order_type', ['limit', 'stop']);

  if (!ordersError && pendingOrders && pendingOrders.length > 0) {
    // Refresh assets with updated prices
    const { data: updatedAssets } = await supabase
      .from('assets')
      .select('*')
      .eq('is_active', true);
    
    for (const order of pendingOrders) {
      const asset = updatedAssets?.find((a: any) => a.id === order.asset_id);
      if (!asset) continue;

      const currentPrice = Number(asset.current_price);
      const orderPrice = Number(order.price);
      const stopPrice = order.stop_price ? Number(order.stop_price) : null;
      let shouldExecute = false;

      if (order.order_type === 'limit') {
        if (order.side === 'buy' && currentPrice <= orderPrice) {
          shouldExecute = true;
        } else if (order.side === 'sell' && currentPrice >= orderPrice) {
          shouldExecute = true;
        }
      } else if (order.order_type === 'stop' && stopPrice) {
        if (order.side === 'buy' && currentPrice >= stopPrice) {
          shouldExecute = true;
        } else if (order.side === 'sell' && currentPrice <= stopPrice) {
          shouldExecute = true;
        }
      }

      if (shouldExecute) {
        try {
          // Get user balance
          const { data: balanceData } = await supabase
            .from('user_balances')
            .select('usdt_balance')
            .eq('user_id', order.user_id)
            .single();

          // Get user portfolio for this asset
          const { data: portfolioData } = await supabase
            .from('portfolios')
            .select('*')
            .eq('user_id', order.user_id)
            .eq('asset_id', order.asset_id)
            .maybeSingle();

          const orderQuantity = Number(order.quantity);
          const executionPrice = order.order_type === 'stop' ? currentPrice : orderPrice;
          const totalValue = orderQuantity * executionPrice;
          
          if (order.side === 'buy') {
            if (!balanceData || Number(balanceData.usdt_balance) < totalValue) {
              await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
              await supabase.from('user_notifications').insert({
                user_id: order.user_id,
                notification_type: 'order_cancelled',
                title: `Order Cancelled: ${asset.symbol}`,
                message: `Insufficient balance to execute ${order.order_type} buy order for ${orderQuantity} ${asset.symbol}`,
                metadata: { order_id: order.id, asset_symbol: asset.symbol }
              });
              continue;
            }

            await supabase.from('user_balances')
              .update({ usdt_balance: Number(balanceData.usdt_balance) - totalValue })
              .eq('user_id', order.user_id);

            if (portfolioData) {
              const newQuantity = Number(portfolioData.quantity) + orderQuantity;
              const newInvested = Number(portfolioData.total_invested) + totalValue;
              const newAvgPrice = newInvested / newQuantity;
              await supabase.from('portfolios')
                .update({ quantity: newQuantity, total_invested: newInvested, average_buy_price: newAvgPrice })
                .eq('id', portfolioData.id);
            } else {
              await supabase.from('portfolios').insert({
                user_id: order.user_id,
                asset_id: order.asset_id,
                quantity: orderQuantity,
                average_buy_price: executionPrice,
                total_invested: totalValue
              });
            }
          } else {
            if (!portfolioData || Number(portfolioData.quantity) < orderQuantity) {
              await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
              await supabase.from('user_notifications').insert({
                user_id: order.user_id,
                notification_type: 'order_cancelled',
                title: `Order Cancelled: ${asset.symbol}`,
                message: `Insufficient holdings to execute ${order.order_type} sell order for ${orderQuantity} ${asset.symbol}`,
                metadata: { order_id: order.id, asset_symbol: asset.symbol }
              });
              continue;
            }

            const { data: currentBalance } = await supabase
              .from('user_balances')
              .select('usdt_balance')
              .eq('user_id', order.user_id)
              .single();

            await supabase.from('user_balances')
              .update({ usdt_balance: Number(currentBalance?.usdt_balance || 0) + totalValue })
              .eq('user_id', order.user_id);

            const newQuantity = Number(portfolioData.quantity) - orderQuantity;
            if (newQuantity <= 0) {
              await supabase.from('portfolios').delete().eq('id', portfolioData.id);
            } else {
              const newInvested = Number(portfolioData.total_invested) * (newQuantity / Number(portfolioData.quantity));
              await supabase.from('portfolios')
                .update({ quantity: newQuantity, total_invested: newInvested })
                .eq('id', portfolioData.id);
            }
          }

          await supabase.from('trades').insert({
            user_id: order.user_id,
            asset_id: order.asset_id,
            order_id: order.id,
            side: order.side,
            quantity: orderQuantity,
            price: executionPrice,
            total_value: totalValue
          });

          await supabase.from('orders').update({
            status: 'filled',
            filled_quantity: orderQuantity,
            average_fill_price: executionPrice,
            filled_at: new Date().toISOString()
          }).eq('id', order.id);

          await supabase.from('user_notifications').insert({
            user_id: order.user_id,
            notification_type: 'order_filled',
            title: `Order Filled: ${asset.symbol}`,
            message: `Your ${order.order_type} ${order.side} order for ${orderQuantity} ${asset.symbol} was executed at $${executionPrice.toFixed(2)}`,
            metadata: { order_id: order.id, asset_symbol: asset.symbol, price: executionPrice, quantity: orderQuantity }
          });

          console.log(`Executed ${order.order_type} ${order.side} order for ${asset.symbol}: ${orderQuantity} @ ${executionPrice}`);
        } catch (execError) {
          console.error(`Error executing order ${order.id}:`, execError);
        }
      }
    }
  }

  // Check price alerts and trigger notifications
  const { data: activeAlerts, error: alertsError } = await supabase
    .from('price_alerts')
    .select('*, assets!inner(symbol, current_price)')
    .eq('is_active', true);

  if (!alertsError && activeAlerts && activeAlerts.length > 0) {
    // Refresh assets one more time for alerts
    const { data: latestAssets } = await supabase
      .from('assets')
      .select('*')
      .eq('is_active', true);
    
    for (const alert of activeAlerts) {
      const asset = latestAssets?.find((a: any) => a.id === alert.asset_id);
      if (!asset) continue;

      const currentPrice = Number(asset.current_price);
      const targetPrice = Number(alert.target_price);
      let triggered = false;

      if (alert.condition === 'above' && currentPrice >= targetPrice) {
        triggered = true;
      } else if (alert.condition === 'below' && currentPrice <= targetPrice) {
        triggered = true;
      }

      if (triggered) {
        await supabase
          .from('price_alerts')
          .update({ 
            is_active: false, 
            triggered_at: new Date().toISOString() 
          })
          .eq('id', alert.id);

        await supabase
          .from('user_notifications')
          .insert({
            user_id: alert.user_id,
            notification_type: 'price_alert',
            title: `Price Alert: ${asset.symbol}`,
            message: `${asset.symbol} has reached $${currentPrice.toFixed(2)} (target: $${targetPrice.toFixed(2)} ${alert.condition})`,
            metadata: {
              asset_id: alert.asset_id,
              asset_symbol: asset.symbol,
              target_price: targetPrice,
              current_price: currentPrice,
              condition: alert.condition
            }
          });

        console.log(`Alert triggered for ${asset.symbol}: ${currentPrice} ${alert.condition} ${targetPrice}`);
      }
    }
  }

  console.log(`[Update ${updateIndex + 1}/${totalUpdates}] Price update completed`);
  return { assets: assets?.length || 0, news: triggeredNews?.length || 0, alerts: activeAlerts?.length || 0 };
}

// Helper function to wait
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Background task that runs 59 additional updates (at 1s, 2s, ... 59s)
async function runDelayedUpdates(supabase: any) {
  try {
    for (let i = 1; i < 60; i++) {
      await sleep(1000);
      await performPriceUpdate(supabase, i, 60);
    }
    console.log('All 60 price updates completed for this cycle');
  } catch (error) {
    console.error('Error in delayed updates:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting price update cycle (60 updates over 60 seconds - 1 per second)...');
    
    // Verify cron signature using env or DB fallback
    const signature = req.headers.get('X-Cron-Signature') || '';
    const envSecret = Deno.env.get('CRON_SECRET') || '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let dbSecret: string | null = null;
    try {
      const { data: cfg, error: cfgError } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'cron_secret')
        .maybeSingle();
      if (!cfgError) {
        dbSecret = (cfg as any)?.value ?? null;
      } else {
        console.error('Error loading cron secret from DB:', cfgError);
      }
    } catch (e) {
      console.error('Exception loading cron secret from DB:', e);
    }

    const validSignature =
      !!signature &&
      ((envSecret && signature === envSecret) || (dbSecret && signature === dbSecret));

    if (!validSignature) {
      console.error('Unauthorized: Invalid or missing cron signature');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Run first update immediately
    const result = await performPriceUpdate(supabase, 0, 60);

    // Schedule the remaining 59 updates as background tasks
    // Using EdgeRuntime.waitUntil to keep the function alive
    (globalThis as any).EdgeRuntime?.waitUntil?.(runDelayedUpdates(supabase));

    console.log('First update done, 59 background updates scheduled (1 per second)');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '60 updates scheduled over 60 seconds (1 per second)',
        firstUpdate: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in price update:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
