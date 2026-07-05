import { motion } from "motion/react";
import { Calendar } from "lucide-react";

interface SchoolYearTransitionLoaderProps {
  targetLabel: string | null;
}

export function SchoolYearTransitionLoader({ targetLabel }: SchoolYearTransitionLoaderProps) {
  // Dot bouncing variants
  const dotVariants = {
    initial: { y: 0 },
    animate: {
      y: [0, -12, 0],
    },
  };

  const dotTransition = {
    duration: 0.6,
    repeat: Infinity,
    ease: "easeInOut",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background select-none"
    >
      {/* Background Pixel SVG Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.05]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="loader-pixel-grid"
              x="0"
              y="0"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <rect x="2" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
              <rect x="42" y="2" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
              <rect x="2" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
              <rect x="42" y="42" width="36" height="36" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loader-pixel-grid)" />
        </svg>
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle at center, hsl(var(--primary)/0.08) 0%, transparent 65%)",
          }}
        />
      </div>

      {/* Main Content Card */}
      <div className="relative z-10 flex flex-col items-center max-w-md text-center px-6">
        {/* Smooth Bouncing Three Dots Loader */}
        <div className="flex gap-2.5 justify-center items-center h-4 mb-8">
          <motion.span
            className="w-3 h-3 rounded-full bg-primary"
            variants={dotVariants}
            initial="initial"
            animate="animate"
            transition={{ ...dotTransition, delay: 0 }}
          />
          <motion.span
            className="w-3 h-3 rounded-full bg-primary"
            variants={dotVariants}
            initial="initial"
            animate="animate"
            transition={{ ...dotTransition, delay: 0.12 }}
          />
          <motion.span
            className="w-3 h-3 rounded-full bg-primary"
            variants={dotVariants}
            initial="initial"
            animate="animate"
            transition={{ ...dotTransition, delay: 0.24 }}
          />
        </div>

        {/* Text Details */}
        <h1 className="text-2xl font-black tracking-tight text-foreground mb-2">
          Switching School Year
        </h1>
        
        <p className="font-extrabold text-foreground mb-8">
          {targetLabel ? (
            <>
              Preparing workspace for <span className="text-foreground font-extrabold">S.Y. {targetLabel}</span>...
            </>
          ) : (
            "Initializing school year configuration..."
          )}
        </p>

        
      </div>
    </motion.div>
  );
}
