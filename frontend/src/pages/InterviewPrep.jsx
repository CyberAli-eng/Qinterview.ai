import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCpu,
  FiMessageCircle,
  FiClock,
  FiLayers,
  FiCheckCircle,
  FiCopy,
  FiThumbsUp,
  FiShare2,
  FiChevronDown,
  FiChevronUp,
  FiZap,
  FiStar,
} from "react-icons/fi";

import QAItem from "../components/QAItems";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import GenerateButton from "../components/GenerateButton";
import SkeletonCard from "../components/SkeletonCard";
import Navbar from "../components/Navbar";
import { API_PATHS } from "../utils/apiPaths";
import axios from "../utils/axiosInstance";

const parseError = (err) => {
  console.log(err);
  if (err.response)
    return (
      err.response.data?.message ||
      err.response.data?.error ||
      `Server error: ${err.response.status}`
    );
  if (err.request) return "Cannot reach server. Check your connection.";
  return err.message || "Something went wrong.";
};

const InterviewPrep = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [expandedQA, setExpandedQA] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [helpfulIds, setHelpfulIds] = useState(new Set());
  const [userName, setUserName] = useState("");
  const headerRef = useRef(null);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.95]);
  const headerBlur = useTransform(scrollY, [0, 100], [0, 8]);
  const headerBlurStr = useTransform(headerBlur, (val) => `blur(${val}px)`);

  // Floating orbs animation (consistent with other pages)
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

  const fetchSessionData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await axios.get(`${API_PATHS.SESSION.GET_ONE}/${id}`);
      setSession(res.data.session);
      const qs = res.data.session.questions || [];
      setQuestions(qs);
      // Auto-expand first question if any
      if (qs.length > 0 && expandedQA === null) setExpandedQA(qs[0]._id);
    } catch (err) {
      console.log(err.response);
      setFetchError(parseError(err));
      if (err.response?.status === 401) navigate("/login");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, expandedQA]);

  const generateQuestions = async () => {
    setGenerating(true);
    const loadingToast = toast.loading(
      <div className="flex items-center gap-2">
        <FiZap className="animate-pulse" />
        <span>AI is crafting expert questions...</span>
      </div>,
      {
        className: "!bg-slate-900 !text-white !font-bold !rounded-2xl",
        duration: Infinity,
      }
    );
    try {
      await axios.post(API_PATHS.AI.GENERATE_QUESTIONS, { sessionId: id });
      await fetchSessionData();
      toast.success(
        <div className="flex items-center gap-2">
          <FiCheckCircle className="text-green-400" />
          <span>{questions.length} expert questions generated!</span>
        </div>,
        { id: loadingToast }
      );
    } catch (err) {
      toast.error(parseError(err), { id: loadingToast });
    } finally {
      setGenerating(false);
    }
  };

  const copyAnswer = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Answer copied to clipboard!", {
      icon: "📋",
      duration: 1500,
      className: "!rounded-xl",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const markHelpful = (id) => {
    setHelpfulIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
    toast.success(
      helpfulIds.has(id) ? "Removed helpful mark" : "Thanks for your feedback!",
      { icon: helpfulIds.has(id) ? "👍" : "❤️", duration: 1000 }
    );
  };

  useEffect(() => {
    fetchSessionData();
    setUserName(localStorage.getItem("userName") || "");
  }, [fetchSessionData]);

  // Staggered QA card variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.2 },
    },
  };

  const cardVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 15 } },
    exit: { y: -20, opacity: 0, transition: { duration: 0.2 } },
  };

  const leftNavbarAction = (
    <motion.button
      whileHover={{ x: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate("/dashboard")}
      className="flex items-center gap-2 text-slate-600 font-semibold hover:text-indigo-600 transition-colors group"
    >
      <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" />
      <span className="hidden sm:inline">Back to Dashboard</span>
    </motion.button>
  );

  const rightNavbarAction = (
    <div className="flex items-center gap-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-wider shadow-sm"
      >
        <FiCpu className="w-3.5 h-3.5 animate-pulse" /> AI Enhanced
      </motion.div>
      <GenerateButton
        onClick={generateQuestions}
        generating={generating}
        loading={loading}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative overflow-x-hidden">
      <Navbar 
        variant="app" 
        leftAction={leftNavbarAction} 
        rightAction={rightNavbarAction} 
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

      <Toaster
        position="top-right"
        toastOptions={{
          className: "!rounded-2xl !px-6 !py-4 !shadow-xl !font-bold !backdrop-blur-md",
          duration: 4000,
          style: { background: "rgba(15, 23, 42, 0.9)", color: "white", border: "1px solid rgba(255,255,255,0.1)" },
        }}
      />


      <div className="max-w-5xl mx-auto px-6 py-10 md:py-14 pt-24 md:pt-32">
        {/* Session Header with Animated Stats */}
        <div className="mb-12">
          {session ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, type: "spring" }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 rounded-3xl blur-2xl -z-10" />
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-white/30 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                      <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.2em]">
                        Active Session
                      </p>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                      {session.role}
                    </h1>
                    <div className="flex flex-wrap items-center gap-6">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-2 text-slate-600 font-semibold text-sm bg-slate-100 px-3 py-1.5 rounded-full"
                      >
                        <FiLayers className="w-4 h-4 text-indigo-500" />
                        {session.experience} years exp.
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-2 text-slate-600 font-semibold text-sm bg-slate-100 px-3 py-1.5 rounded-full"
                      >
                        <FiClock className="w-4 h-4 text-indigo-500" />
                        {new Date(session.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center gap-2 text-slate-600 font-semibold text-sm bg-slate-100 px-3 py-1.5 rounded-full"
                      >
                        <FiMessageCircle className="w-4 h-4 text-indigo-500" />
                        {questions.length} question{questions.length !== 1 ? "s" : ""}
                      </motion.div>
                    </div>
                  </div>
                  {questions.length > 0 && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full"
                    >
                      <FiCheckCircle className="w-4 h-4" />
                      Ready for practice
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <SkeletonCard variant="full" />
          )}
        </div>

        {/* Q&A List with Enhanced Animations */}
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-6">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={i} variant="qa" />
              ))}
            </div>
          ) : fetchError ? (
            <ErrorBanner message={fetchError} onRetry={fetchSessionData} />
          ) : questions.length === 0 ? (
            <EmptyState onGenerate={generateQuestions} generating={generating} />
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 gap-6 pb-24"
            >
              <AnimatePresence mode="popLayout">
                {questions.map((q, idx) => (
                  <motion.div
                    key={q._id}
                    variants={cardVariants}
                    exit="exit"
                    layout
                    className="group"
                  >
                    <QAItem
                      item={q}
                      isExpanded={expandedQA === q._id}
                      onToggle={() =>
                        setExpandedQA(expandedQA === q._id ? null : q._id)
                      }
                      onCopy={() => copyAnswer(q.answer || "No answer provided.", q._id)}
                      onHelpful={() => markHelpful(q._id)}
                      isHelpful={helpfulIds.has(q._id)}
                      isCopied={copiedId === q._id}
                      index={idx + 1}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* Floating Action Button (Mobile) */}
      {!loading && questions.length > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={generateQuestions}
          disabled={generating}
          className="fixed bottom-6 right-6 md:hidden z-40 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center disabled:opacity-50"
        >
          {generating ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <FiZap className="w-6 h-6" />
          )}
        </motion.button>
      )}
    </div>
  );
};

export default InterviewPrep;