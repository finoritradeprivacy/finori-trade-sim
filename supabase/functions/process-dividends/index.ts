import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-signature",
};

// Verify HMAC signature for cron jobs
async function verifyCronSignature(signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  
  const timestamp = Math.floor(Date.now() / 60000); // Current minute
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  // Check current and previous minute to handle timing edge cases
  for (const ts of [timestamp, timestamp - 1]) {
    const data = encoder.encode(`cron-${ts}`);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    if (signature === expectedSignature) return true;
  }
  
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify cron signature
    const cronSignature = req.headers.get("x-cron-signature");
    let cronSecret = Deno.env.get("CRON_SECRET");
    
    if (!cronSecret) {
      const { data: configData } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "cron_secret")
        .single();
      cronSecret = configData?.value;
    }

    const isValidCron = await verifyCronSignature(cronSignature, cronSecret || "");
    if (!isValidCron) {
      console.error("Invalid cron signature");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body to determine action
    const body = await req.json().catch(() => ({}));
    const action = body.action || "process_dividends";

    console.log(`Processing dividends action: ${action}`);

    if (action === "take_snapshot") {
      // Take 00:00 UTC snapshot - run this at 00:00 UTC
      const today = new Date().toISOString().split("T")[0];
      
      // Get all portfolios with stock assets that have dividend yield
      const { data: portfolios, error: portfolioError } = await supabase
        .from("portfolios")
        .select(`
          user_id,
          asset_id,
          quantity,
          assets!inner (
            id,
            current_price,
            dividend_yield,
            category
          )
        `)
        .gt("quantity", 0);

      if (portfolioError) {
        console.error("Error fetching portfolios:", portfolioError);
        throw portfolioError;
      }

      // Filter to only stocks with dividend yield > 0
      const eligiblePortfolios = (portfolios || []).filter(
        (p: any) => p.assets.category === "stocks" && p.assets.dividend_yield > 0
      );

      console.log(`Found ${eligiblePortfolios.length} eligible portfolios for dividend snapshot`);

      // Insert snapshots
      const snapshots = eligiblePortfolios.map((p: any) => ({
        user_id: p.user_id,
        asset_id: p.asset_id,
        quantity: p.quantity,
        price_at_snapshot: p.assets.current_price,
        dividend_yield_at_snapshot: p.assets.dividend_yield,
        snapshot_date: today,
      }));

      if (snapshots.length > 0) {
        const { error: insertError } = await supabase
          .from("dividend_snapshots")
          .upsert(snapshots, { onConflict: "user_id,asset_id,snapshot_date" });

        if (insertError) {
          console.error("Error inserting snapshots:", insertError);
          throw insertError;
        }
      }

      console.log(`Created ${snapshots.length} dividend snapshots for ${today}`);
      
      return new Response(
        JSON.stringify({ success: true, snapshots_created: snapshots.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "process_dividends") {
      // Process dividends at 10:00 UTC using yesterday's snapshot
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const snapshotDate = yesterday.toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];

      // Get yesterday's snapshots
      const { data: snapshots, error: snapshotError } = await supabase
        .from("dividend_snapshots")
        .select("*")
        .eq("snapshot_date", snapshotDate);

      if (snapshotError) {
        console.error("Error fetching snapshots:", snapshotError);
        throw snapshotError;
      }

      if (!snapshots || snapshots.length === 0) {
        console.log(`No snapshots found for ${snapshotDate}`);
        return new Response(
          JSON.stringify({ success: true, dividends_paid: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Processing ${snapshots.length} snapshots from ${snapshotDate}`);

      // Check for already processed dividends today
      const { data: existingPayments } = await supabase
        .from("dividend_payments")
        .select("snapshot_id")
        .eq("payment_date", today);

      const processedSnapshotIds = new Set((existingPayments || []).map((p: any) => p.snapshot_id));

      let totalDividendsPaid = 0;
      let usersNotified = 0;

      // Group by user for notifications
      const userDividends: Record<string, { total: number; assets: any[] }> = {};

      for (const snapshot of snapshots) {
        // Skip if already processed
        if (processedSnapshotIds.has(snapshot.id)) {
          continue;
        }

        // Skip if quantity is 0 or price is 0
        if (snapshot.quantity <= 0 || snapshot.price_at_snapshot <= 0) {
          continue;
        }

        // Calculate daily dividend: shares × price × (annual_yield / 365)
        const dailyDividend = snapshot.quantity * snapshot.price_at_snapshot * (snapshot.dividend_yield_at_snapshot / 365);

        if (dailyDividend <= 0) continue;

        // Record the payment
        const { error: paymentError } = await supabase.from("dividend_payments").insert({
          user_id: snapshot.user_id,
          asset_id: snapshot.asset_id,
          snapshot_id: snapshot.id,
          shares_held: snapshot.quantity,
          price_at_calculation: snapshot.price_at_snapshot,
          dividend_yield: snapshot.dividend_yield_at_snapshot,
          dividend_amount: dailyDividend,
          payment_date: today,
        });

        if (paymentError) {
          console.error("Error recording payment:", paymentError);
          continue;
        }

        // Credit the user's balance
        const { error: balanceError } = await supabase.rpc("increment_balance", {
          p_user_id: snapshot.user_id,
          p_amount: dailyDividend,
        });

        if (balanceError) {
          console.error("Error crediting balance:", balanceError);
          continue;
        }

        totalDividendsPaid += dailyDividend;

        // Collect for notification
        if (!userDividends[snapshot.user_id]) {
          userDividends[snapshot.user_id] = { total: 0, assets: [] };
        }
        userDividends[snapshot.user_id].total += dailyDividend;
        userDividends[snapshot.user_id].assets.push({
          asset_id: snapshot.asset_id,
          amount: dailyDividend,
          shares: snapshot.quantity,
        });
      }

      // Get asset names for notifications
      const allAssetIds = [...new Set(Object.values(userDividends).flatMap(u => u.assets.map(a => a.asset_id)))];
      const { data: assets } = await supabase
        .from("assets")
        .select("id, name, symbol")
        .in("id", allAssetIds);

      const assetMap = Object.fromEntries((assets || []).map(a => [a.id, a]));

      // Send notifications to each user
      for (const [userId, data] of Object.entries(userDividends)) {
        const assetSummary = data.assets
          .map(a => {
            const asset = assetMap[a.asset_id];
            return asset ? `${asset.symbol}: $${a.amount.toFixed(2)}` : null;
          })
          .filter(Boolean)
          .join(", ");

        const { error: notifError } = await supabase.from("user_notifications").insert({
          user_id: userId,
          notification_type: "dividend",
          title: "Dividend Payment Received",
          message: `You received $${data.total.toFixed(2)} in dividends. ${assetSummary}`,
          metadata: {
            total_amount: data.total,
            assets: data.assets,
            payment_date: today,
          },
        });

        if (!notifError) usersNotified++;
      }

      // Log audit
      console.log(`Dividends processed: $${totalDividendsPaid.toFixed(2)} paid to ${usersNotified} users`);

      return new Response(
        JSON.stringify({
          success: true,
          total_dividends_paid: totalDividendsPaid,
          users_notified: usersNotified,
          snapshot_date: snapshotDate,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error processing dividends:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
