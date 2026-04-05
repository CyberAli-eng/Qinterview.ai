import { FiZap, FiLoader } from "react-icons/fi";
import { motion } from "framer-motion";

const GenerateButton = ({ onClick, generating, loading }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    disabled={generating || loading}
    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-bold transition-all shadow-xl shadow-indigo-100 hover:shadow-indigo-200"
  >
    {generating ? (
      <>
        <FiLoader className="animate-spin w-5 h-5" /> Generating Insights...
      </>
    ) : (
      <>
        <FiZap className="w-5 h-5 fill-current" /> Generate New Questions
      </>
    )}
  </motion.button>
);

export default GenerateButton;