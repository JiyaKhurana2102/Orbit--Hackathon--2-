import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';

export default function LoadingScreen() {
  const navigate = useNavigate();
  const [stars, setStars] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([]);

  useEffect(() => {
    // Generate random stars
    const newStars = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 2,
    }));
    setStars(newStars);

    // Navigate to welcome after 3 seconds
    const timer = setTimeout(() => {
      navigate('/welcome');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 overflow-hidden">
      {/* Starfield Background */}
      <div className="absolute inset-0">
        {stars.map((star) => (
          <motion.div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
            }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: star.delay,
            }}
          />
        ))}
      </div>

      {/* Center Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        {/* Orbiting Planet/Star Animation */}
        <motion.div
          className="relative w-40 h-40 mb-8"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          {/* Central Celestial Body */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 via-cyan-500 to-blue-500"
            animate={{
              boxShadow: [
                '0 0 20px rgba(168, 85, 247, 0.5)',
                '0 0 40px rgba(6, 182, 212, 0.8)',
                '0 0 20px rgba(168, 85, 247, 0.5)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          {/* Orbiting Ring */}
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className="absolute top-1/2 left-1/2 w-60 h-60 -ml-30 -mt-30 border-2 border-cyan-400/30 rounded-full" 
                 style={{ transform: 'rotateX(75deg)' }} />
          </motion.div>

          {/* Small Orbiting Object */}
          <motion.div
            className="absolute top-0 left-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full bg-cyan-300"
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            style={{
              boxShadow: '0 0 10px rgba(103, 232, 249, 0.8)',
            }}
          />
        </motion.div>

        {/* Loading Text */}
        <motion.h2
          className="text-2xl text-white font-light tracking-wider"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Initializing Orbit…
        </motion.h2>

        {/* Particles */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-purple-300 rounded-full"
              style={{
                left: `${50 + (Math.random() - 0.5) * 50}%`,
                top: `${50 + (Math.random() - 0.5) * 50}%`,
              }}
              animate={{
                x: [(Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100],
                y: [(Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
