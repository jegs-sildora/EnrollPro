import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { sileo } from "sileo";
import api from "@/api/axiosInstance";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toastApiError } from "@/hooks/useApiToast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { token, user, setAuth } = useAuthStore();
  const { schoolName, logoUrl, accentForeground } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

  const strokeColor = accentForeground === "0 0% 0%" ? "000000" : "ffffff";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (token && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [token, user, navigate]);

  if (token && user) return null;

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", data);
      setAuth(res.data.token, res.data.user);
      sileo.success({
        title: "Welcome back!",
        description: `Logged in as ${res.data.user.name}`,
      });
      navigate("/dashboard");
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-['Instrument_Sans',sans-serif] w-full overflow-hidden">
      {/* Google Font import via style tag */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap');
        
        :root {
          /* Deriving brand colors from the dynamic system accent */
          --brand: hsl(var(--accent));
          --brand-foreground: hsl(var(--accent-foreground));
          --brand-link: hsl(var(--accent-link));
          --brand-hsl: var(--accent);
          --brand-dark: color-mix(in srgb, var(--brand), black 15%);
          --brand-light: color-mix(in srgb, var(--brand), white 15%);
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
        .delay-600 { animation-delay: 0.6s; }

        .focus-brand:focus {
          border-color: var(--brand) !important;
          box-shadow: 0 0 0 4px hsl(var(--accent) / 0.12) !important;
          background: #fff !important;
          outline: none !important;
        }

        .btn-login {
          background: var(--brand);
          color: var(--brand-foreground);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-login:hover {
          background: var(--brand-light);
          transform: translateY(-1px);
          box-shadow: 0 10px 25px -5px hsl(var(--accent) / 0.3);
        }

        .btn-login:active {
          background: var(--brand-dark);
          transform: translateY(0);
        }
      `}</style>

      {/* ── Left Decorative Panel (Hidden on small screens) ── */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
        style={{ background: "var(--brand)" }}
      >
        {/* Pixel grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect x='2' y='2' width='36' height='36' rx='2' fill='none' stroke='%23${strokeColor}' stroke-width='1.5'/%3E%3Crect x='42' y='2' width='36' height='36' rx='2' fill='none' stroke='%23${strokeColor}' stroke-width='1.5'/%3E%3Crect x='2' y='42' width='36' height='36' rx='2' fill='none' stroke='%23${strokeColor}' stroke-width='1.5'/%3E%3Crect x='42' y='42' width='36' height='36' rx='2' fill='none' stroke='%23${strokeColor}' stroke-width='1.5'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 80px",
          }}
        />
        
        {/* Large Gradient Glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-50 pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, hsl(var(--accent-foreground) / 0.1) 0%, transparent 70%)"
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-up">
          <div 
            className="p-4 rounded-[2.5rem] backdrop-blur-md border shadow-2xl overflow-hidden size-32 flex items-center justify-center"
            style={{ 
              backgroundColor: "hsl(var(--accent-foreground) / 0.1)",
              borderColor: "hsl(var(--accent-foreground) / 0.2)"
            }}
          >
            {logoUrl ? (
              <img 
                src={`${API_BASE}${logoUrl}`} 
                alt="School Logo" 
                className="w-full h-full object-contain"
              />
            ) : (
              <LogoMark color="var(--brand-foreground)" size={64} />
            )}
          </div>
          <div className="text-center px-8">
            <h2 
              className="text-4xl font-bold tracking-tight mb-2 max-w-180.5 mx-auto"
              style={{ color: "var(--brand-foreground)" }}
            >
              {schoolName}
            </h2>
            <p 
              className="text-lg font-medium tracking-wide uppercase"
              style={{ color: "hsl(var(--accent-foreground) / 0.6)" }}
            >
              Enrollment Management System
            </p>
          </div>
        </div>

        {/* Floating accents */}
        <div 
          className="absolute bottom-12 left-12 flex items-center gap-4 text-sm font-medium"
          style={{ color: "hsl(var(--accent-foreground) / 0.4)" }}
        >
          <span className="w-8 h-px" style={{ backgroundColor: "hsl(var(--accent-foreground) / 0.2)" }}></span>
          <span>© 2026 ENROLLPRO</span>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex-1 lg:flex-none lg:w-135 xl:w-160 bg-white flex flex-col relative">
        
        {/* Mobile Logo / Brand */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-3">
          {logoUrl ? (
            <img 
              src={`${API_BASE}${logoUrl}`} 
              alt="Logo" 
              className="size-10 object-contain"
            />
          ) : (
            <LogoMark color="hsl(var(--accent))" size={32} />
          )}
          <span className="font-bold text-[#1a1a1a] tracking-tight">{schoolName}</span>
        </div>

        <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-20 xl:px-24">
          <div className="w-full max-w-105 mx-auto">
            
            {/* Header */}
            <header className="mb-10 animate-fade-up delay-100">
              <h1 className="text-3xl font-bold text-[#111] leading-tight tracking-tight mb-3">
                Welcome Back
              </h1>
              <p className="text-gray-500 text-lg">
                Please enter your details to sign in
              </p>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Email Field */}
              <div className="animate-fade-up delay-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@school.edu.ph"
                  required
                  autoComplete="email"
                  className="focus-brand w-full h-12 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 text-base text-[#1a1a1a] placeholder-[#94a3b8] transition-all"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="mt-2 text-sm font-medium text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="animate-fade-up delay-300">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Password
                  </label>
                  <a href="#" className="text-sm font-bold text-(--brand-link) hover:opacity-75 transition-opacity">
                    Forgot Password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="focus-brand w-full h-12 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 pr-12 text-base text-[#1a1a1a] placeholder-[#94a3b8] transition-all"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-2 text-sm font-medium text-red-500">{errors.password.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-login animate-fade-up delay-400 w-full h-14 rounded-2xl text-lg font-bold tracking-tight cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" style={{ color: "var(--brand-foreground)" }}>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </>
                ) : "Sign In"}
              </button>

              {/* Register Link */}
              <div className="text-center pt-4 animate-fade-up delay-500">
                <p className="text-gray-500 font-medium">
                  Don't have an account?{" "}
                  <Link to="/register" className="text-(--brand-link) font-bold hover:underline underline-offset-4">
                    Create one now
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable Logo Mark ── */
function LogoMark({ color = "#851414", size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4"  y="4"  width="18" height="18" rx="4" fill={color} opacity="0.95" />
      <rect x="26" y="4"  width="18" height="18" rx="4" fill={color} opacity="0.45" />
      <rect x="4"  y="26" width="18" height="18" rx="4" fill={color} opacity="0.45" />
      <rect x="34" y="34" width="10" height="10" rx="2"   fill={color} opacity="0.95" />
      <rect x="26" y="26" width="6"  height="6"  rx="1.5" fill={color} opacity="0.70" />
    </svg>
  );
}

/* ── Icon Components ── */
function Eye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
