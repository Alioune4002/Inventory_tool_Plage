import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
};

export default function PageTransition({ children, keyName }) {
  const reduce = useReducedMotion();
  const transition = { duration: reduce ? 0 : 0.28, ease: "easeOut" };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={keyName || "page"}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={transition}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
