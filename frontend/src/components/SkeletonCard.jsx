import { motion } from "framer-motion";

/**
 * SkeletonCard component with multiple variants
 * @param {string} variant - "qa", "session", "stat", "full"
 * @param {boolean} animated - Enable entrance animation
 */
const SkeletonCard = ({ variant = "qa", animated = true }) => {
  const baseClasses =
    "bg-white/60 backdrop-blur-sm border border-white/30 rounded-3xl overflow-hidden relative";

  const shimmerEffect = (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: "200%" }}
      transition={{
        duration: 1.8,
        repeat: Infinity,
        ease: "cubic-bezier(0.4, 0, 0.2, 1)",
        repeatDelay: 0.5,
      }}
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] pointer-events-none will-change-transform"
    />
  );

  const entranceAnimation = animated
    ? {
      initial: { opacity: 0, scale: 0.96 },
      animate: { opacity: 1, scale: 1 },
      transition: { type: "spring", damping: 20, stiffness: 300 },
    }
    : {};

  // QA Card Skeleton (used in InterviewPrep)
  if (variant === "qa") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-6 md:p-8 shadow-sm`}
        role="status"
        aria-label="Loading question card"
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-5 w-32 bg-slate-200 rounded-full animate-pulse" />
          </div>
          <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
        </div>

        <div className="space-y-3 mb-6">
          <div className="h-5 w-3/4 bg-slate-200 rounded-full animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded-full animate-pulse" />
          <div className="h-4 w-5/6 bg-slate-100 rounded-full animate-pulse" />
          <div className="h-4 w-2/3 bg-slate-100 rounded-full animate-pulse" />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          <div className="h-9 w-20 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-9 w-9 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-9 w-9 bg-slate-200 rounded-xl animate-pulse ml-auto" />
        </div>
        {shimmerEffect}
      </motion.div>
    );
  }

  // Session Card Skeleton (used in Dashboard)
  if (variant === "session") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-6 cursor-pointer shadow-sm`}
        role="status"
        aria-label="Loading session card"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 bg-slate-200 rounded-xl animate-pulse" />
          <div className="w-16 h-6 bg-slate-200 rounded-full animate-pulse" />
        </div>
        <div className="h-6 w-3/4 bg-slate-200 rounded-full animate-pulse mb-2" />
        <div className="h-4 w-1/2 bg-slate-200 rounded-full animate-pulse mb-4" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="h-3 w-16 bg-slate-200 rounded-full animate-pulse" />
            <div className="h-3 w-12 bg-slate-200 rounded-full animate-pulse" />
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-gradient-to-r from-indigo-200 to-purple-200 rounded-full animate-pulse" />
          </div>
        </div>
        {shimmerEffect}
      </motion.div>
    );
  }

  // Stat Card Skeleton (used in Dashboard stats)
  if (variant === "stat") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-6 shadow-sm`}
        role="status"
        aria-label="Loading statistic card"
      >
        <div className="w-12 h-12 bg-slate-200 rounded-xl animate-pulse mb-4" />
        <div className="h-8 w-20 bg-slate-200 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-24 bg-slate-200 rounded-full animate-pulse" />
        {shimmerEffect}
      </motion.div>
    );
  }

  // Full Page / Hero Skeleton (for loading entire sections)
  if (variant === "full") {
    return (
      <motion.div
        {...entranceAnimation}
        className={`${baseClasses} p-8 shadow-sm min-h-[400px] flex flex-col items-center justify-center`}
        role="status"
        aria-label="Loading content"
      >
        <div className="w-20 h-20 bg-slate-200 rounded-full animate-pulse mb-6" />
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-64 bg-slate-200 rounded-full animate-pulse mb-2" />
        <div className="h-4 w-56 bg-slate-200 rounded-full animate-pulse" />
        <div className="mt-8 flex gap-3">
          <div className="h-12 w-32 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-12 w-32 bg-slate-200 rounded-xl animate-pulse" />
        </div>
        {shimmerEffect}
      </motion.div>
    );
  }

  // Default fallback (same as QA)
  return (
    <motion.div
      {...entranceAnimation}
      className={`${baseClasses} p-6`}
      role="status"
      aria-label="Loading"
    >
      <div className="h-6 w-3/4 bg-slate-200 rounded-full animate-pulse mb-4" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-slate-100 rounded-full animate-pulse" />
        <div className="h-4 w-5/6 bg-slate-100 rounded-full animate-pulse" />
      </div>
      {shimmerEffect}
    </motion.div>
  );
};

export default SkeletonCard;