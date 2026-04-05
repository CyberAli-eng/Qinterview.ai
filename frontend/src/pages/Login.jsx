import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";
import Navbar from "../components/Navbar";

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const emailInputRef = useRef(null);

  // Auto-focus email input on mount
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  // Real-time email validation
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "Email is required";
    if (!re.test(email)) return "Invalid email format";
    return "";
  };

  // Password strength indicator
  const getPasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const handleForm = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Real-time validation
    if (name === "email") {
      setErrors({ ...errors, email: validateEmail(value) });
    } else if (name === "password") {
      setErrors({ ...errors, password: value ? "" : "Password is required" });
    }
  };

  const handleLogin = async () => {
    // Final validation
    const emailError = validateEmail(form.email);
    const passwordError = form.password ? "" : "Password is required";
    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(API_PATHS.AUTH.LOGIN, form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("userName", res.data.name);
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", form.email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      // Animated error alert (custom toast-like)
      const errorMsg = error.response?.data?.message || "Invalid email or password";
      setErrors({ ...errors, form: errorMsg });
      setTimeout(() => setErrors({ ...errors, form: "" }), 4000);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) handleLogin();
  };

  // Background floating orbs animation
  const orbVariants = {
    animate: (i) => ({
      x: [0, 40, -30, 0],
      y: [0, -50, 30, 0],
      scale: [1, 1.3, 0.8, 1],
      transition: {
        duration: 18,
        repeat: Infinity,
        repeatType: "mirror",
        delay: i * 2.5,
      },
    }),
  };

  // Form field stagger variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 12 } },
  };

  const passwordStrength = getPasswordStrength(form.password);
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const strengthText = ["", "Weak", "Medium", "Strong", "Very Strong"];

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50 px-4 pt-24 pb-12 relative overflow-hidden font-sans"
      onKeyPress={handleKeyPress}
    >
      <Navbar variant="auth" />
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-1/4 -left-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute top-3/4 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/30 hover:shadow-indigo-100/50 transition-shadow duration-500">

          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-center text-slate-900 mb-2"
          >
            Welcome Back
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-slate-500 text-center mb-8"
          >
            Access your AI-powered interview prep
          </motion.p>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* Email Field */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  ref={emailInputRef}
                  name="email"
                  type="email"
                  value={form.email}
                  placeholder="name@example.com"
                  onChange={handleForm}
                  className={`w-full bg-slate-50 border ${errors.email ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-indigo-200"
                    } rounded-2xl p-4 pr-10 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
                />
                {form.email && !errors.email && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
                  >
                    ✓
                  </motion.div>
                )}
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Password Field */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  placeholder="••••••••"
                  onChange={handleForm}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-transparent transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition"
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {form.password && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  className="mt-2"
                >
                  <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 transition-all duration-300 ${i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-slate-200"
                          }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {strengthText[passwordStrength]} password
                  </p>
                </motion.div>
              )}
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Remember Me & Forgot Password */}
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-between"
            >
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-all hover:underline"
              >
                Forgot password?
              </Link>
            </motion.div>
          </motion.div>

          {/* Global Form Error */}
          <AnimatePresence>
            {errors.form && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
              >
                {errors.form}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Button */}
          <motion.button
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            onClick={handleLogin}
            disabled={loading || !!errors.email || !form.email || !form.password}
            className={`w-full py-4 rounded-2xl font-bold text-lg mt-6 transition-all duration-200 flex items-center justify-center gap-2 ${loading || errors.email || !form.email || !form.password
              ? "bg-slate-300 cursor-not-allowed text-slate-500"
              : "bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-200 hover:shadow-xl"
              }`}
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Authenticating...
              </>
            ) : (
              "Login →"
            )}
          </motion.button>

          {/* Divider with animated line */}
          <div className="flex items-center my-8">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
            <p className="px-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
              secure login
            </p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-slate-600">
            New here?{" "}
            <Link
              to="/signup"
              className="text-indigo-600 font-bold hover:text-indigo-700 transition-all hover:underline"
            >
              Create Account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;