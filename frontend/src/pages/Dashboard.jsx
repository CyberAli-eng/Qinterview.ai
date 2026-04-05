import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";
import {
  FiPlus,
  FiArrowRight,
  FiLogOut,
  FiLayout,
  FiBookOpen,
  FiBarChart2,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiMenu,
  FiX,
  FiStar,
  FiTrendingUp,
} from "react-icons/fi";
import SkeletonCard from "../components/SkeletonCard";
import Navbar from "../components/Navbar";

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

// Stagger variants for session cards
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 15 } },
};

const Dashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
    setUserName(localStorage.getItem("userName") || "");
  }, []);

  const fetchSessions = async () => {
    setFetching(true);
    try {
      const res = await axios.get(API_PATHS.SESSION.GET_ALL);
      setSessions(res.data.sessions);
    } catch (error) {
      console.log(error.response);
      if (error.response?.status === 401) navigate("/login");
      else showToast("Failed to load sessions", "error");
    } finally {
      setFetching(false);
    }
  };

  const createSession = async () => {
    if (!role.trim()) {
      showToast("Please enter a target role", "error");
      return;
    }
    if (!experience.trim()) {
      showToast("Please enter experience level", "error");
      return;
    }
    setLoading(true);
    try {
      await axios.post(API_PATHS.SESSION.CREATE, {
        role: role.trim(),
        experience: experience.trim(),
        questions: [],
      });
      setRole("");
      setExperience("");
      await fetchSessions();
      showToast("Session created successfully!", "success");
    } catch (error) {
      console.log(error.response);
      showToast(error.response?.data?.message || "Failed to create session", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  // Calculate dashboard stats
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.questions?.length > 0).length;
  const completionRate = totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0;
  // Mock average score - in real app you'd have scores in session data
  const avgScore = sessions.reduce((acc, s) => acc + (s.avgScore || 0), 0) / totalSessions || 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative overflow-x-hidden">
      <Navbar
        variant="app"
        onMenuToggle={setMobileMenuOpen}
        userName={userName}
      />
      {/* Background Orbs & Grid */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          custom={0}
          variants={orbVariants}
          animate="animate"
          className="absolute top-20 -left-32 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={1}
          variants={orbVariants}
          animate="animate"
          className="absolute bottom-20 -right-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          custom={2}
          variants={orbVariants}
          animate="animate"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
      </div>
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border ${toast.type === "success"
              ? "bg-green-50/90 border-green-200 text-green-800"
              : "bg-red-50/90 border-red-200 text-red-800"
              }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex relative z-10">
        {/* Sidebar - Desktop & Mobile */}
        <motion.aside
          initial={{ x: -300 }}
          animate={{ x: mobileMenuOpen ? 0 : -300 }}
          transition={{ type: "spring", damping: 20 }}
          className={`fixed top-0 left-0 h-full w-72 bg-white/80 backdrop-blur-xl border-r border-white/30 shadow-2xl z-50 flex flex-col p-6 transition-all md:relative md:translate-x-0 md:w-64`}
        >
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                Q
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Interview.ai
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-slate-500 hover:text-slate-800"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            <motion.button
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-xl font-semibold transition-all"
            >
              <FiLayout className="w-5 h-5" /> Dashboard
            </motion.button>
            <motion.button
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-semibold transition-all"
            >
              <FiBookOpen className="w-5 h-5" /> My Prep
            </motion.button>
            <motion.button
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-semibold transition-all"
            >
              <FiBarChart2 className="w-5 h-5" /> Analytics
            </motion.button>
          </nav>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-semibold transition-all mt-auto"
          >
            <FiLogOut className="w-5 h-5" /> Logout
          </motion.button>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen p-4 md:p-8 pt-24 md:pt-24">

          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Pro</span>
            </h1>
            <p className="text-slate-500 mt-1">Track your interview preparation progress</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10"
          >
            {fetching ? (
              <>
                <SkeletonCard variant="stat" />
                <SkeletonCard variant="stat" />
                <SkeletonCard variant="stat" />
              </>
            ) : (
              <>
                <StatCard
                  icon={<FiBookOpen className="w-6 h-6" />}
                  title="Total Sessions"
                  value={totalSessions}
                  color="indigo"
                  delay={0}
                />
                <StatCard
                  icon={<FiCheckCircle className="w-6 h-6" />}
                  title="Completion Rate"
                  value={`${completionRate}%`}
                  color="purple"
                  delay={0.1}
                />
                <StatCard
                  icon={<FiStar className="w-6 h-6" />}
                  title="Avg. Score"
                  value={`${Math.round(avgScore)}%`}
                  color="pink"
                  delay={0.2}
                />
              </>
            )}
          </motion.div>

          {/* Create Session Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/60 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/30 shadow-xl mb-10"
          >
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full"></span>
              Start New Preparation
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                  Target Role
                </label>
                <input
                  placeholder="e.g. Senior Frontend Developer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                  Experience
                </label>
                <input
                  placeholder="e.g. 5+ years"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all font-medium"
                />
              </div>
              <div className="flex items-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={createSession}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white h-[58px] rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <FiPlus /> Create Session
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Sessions List */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-6 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></span>
              Your Recent Sessions
            </h2>
            {sessions.length > 0 && (
              <motion.button
                whileHover={{ x: 3 }}
                className="text-indigo-600 font-semibold text-sm flex items-center gap-1"
              >
                View All <FiChevronRight />
              </motion.button>
            )}
          </div>

          {fetching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={i} variant="session" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/60 backdrop-blur-sm rounded-3xl p-12 text-center border border-dashed border-slate-300"
            >
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiBookOpen className="w-10 h-10 text-slate-400" />
              </div>
              <p className="text-xl font-bold text-slate-800">No sessions yet</p>
              <p className="text-slate-500 mt-2">Create your first session above to begin your training</p>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {sessions.map((session) => (
                <SessionCard
                  key={session._id}
                  session={session}
                  onClick={() => navigate(`/interview/${session._id}`)}
                />
              ))}
            </motion.div>
          )}
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLogoutModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiLogOut className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Logout?</h3>
              <p className="text-slate-500 text-center mb-6">
                Are you sure you want to logout? You'll need to login again to access your sessions.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, title, value, color, delay }) => {
  const colorClasses = {
    indigo: "from-indigo-500 to-indigo-600",
    purple: "from-purple-500 to-purple-600",
    pink: "from-pink-500 to-pink-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all"
    >
      <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[color]} rounded-xl flex items-center justify-center text-white mb-4`}>
        {icon}
      </div>
      <p className="text-3xl font-black text-slate-900">{value}</p>
      <p className="text-slate-500 text-sm mt-1">{title}</p>
    </motion.div>
  );
};

// Session Card Component
const SessionCard = ({ session, onClick }) => {
  const questionCount = session.questions?.length || 0;
  const totalQuestions = 10; // Mock total, replace with actual from session config
  const progress = (questionCount / totalQuestions) * 100;

  // Determine experience level tag
  const getLevelTag = (exp) => {
    const years = parseInt(exp);
    if (isNaN(years)) return "Mid-Level";
    if (years < 2) return "Junior";
    if (years <= 5) return "Mid-Level";
    if (years <= 8) return "Senior";
    return "Lead";
  };
  const level = getLevelTag(session.experience);
  const levelColors = {
    Junior: "bg-green-100 text-green-700",
    "Mid-Level": "bg-blue-100 text-blue-700",
    Senior: "bg-purple-100 text-purple-700",
    Lead: "bg-orange-100 text-orange-700",
  };

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      onClick={onClick}
      className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg cursor-pointer group relative overflow-hidden transition-all hover:shadow-2xl"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-bl-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:from-indigo-600 group-hover:to-purple-600 group-hover:text-white transition-all">
            <FiBookOpen className="w-6 h-6" />
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${levelColors[level]}`}>
            {level}
          </span>
        </div>

        <h3 className="font-bold text-xl text-slate-900 mb-1 line-clamp-1">{session.role}</h3>
        <p className="text-slate-500 text-sm mb-4">{session.experience} experience</p>

        {/* Progress Section */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>{questionCount}/{totalQuestions} questions</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm group-hover:gap-3 transition-all">
          Continue Practice <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;