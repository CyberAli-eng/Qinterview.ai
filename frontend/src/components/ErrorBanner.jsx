import { FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import { motion } from "framer-motion";

const ErrorBanner = ({ message, onRetry }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 border border-red-100 rounded-3xl p-8 flex flex-col items-center text-center shadow-lg shadow-red-100/20"
    >
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <FiAlertCircle className="w-8 h-8 text-red-600" />
      </div>

      <h3 className="text-xl font-bold text-red-900 mb-2">Something went wrong</h3>
      <p className="text-red-700 font-medium max-w-sm mb-8 leading-relaxed">
        {message || "We encountered an error while fetching your questions. Please try again."}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-red-200 transition-all active:scale-95"
        >
          <FiRefreshCw className="w-5 h-5" /> Retry Request
        </button>
      )}
    </motion.div>
  );
};

export default ErrorBanner;
