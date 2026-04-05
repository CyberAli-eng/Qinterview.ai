import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMenu,
  FiX,
  FiArrowRight,
  FiLogOut,
  FiUser,
  FiChevronRight,
  FiHome,
  FiZap
} from "react-icons/fi";

const Navbar = ({ variant = "marketing", onMenuToggle, leftAction, rightAction, userName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Scroll detection for glassmorphism intensify
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const navLinks = {
    marketing: [
      { name: "Features", href: "#features" },
      { name: "How it Works", href: "#how-it-works" },
      { name: "Pricing", href: "#pricing" },
    ],
    app: [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Analytics", href: "/analytics" },
    ],
    auth: [
      { name: "Back to Home", href: "/", icon: <FiHome className="w-4 h-4" /> },
    ]
  };

  const currentLinks = navLinks[variant] || [];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
        ? "py-3 bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-lg"
        : "py-5 bg-transparent"
        }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Left Side: Logo or custom leftAction */}
        <div className="flex items-center gap-4">
          {leftAction ? (
            leftAction
          ) : (
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform">
                Q
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent hidden sm:inline">
                Interview.ai
              </span>
            </Link>
          )}
        </div>

        {/* Desktop Links - Marketing */}
        {variant === "marketing" && (
          <div className="hidden md:flex items-center gap-8">
            {currentLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-slate-600 font-semibold hover:text-indigo-600 transition-colors"
              >
                {link.name}
              </a>
            ))}
            <div className="h-6 w-px bg-slate-200 mx-2" />
            <Link
              to="/login"
              className="text-slate-900 font-bold hover:text-indigo-600 transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2 group"
            >
              Get Started <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}

        {/* Desktop Links - Auth */}
        {variant === "auth" && (
          <div className="hidden md:flex items-center gap-6">
            {location.pathname === "/login" ? (
              <div className="flex items-center gap-4">
                <span className="text-slate-500 font-medium">New to QInterview.ai?</span>
                <Link
                  to="/signup"
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Create Account
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-slate-500 font-medium">Already have an account?</span>
                <Link
                  to="/login"
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Log In
                </Link>
              </div>
            )}
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-all"
            >
              <FiHome /> Home
            </Link>
          </div>
        )}

        {/* Desktop Links - App */}
        {variant === "app" && (
          <div className="hidden md:flex items-center gap-6">
            {rightAction ? (
              rightAction
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-black">
                    P
                  </div>
                  <div>
                    <p className="text-xs font-black text-indigo-700 uppercase leading-none">Pro Plan</p>
                    <p className="text-[10px] text-indigo-500 font-bold">Session Active</p>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 line-clamp-1 max-w-[120px]">{userName || "User"}</p>
                    <button
                      onClick={handleLogout}
                      className="text-[10px] font-black text-red-500 uppercase tracking-wider hover:underline"
                    >
                      Sign Out
                    </button>
                  </div>
                  <div className="w-10 h-10 bg-indigo-100 border-2 border-white rounded-full flex items-center justify-center text-indigo-600 shadow-inner overflow-hidden font-bold">
                    {userName ? userName[0].toUpperCase() : <FiUser className="w-6 h-6 text-slate-400" />}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Mobile Toggle */}
        <div className="flex items-center gap-4 md:hidden">
          {variant === "app" && (
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
              <FiZap className="w-4 h-4" />
            </div>
          )}
          <button
            onClick={() => {
              setIsOpen(!isOpen);
              if (onMenuToggle) onMenuToggle(!isOpen);
            }}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            {isOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/95 backdrop-blur-xl border-b border-white/20 overflow-hidden"
          >
            <div className="px-6 py-8 space-y-6">
              {currentLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="flex items-center justify-between text-xl font-bold text-slate-900"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                  <FiChevronRight className="text-slate-400" />
                </a>
              ))}

              {variant === "marketing" && (
                <div className="pt-6 space-y-4">
                  <Link
                    to="/login"
                    className="block w-full py-4 text-center text-xl font-bold text-slate-900 bg-slate-100 rounded-2xl"
                    onClick={() => setIsOpen(false)}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="block w-full py-4 text-center text-xl font-bold text-white bg-slate-900 rounded-2xl shadow-xl shadow-slate-200"
                    onClick={() => setIsOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              )}

              {variant === "app" && (
                <div className="pt-6 space-y-4 border-t border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
                      {userName ? userName[0].toUpperCase() : <FiUser className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{userName || "User"}</p>
                      <p className="text-sm text-slate-500 uppercase font-black text-[10px] tracking-widest text-indigo-500">Premium Member</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full py-4 text-center text-xl font-bold text-red-600 bg-red-50 rounded-2xl"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;