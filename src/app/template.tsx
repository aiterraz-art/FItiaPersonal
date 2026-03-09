"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
    const reduceMotion = useReducedMotion();

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
            className="w-full min-h-screen"
        >
            {children}
        </motion.div>
    );
}
