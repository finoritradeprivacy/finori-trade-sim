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
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Verify JWT token
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting price update cycle...');

    // Get all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('is_active', true);

    if (assetsError) throw assetsError;

    // Get news events that are ready to trigger (scheduled_for <= now and not yet processed)
    const now = new Date().toISOString();
    const { data: triggeredNews, error: newsError } = await supabase
      .from('news_events')
      .select('*')
      .lte('scheduled_for', now)
      .is('scheduled_for', null); // Only get pending news (not yet processed)

    if (newsError) throw newsError;

    console.log(`Updating ${assets?.length || 0} assets, ${triggeredNews?.length || 0} triggered news`);

    // Process triggered news events
    for (const news of triggeredNews || []) {
      if (news.asset_id) {
        const impactStrength = Number(news.impact_strength);
        const changePercent = news.impact_type === 'bullish' ? impactStrength : -impactStrength;
        
        const asset = assets?.find(a => a.id === news.asset_id);
        if (asset) {
          const currentPrice = Number(asset.current_price);
          const newPrice = currentPrice * (1 + changePercent / 100);
          
          // Update asset price immediately
          await supabase
            .from('assets')
            .update({
              current_price: newPrice,
              updated_at: new Date().toISOString(),
            })
            .eq('id', asset.id);
          
          console.log(`Applied news to ${asset.symbol}: ${changePercent.toFixed(2)}%`);
        }
        
        // Mark news as processed by clearing scheduled_for
        await supabase
          .from('news_events')
          .update({ scheduled_for: null })
          .eq('id', news.id);
      }
    }

    // Update each asset with normal fluctuations
    for (const asset of assets || []) {
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

    console.log('Price update cycle completed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: assets?.length || 0,
        newsProcessed: triggeredNews?.length || 0 
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
