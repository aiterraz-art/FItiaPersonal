"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
                type: "spring",
                stiffness: 350,
                damping: 30,
                mass: 0.8
            }}
            className="w-full min-h-screen"
        >
            {children}
        </motion.div>
    );
}
