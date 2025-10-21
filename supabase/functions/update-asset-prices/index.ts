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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting price update cycle...');

    // Get all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('is_active', true);

    if (assetsError) throw assetsError;

    // Get recent news events (last 60 seconds)
    const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentNews, error: newsError } = await supabase
      .from('news_events')
      .select('*')
      .gte('created_at', sixtySecondsAgo);

    if (newsError) throw newsError;

    console.log(`Updating ${assets?.length || 0} assets, ${recentNews?.length || 0} recent news`);

    // Update each asset
    for (const asset of assets || []) {
      let priceChange = 0;
      
      // Check if there's news affecting this asset
      const assetNews = recentNews?.filter(news => 
        !news.asset_id || news.asset_id === asset.id
      ) || [];

      if (assetNews.length > 0) {
        // Apply news-based changes
        for (const news of assetNews) {
          const impactMultiplier = Number(news.impact_strength) || 0.5;
          let changePercent = 0;

          if (news.impact_type === 'bullish') {
            changePercent = (Math.random() * 3 + 2) * impactMultiplier; // +2% to +5%
          } else if (news.impact_type === 'bearish') {
            changePercent = -(Math.random() * 3 + 2) * impactMultiplier; // -2% to -5%
          } else {
            changePercent = (Math.random() - 0.5) * 2 * impactMultiplier; // -1% to +1%
          }

          priceChange += changePercent;
        }
        console.log(`Asset ${asset.symbol}: News impact ${priceChange.toFixed(2)}%`);
      } else {
        // Normal small random fluctuation
        priceChange = (Math.random() - 0.5) * 1.5; // -0.75% to +0.75%
      }

      // Calculate new price
      const currentPrice = Number(asset.current_price);
      const newPrice = currentPrice * (1 + priceChange / 100);
      
      // Update 24h change (weighted average to simulate realistic movement)
      const current24hChange = Number(asset.price_change_24h) || 0;
      const new24hChange = current24hChange * 0.95 + priceChange * 0.05;

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
        newsProcessed: recentNews?.length || 0 
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
