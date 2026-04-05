import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiStar, FiBookmark, FiInfo, FiZap } from "react-icons/fi";

const QAItem = ({ item, onPin }) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative group transition-all duration-500 rounded-[2rem] ${
        open 
          ? "bg-white shadow-[0_20px_50px_rgba(79,70,229,0.1)] border-indigo-100" 
          : "bg-white/60 backdrop-blur-md border-white/40 hover:bg-white shadow-sm hover:shadow-xl hover:shadow-indigo-50"
      } border overflow-hidden mb-6`}
    >
      {/* Active Indicator Line */}
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: "100%" }}
            exit={{ height: 0 }}
            className="absolute left-0 top-0 w-1.5 bg-gradient-to-b from-indigo-600 to-purple-600 z-10"
          />
        )}
      </AnimatePresence>

      <div 
        className="p-7 cursor-pointer flex items-start gap-5 relative z-10"
        onClick={() => setOpen(!open)}
      >
        <div className={`mt-0.5 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-500 ${
          open ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 rotate-6" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600"
        }`}>
          Q
        </div>
        
        <div className="flex-1">
          <h3 className={`font-bold text-xl leading-snug transition-colors duration-300 ${
            open ? "text-slate-900" : "text-slate-700 group-hover:text-indigo-600"
          }`}>
            {item.question}
          </h3>
          {!open && (
            <div className="flex items-center gap-4 mt-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <FiZap className="text-amber-400" /> AI Generated
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Click to reveal answer
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onPin?.(item._id); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              item.isPinned 
                ? "bg-amber-100 text-amber-600 shadow-inner" 
                : "text-slate-300 hover:bg-slate-50 hover:text-amber-500"
            }`}
          >
            <FiStar className={`w-5 h-5 ${item.isPinned ? "fill-amber-500" : ""}`} />
          </button>
          
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
            open ? "bg-slate-900 text-white rotate-180" : "bg-slate-50 text-slate-400 group-hover:bg-slate-200"
          }`}>
            <FiChevronDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
            className="border-t border-slate-50 overflow-hidden"
          >
            <div className="p-8 pt-4 bg-slate-50/30">
              <div className="max-w-none prose prose-indigo">
                <div className="flex items-center gap-2 mb-6">
                   <div className="h-[1px] flex-1 bg-slate-200"></div>
                   <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2 shadow-sm">
                     <FiBookmark /> expert analysis
                   </div>
                   <div className="h-[1px] flex-1 bg-slate-200"></div>
                </div>

                <div className="text-slate-700 leading-relaxed text-lg font-medium markdown-wrapper">
                  <ReactMarkdown>
                    {item.answer}
                  </ReactMarkdown>
                </div>
                
                {item.note && (
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 flex gap-4 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 shadow-sm"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                      <FiInfo className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">pro-tip insight</p>
                      <p className="text-amber-900 text-sm font-semibold leading-relaxed">{item.note}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default QAItem;