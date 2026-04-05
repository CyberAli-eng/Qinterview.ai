import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";
import Navbar from "../components/Navbar";

const SignUp = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: "",
    general: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const nameInputRef = useRef(null);

  // Auto-focus name field on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Real-time validators
  const validateName = (name) => {
    if (!name) return "Full name is required";
    if (name.trim().length < 2) return "Name must be at least 2 characters";
    if (!/^[a-zA-Z\s]+$/.test(name)) return "Name can only contain letters and spaces";
    return "";
  };

  const validateEmail = (email) => {
    if (!email) return "Email is required";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return "Invalid email format";
    return "";
  };

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

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const validateConfirmPassword = (confirm, password) => {
    if (!confirm) return "Please confirm your password";
    if (confirm !== password) return "Passwords do not match";
    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Real-time field validation
    let error = "";
    if (name === "name") error = validateName(value);
    if (name === "email") error = validateEmail(value);
    if (name === "password") {
      error = validatePassword(value);
      // Also revalidate confirm password if it exists
      if (form.confirmPassword) {
        const confirmError = validateConfirmPassword(form.confirmPassword, value);
        setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
      }
    }
    if (name === "confirmPassword") error = validateConfirmPassword(value, form.password);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSignup = async () => {
    // Final validation
    const nameError = validateName(form.name);
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);
    const confirmError = validateConfirmPassword(form.confirmPassword, form.password);
    const termsError = acceptTerms ? "" : "You must accept the Terms & Conditions";

    if (nameError || emailError || passwordError || confirmError || termsError) {
      setErrors({
        name: nameError,
        email: emailError,
        password: passwordError,
        confirmPassword: confirmError,
        terms: termsError,
        general: "",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(API_PATHS.AUTH.SIGNUP, {
        name: form.name.trim(),
        email: form.email,
        password: form.password,
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("userName", res.data.name);
      // Show success message
      alert("Account created successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || "Signup failed. Please try again.";
      setErrors((prev) => ({ ...prev, general: msg }));
      // Auto-clear general error after 4 seconds
      setTimeout(() => setErrors((prev) => ({ ...prev, general: "" })), 4000);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) handleSignup();
  };

  // Password strength
  const passwordStrength = getPasswordStrength(form.password);
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"];
  const strengthText = ["", "Weak", "Medium", "Strong", "Very Strong"];

  // Background floating orbs animation (matching login/landing)
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

  // Stagger variants for form fields
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
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/30 hover:shadow-purple-100/50 transition-shadow duration-500">

          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-center text-slate-900 mb-2"
          >
            Create Account
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-slate-500 text-center mb-8"
          >
            Join the future of interview preparation
          </motion.p>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* Full Name */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Full Name
              </label>
              <input
                ref={nameInputRef}
                name="name"
                type="text"
                value={form.name}
                placeholder="John Doe"
                onChange={handleChange}
                className={`w-full bg-slate-50 border ${errors.name ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-purple-200"
                  } rounded-2xl p-4 pr-10 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
              />
              <AnimatePresence>
                {errors.name && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.name}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Email */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  placeholder="name@example.com"
                  onChange={handleChange}
                  className={`w-full bg-slate-50 border ${errors.email ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-purple-200"
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

            {/* Password */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  placeholder="Create a strong password"
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-transparent transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition"
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

            {/* Confirm Password */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  placeholder="Confirm your password"
                  onChange={handleChange}
                  className={`w-full bg-slate-50 border ${errors.confirmPassword ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-purple-200"
                    } rounded-2xl p-4 pr-12 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition"
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <AnimatePresence>
                {errors.confirmPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-xs mt-1 ml-1"
                  >
                    {errors.confirmPassword}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Terms & Conditions */}
            <motion.div variants={itemVariants} className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (e.target.checked) setErrors((prev) => ({ ...prev, terms: "" }));
                  else setErrors((prev) => ({ ...prev, terms: "You must accept the Terms & Conditions" }));
                }}
                className="mt-1 w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="terms" className="text-sm text-slate-600">
                I accept the{" "}
                <a href="/terms" className="text-purple-600 hover:underline font-medium">
                  Terms & Conditions
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-purple-600 hover:underline font-medium">
                  Privacy Policy
                </a>
              </label>
            </motion.div>
            <AnimatePresence>
              {errors.terms && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-500 text-xs -mt-2 ml-6"
                >
                  {errors.terms}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* General Error Alert */}
          <AnimatePresence>
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
              >
                {errors.general}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Signup Button */}
          <motion.button
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            onClick={handleSignup}
            disabled={
              loading ||
              !!errors.name ||
              !!errors.email ||
              !!errors.password ||
              !!errors.confirmPassword ||
              !form.name ||
              !form.email ||
              !form.password ||
              !form.confirmPassword ||
              !acceptTerms
            }
            className={`w-full py-4 rounded-2xl font-bold text-lg mt-6 transition-all duration-200 flex items-center justify-center gap-2 ${loading ||
              errors.name ||
              errors.email ||
              errors.password ||
              errors.confirmPassword ||
              !form.name ||
              !form.email ||
              !form.password ||
              !form.confirmPassword ||
              !acceptTerms
              ? "bg-slate-300 cursor-not-allowed text-slate-500"
              : "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-200 hover:shadow-xl"
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
                Creating Account...
              </>
            ) : (
              "Join Now →"
            )}
          </motion.button>

          {/* Divider */}
          <div className="flex items-center my-8">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
            <p className="px-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
              quick setup
            </p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"
            />
          </div>

          {/* Login Link */}
          <p className="text-center text-slate-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-purple-600 font-bold hover:text-purple-700 transition-all hover:underline"
            >
              Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignUp;