import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendVerificationRequest {
  email: string;
  nickname: string;
  password: string;
}

interface VerifyCodeRequest {
  email: string;
  code: string;
}

interface ResendCodeRequest {
  email: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const action = body.action || "send";

    console.log(`Processing action: ${action}`, JSON.stringify(body));

    if (action === "send") {
      const email = body.email;
      const nickname = body.nickname;
      const password = body.password;

      if (!email || !nickname || !password) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const userExists = existingUsers?.users?.some(u => u.email === email);
      
      if (userExists) {
        return new Response(JSON.stringify({ error: "An account with this email already exists" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate 6-digit OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Delete any existing pending verifications for this email
      await supabase
        .from("pending_email_verifications")
        .delete()
        .eq("email", email);

      // Store pending verification (password stored temporarily for account creation)
      const { error: insertError } = await supabase
        .from("pending_email_verifications")
        .insert({
          email,
          nickname,
          password_hash: password, // Will be hashed by Supabase Auth when creating user
          otp_code: otpCode,
        });

      if (insertError) {
        console.error("Error storing pending verification:", insertError);
        return new Response(JSON.stringify({ error: "Failed to create verification" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send verification email using Resend API directly
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FinoriTrade <noreply@finoritrade.com>",
          to: [email],
          subject: "Your FinoriTrade Verification Code",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
                .logo { text-align: center; margin-bottom: 30px; }
                .logo h1 { color: #a855f7; font-size: 32px; margin: 0; }
                .card { background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%); border-radius: 16px; padding: 40px; border: 1px solid #a855f7; }
                .code-box { background: #0a0a0f; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
                .code { font-size: 48px; font-weight: bold; letter-spacing: 12px; color: #a855f7; font-family: 'Courier New', monospace; }
                .message { color: #a0a0a0; font-size: 16px; line-height: 1.6; text-align: center; }
                .warning { color: #f59e0b; font-size: 14px; text-align: center; margin-top: 20px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <h1>FinoriTrade</h1>
                </div>
                <div class="card">
                  <p class="message">Welcome, <strong>${nickname}</strong>!</p>
                  <p class="message">Use this verification code to complete your registration:</p>
                  <div class="code-box">
                    <div class="code">${otpCode}</div>
                  </div>
                  <p class="message">Enter this code in the app to verify your email address.</p>
                  <p class="warning">⚠️ This code expires in 10 minutes.</p>
                </div>
                <div class="footer">
                  <p>If you didn't request this, please ignore this email.</p>
                  <p>© 2024 FinoriTrade - Virtual Trading Simulator</p>
                </div>
              </div>
            </body>
            </html>
          `,
        }),
      });

      if (!emailResponse.ok) {
        const emailError = await emailResponse.text();
        console.error("Error sending email:", emailError);
        return new Response(JSON.stringify({ error: "Failed to send verification email" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Verification email sent to ${email} with code ${otpCode}`);

      return new Response(JSON.stringify({ success: true, message: "Verification email sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "verify") {
      const email = body.email;
      const code = body.code;

      if (!email || !code) {
        return new Response(JSON.stringify({ error: "Missing email or code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find pending verification
      const { data: pending, error: fetchError } = await supabase
        .from("pending_email_verifications")
        .select("*")
        .eq("email", email)
        .eq("otp_code", code)
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !pending) {
        console.error("Verification failed:", fetchError);
        return new Response(JSON.stringify({ error: "Invalid or expired verification code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create the actual user account
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: pending.email,
        password: pending.password_hash,
        email_confirm: true,
        user_metadata: {
          nickname: pending.nickname,
        },
      });

      if (authError) {
        console.error("Error creating user:", authError);
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark verification as complete and delete it
      await supabase
        .from("pending_email_verifications")
        .delete()
        .eq("id", pending.id);

      console.log(`User ${email} verified and created successfully`);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Email verified successfully",
        userId: authData.user?.id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "resend") {
      const email = body.email;

      if (!email) {
        return new Response(JSON.stringify({ error: "Missing email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find existing pending verification
      const { data: pending } = await supabase
        .from("pending_email_verifications")
        .select("*")
        .eq("email", email)
        .eq("verified", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!pending) {
        return new Response(JSON.stringify({ error: "No pending verification found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate new OTP code
      const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Update with new code and expiry
      await supabase
        .from("pending_email_verifications")
        .update({
          otp_code: newOtpCode,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .eq("id", pending.id);

      // Send new verification email
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FinoriTrade <noreply@finoritrade.com>",
          to: [email],
          subject: "Your FinoriTrade Verification Code",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0f; color: #ffffff; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
                .logo { text-align: center; margin-bottom: 30px; }
                .logo h1 { color: #a855f7; font-size: 32px; margin: 0; }
                .card { background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%); border-radius: 16px; padding: 40px; border: 1px solid #a855f7; }
                .code-box { background: #0a0a0f; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
                .code { font-size: 48px; font-weight: bold; letter-spacing: 12px; color: #a855f7; font-family: 'Courier New', monospace; }
                .message { color: #a0a0a0; font-size: 16px; line-height: 1.6; text-align: center; }
                .warning { color: #f59e0b; font-size: 14px; text-align: center; margin-top: 20px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <h1>FinoriTrade</h1>
                </div>
                <div class="card">
                  <p class="message">Here's your new verification code:</p>
                  <div class="code-box">
                    <div class="code">${newOtpCode}</div>
                  </div>
                  <p class="message">Enter this code in the app to verify your email address.</p>
                  <p class="warning">⚠️ This code expires in 10 minutes.</p>
                </div>
                <div class="footer">
                  <p>If you didn't request this, please ignore this email.</p>
                  <p>© 2024 FinoriTrade - Virtual Trading Simulator</p>
                </div>
              </div>
            </body>
            </html>
          `,
        }),
      });

      if (!emailResponse.ok) {
        const emailError = await emailResponse.text();
        console.error("Error resending email:", emailError);
        return new Response(JSON.stringify({ error: "Failed to resend verification email" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Verification email resent to ${email}`);

      return new Response(JSON.stringify({ success: true, message: "Verification email resent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in send-verification-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
