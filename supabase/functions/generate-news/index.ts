import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: string;
  asset_type: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting news generation cycle...');

    // Check if we're in quiet hours (22:00-6:00 CET)
    const now = new Date();
    const cetTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
    const hour = cetTime.getHours();
    
    if (hour >= 22 || hour < 6) {
      console.log('Quiet hours - skipping news generation');
      return new Response(
        JSON.stringify({ success: true, message: 'Quiet hours - no news generated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('is_active', true);

    if (assetsError) throw assetsError;
    if (!assets || assets.length === 0) throw new Error('No assets found');

    // Select 5-20 random assets
    const numberOfAssets = Math.floor(Math.random() * 16) + 5; // 5-20
    const shuffled = [...assets].sort(() => Math.random() - 0.5);
    const selectedAssets = shuffled.slice(0, numberOfAssets);

    console.log(`Generating news for ${selectedAssets.length} assets`);

    // Generate news for each selected asset
    const newsPromises = selectedAssets.map(async (asset: Asset) => {
      // Determine impact type and strength
      const impactTypes = ['bullish', 'bearish', 'neutral'];
      const impactType = impactTypes[Math.floor(Math.random() * impactTypes.length)];
      
      let impactStrength: number;
      const impactLevel = Math.random();
      if (impactLevel < 0.5) {
        // Minor: 0.2-0.5%
        impactStrength = 0.2 + Math.random() * 0.3;
      } else if (impactLevel < 0.85) {
        // Medium: 0.6-1.5%
        impactStrength = 0.6 + Math.random() * 0.9;
      } else {
        // Major: 2-5%
        impactStrength = 2.0 + Math.random() * 3.0;
      }

      // Event types based on asset category
      const eventTypes = asset.asset_type === 'crypto' 
        ? ['partnership', 'regulation', 'technology_update', 'market_sentiment', 'adoption']
        : ['earnings', 'product_launch', 'merger', 'regulation', 'market_sentiment'];
      
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      // Generate realistic news using AI
      let headline = '';
      let content = '';
      
      try {
        const prompt = `Generate a realistic, concise market news headline and brief content for ${asset.name} (${asset.symbol}). 
Event type: ${eventType}
Impact: ${impactType}
Keep it professional and market-relevant. Return JSON with "headline" (max 80 chars) and "content" (max 150 chars).`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a financial news generator. Generate realistic, professional market news. Always respond with valid JSON only.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.8,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const responseText = aiData.choices?.[0]?.message?.content || '';
          
          try {
            const parsed = JSON.parse(responseText);
            headline = parsed.headline || `${asset.name} ${eventType.replace('_', ' ')} update`;
            content = parsed.content || `Market moving news for ${asset.symbol}`;
          } catch {
            headline = `${asset.name} ${eventType.replace('_', ' ')} update`;
            content = `Market moving news for ${asset.symbol}`;
          }
        } else {
          headline = `${asset.name} ${eventType.replace('_', ' ')} update`;
          content = `Market moving news for ${asset.symbol}`;
        }
      } catch (aiError) {
        console.error('AI generation error:', aiError);
        headline = `${asset.name} ${eventType.replace('_', ' ')} update`;
        content = `Market moving news for ${asset.symbol}`;
      }

      // Schedule news to trigger in 15-45 minutes
      const minutesUntilTrigger = Math.floor(Math.random() * 31) + 15; // 15-45 minutes
      const scheduledFor = new Date(Date.now() + minutesUntilTrigger * 60000);

      // Insert news event
      const { error: insertError } = await supabase
        .from('news_events')
        .insert({
          asset_id: asset.id,
          headline,
          content,
          event_type: eventType,
          impact_type: impactType,
          impact_strength: impactStrength,
          scheduled_for: scheduledFor.toISOString(),
        });

      if (insertError) {
        console.error(`Error inserting news for ${asset.symbol}:`, insertError);
        return null;
      }

      return { asset: asset.symbol, scheduledFor, impactType, impactStrength };
    });

    const results = await Promise.all(newsPromises);
    const successCount = results.filter(r => r !== null).length;

    console.log(`Successfully generated ${successCount} news events`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        generated: successCount,
        assets: results.filter(r => r !== null)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in news generation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
