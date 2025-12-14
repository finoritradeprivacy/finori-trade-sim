import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { TrendingUp, Shield, Zap, Eye, EyeOff, Check, X, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  
  // OTP verification states
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const { signIn, user, resetPassword, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (user) {
      if (searchParams.get("reset") === "true") {
        setShowResetPassword(true);
      } else {
        navigate("/trade");
      }
    }
  }, [user, navigate, searchParams]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const passwordRequirements = useMemo(() => ({
    hasMinLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }), [password]);

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);

  const passwordStrength = useMemo(() => {
    const metCount = Object.values(passwordRequirements).filter(Boolean).length;
    if (metCount <= 2) return { level: 'weak', label: 'Weak', color: 'bg-loss' };
    if (metCount <= 4) return { level: 'medium', label: 'Medium', color: 'bg-warning' };
    return { level: 'strong', label: 'Strong', color: 'bg-profit' };
  }, [passwordRequirements]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (!isPasswordValid) {
      toast.error("Password doesn't meet all requirements");
      return;
    }

    if (nickname.length < 3) {
      toast.error("Nickname must be at least 3 characters");
      return;
    }

    setLoading(true);
    
    try {
      // Call edge function to send verification email
      const { data, error } = await supabase.functions.invoke('send-verification-email', {
        body: { email, nickname, password },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Failed to send verification email");
        setLoading(false);
        return;
      }

      // Show OTP verification screen
      setPendingEmail(email);
      setShowOtpVerification(true);
      setResendCooldown(60);
      toast.success("Verification code sent to your email!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send verification email");
    }
    
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-email', {
        body: { action: 'verify', email: pendingEmail, code: otpCode },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Invalid verification code");
        setLoading(false);
        return;
      }

      toast.success("Email verified! You can now sign in.");
      setShowOtpVerification(false);
      setOtpCode("");
      setPendingEmail("");
      // Reset form
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    }
    
    setLoading(false);
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-email', {
        body: { action: 'resend', email: pendingEmail },
      });

      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Failed to resend code");
        setLoading(false);
        return;
      }

      setResendCooldown(60);
      toast.success("New verification code sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend code");
    }
    
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast.error(error.message || "Failed to sign in");
    } else {
      toast.success("Welcome back!");
      navigate("/trade");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);

    if (error) {
      toast.error(error.message || "Failed to send reset email");
    } else {
      toast.success("Password reset email sent! Check your inbox.");
      setShowForgotPassword(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(newPassword);
    setLoading(false);

    if (error) {
      toast.error(error.message || "Failed to update password");
    } else {
      toast.success("Password updated successfully!");
      setShowResetPassword(false);
      navigate("/trade");
    }
  };

  // OTP Verification screen
  if (showOtpVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 border-glow w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Verify Your Email</h2>
            <p className="text-muted-foreground mt-2">
              We sent a 6-digit code to<br />
              <span className="text-foreground font-medium">{pendingEmail}</span>
            </p>
          </div>

          <div className="flex justify-center mb-6">
            <InputOTP
              maxLength={6}
              value={otpCode}
              onChange={setOtpCode}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={handleVerifyOtp}
            className="w-full gradient-purple glow-purple mb-4"
            disabled={loading || otpCode.length !== 6}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Email"
            )}
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Didn't receive the code?
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || loading}
            >
              {resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                "Resend Code"
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full mt-4"
            onClick={() => {
              setShowOtpVerification(false);
              setOtpCode("");
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign Up
          </Button>
        </Card>
      </div>
    );
  }

  // Reset password form (after clicking email link)
  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 border-glow w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center">Set New Password</h2>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-new-password"
                  type={showConfirmNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                >
                  {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gradient-purple glow-purple"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // Forgot password form
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 border-glow w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2 text-center">Reset Password</h2>
          <p className="text-muted-foreground text-center mb-6">
            Enter your email and we'll send you a link to reset your password.
          </p>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full gradient-purple glow-purple"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowForgotPassword(false)}
            >
              Back to Sign In
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-5xl font-bold text-gradient">FinoriTrade</h1>
            <p className="text-xl text-muted-foreground">
              Master trading without financial risk
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Realistic Market Simulation</h3>
                <p className="text-sm text-muted-foreground">
                  Experience real trading dynamics with order books, liquidity, and market events
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Risk-Free Learning</h3>
                <p className="text-sm text-muted-foreground">
                  Start with $100,000 USDT virtual money and learn without consequences
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Real-Time Trading</h3>
                <p className="text-sm text-muted-foreground">
                  Execute market and limit orders with instant feedback and analytics
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            By using this platform, I agree to{" "}
            <a 
              href="https://docs.google.com/document/d/1pDJrRq4CcQAN18keSsrTexdAhXDmeNv14ohOg4wjy8E/edit?usp=sharing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              this document
            </a>
          </p>

          <div className="flex gap-4 mt-4">
            <a href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">About Us</a>
            <a href="/faq" className="text-sm text-muted-foreground hover:text-primary transition-colors">FAQ</a>
            <a href="/contacts" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contacts</a>
          </div>
        </div>

        <Card className="p-8 border-glow">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-sm text-muted-foreground"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot password?
                </Button>

                <Button
                  type="submit"
                  className="w-full gradient-purple glow-purple"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-nickname">Nickname</Label>
                  <Input
                    id="signup-nickname"
                    type="text"
                    placeholder="TradingPro"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {password && (
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium">Password strength:</span>
                          <span className={`font-semibold ${
                            passwordStrength.level === 'weak' ? 'text-loss' : 
                            passwordStrength.level === 'medium' ? 'text-warning' : 'text-profit'
                          }`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                            style={{ 
                              width: passwordStrength.level === 'weak' ? '33%' : 
                                     passwordStrength.level === 'medium' ? '66%' : '100%' 
                            }}
                          />
                        </div>
                      </div>
                      
                      <p className="text-muted-foreground font-medium">Password must contain:</p>
                      <div className="grid grid-cols-2 gap-1">
                        <div className={`flex items-center gap-1 ${passwordRequirements.hasMinLength ? 'text-profit' : 'text-muted-foreground'}`}>
                          {passwordRequirements.hasMinLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>8+ characters</span>
                        </div>
                        <div className={`flex items-center gap-1 ${passwordRequirements.hasLowercase ? 'text-profit' : 'text-muted-foreground'}`}>
                          {passwordRequirements.hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>Lowercase (a-z)</span>
                        </div>
                        <div className={`flex items-center gap-1 ${passwordRequirements.hasUppercase ? 'text-profit' : 'text-muted-foreground'}`}>
                          {passwordRequirements.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>Uppercase (A-Z)</span>
                        </div>
                        <div className={`flex items-center gap-1 ${passwordRequirements.hasDigit ? 'text-profit' : 'text-muted-foreground'}`}>
                          {passwordRequirements.hasDigit ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>Number (0-9)</span>
                        </div>
                        <div className={`flex items-center gap-1 ${passwordRequirements.hasSymbol ? 'text-profit' : 'text-muted-foreground'}`}>
                          {passwordRequirements.hasSymbol ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>Symbol (!@#$...)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-purple glow-purple"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending verification...
                    </>
                  ) : (
                    "Sign Up"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
