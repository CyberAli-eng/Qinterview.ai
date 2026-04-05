import { FiPlus, FiCpu, FiMessageSquare } from "react-icons/fi";
import { motion } from "framer-motion";

const EmptyState = ({ onGenerate, generating }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center shadow-inner"
    >
      <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
        <FiCpu className="w-12 h-12 text-indigo-500" />
        <div className="absolute top-0 right-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-4 border-white">
          AI
        </div>
      </div>
      
      <h3 className="text-2xl font-bold text-slate-800 mb-3">No Questions Generated Yet</h3>
      <p className="text-slate-500 text-lg max-w-sm mx-auto mb-10 leading-relaxed font-medium">
        Ready to sharpen your skills? Let our advanced AI curate a list of personalized interview questions for you.
      </p>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-3 px-10 py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xl shadow-2xl shadow-indigo-200 transition-all active:scale-95"
        >
          {generating ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><FiPlus /> Generate Questions</>}
        </button>
        
        <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
          <FiMessageSquare className="w-4 h-4" />
          <span>Usually takes about 10-15 seconds</span>
        </div>
      </div>
    </motion.div>
  );
};

export default EmptyState;
