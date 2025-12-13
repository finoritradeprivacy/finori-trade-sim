import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting price update cycle...');
    
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

    // Get all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('is_active', true);

    if (assetsError) throw assetsError;

    // Get news events that are ready to trigger (scheduled_for <= now and not yet processed)
    const nowISO = new Date().toISOString();
    const { data: triggeredNews, error: newsError } = await supabase
      .from('news_events')
      .select('*')
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', nowISO);

    if (newsError) throw newsError;

    console.log(`Updating ${assets?.length || 0} assets, ${triggeredNews?.length || 0} triggered news`);

    // Process triggered news events
    const processedNewsIds: string[] = [];
    
    for (const news of triggeredNews || []) {
      if (news.asset_id) {
        const asset = assets?.find(a => a.id === news.asset_id);
        if (asset) {
          const currentPrice = Number(asset.current_price);
          const impactStrength = Number(news.impact_strength);
          const changePercent = news.impact_type === 'bullish' ? impactStrength : -impactStrength;
          const newPrice = currentPrice * (1 + changePercent / 100);
          
          // Determine reversion duration (10-30 minutes)
          const reversionMinutes = Math.floor(Math.random() * 21) + 10; // 10-30 minutes
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
        const asset = assets?.find(a => a.id === news.asset_id);
        if (asset) {
          const currentPrice = Number(asset.current_price);
          const originalPrice = Number(news.original_price);
          
          // Gradually revert price back to original
          const reversionProgress = 0.15; // Revert 15% of the remaining difference per cycle
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

    // Update each asset with normal fluctuations
    for (const asset of assets || []) {
      // Skip assets currently under news impact or reversion
      const hasActiveNews = reversionNews?.some(n => n.asset_id === asset.id) || 
                           processedNewsIds.some(id => triggeredNews?.find(n => n.id === id && n.asset_id === asset.id));
      
      if (hasActiveNews) continue;
      
      let priceChange = 0;
      
      // Normal small random fluctuation
      priceChange = (Math.random() - 0.5) * 0.5; // -0.25% to +0.25%

      // Calculate new price
      const currentPrice = Number(asset.current_price);
      const newPrice = currentPrice * (1 + priceChange / 100);
      
      // Update 24h change (weighted average to simulate realistic movement)
      const current24hChange = Number(asset.price_change_24h) || 0;
      const new24hChange = current24hChange * 0.95 + priceChange * 0.05;

      // Maintain 1m OHLC candle in price_history starting now (no backfill)
      const candleTime = Math.floor(Date.now() / 1000 / 60) * 60;

      const { data: existingCandle, error: selectCandleError } = await supabase
        .from('price_history')
        .select('id, open, high, low, close')
        .eq('asset_id', asset.id)
        .eq('time', candleTime)
        .maybeSingle();

      if (selectCandleError && selectCandleError.code !== 'PGRST116') {
        console.error(`Error selecting candle for ${asset.symbol}:`, selectCandleError);
      }

      if (existingCandle) {
        const { error: candleUpdateError } = await supabase
          .from('price_history')
          .update({
            high: Math.max(Number(existingCandle.high), newPrice),
            low: Math.min(Number(existingCandle.low), newPrice),
            close: newPrice,
          })
          .eq('id', existingCandle.id);
        if (candleUpdateError) {
          console.error(`Error updating candle for ${asset.symbol}:`, candleUpdateError);
        }
      } else {
        const open = currentPrice;
        const { error: candleInsertError } = await supabase
          .from('price_history')
          .insert({
            asset_id: asset.id,
            time: candleTime,
            open,
            high: Math.max(open, newPrice),
            low: Math.min(open, newPrice),
            close: newPrice,
          });
        if (candleInsertError) {
          console.error(`Error inserting candle for ${asset.symbol}:`, candleInsertError);
        }
      }

      // Update the asset
      const { error: updateError } = await supabase
        .from('assets')
        .update({
          current_price: newPrice,
          price_change_24h: new24hChange,
          updated_at: new Date().toISOString(),
        })
        .eq('id', asset.id);

      if (updateError) {
        console.error(`Error updating ${asset.symbol}:`, updateError);
      }
    }

    // Check price alerts and trigger notifications
    const { data: activeAlerts, error: alertsError } = await supabase
      .from('price_alerts')
      .select('*, assets!inner(symbol, current_price)')
      .eq('is_active', true);

    if (!alertsError && activeAlerts && activeAlerts.length > 0) {
      for (const alert of activeAlerts) {
        const asset = assets?.find(a => a.id === alert.asset_id);
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
          // Mark alert as triggered
          await supabase
            .from('price_alerts')
            .update({ 
              is_active: false, 
              triggered_at: new Date().toISOString() 
            })
            .eq('id', alert.id);

          // Create notification for user
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

    console.log('Price update cycle completed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: assets?.length || 0,
        newsProcessed: triggeredNews?.length || 0,
        alertsChecked: activeAlerts?.length || 0
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
