import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { updateInterests } from '../api/client';

const interests = [
  { id: 'tech', label: 'Tech Talks', emoji: '💻' },
  { id: 'networking', label: 'Networking', emoji: '🤝' },
  { id: 'startups', label: 'Startups', emoji: '🚀' },
  { id: 'finance', label: 'Finance', emoji: '📊' },
  { id: 'career', label: 'Career Events', emoji: '🧑‍💼' },
  { id: 'workshops', label: 'Workshops', emoji: '🎓' },
  { id: 'company', label: 'Company Visits', emoji: '🏢' },
  { id: 'creative', label: 'Creative Clubs', emoji: '🎨' },
  { id: 'food', label: 'Free Food', emoji: '🍕' },
];

export default function InterestSelection() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleInterest = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleLaunch = async () => {
    try {
      // Save user interests (if authenticated)
      try {
        await updateInterests(Array.from(selected));
      } catch (error) {
        console.log('Not authenticated yet, skipping interest save');
      }
      
      navigate('/feed');
    } catch (error) {
      console.error('Error during launch:', error);
      // Navigate anyway
      navigate('/feed');
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 overflow-auto">
      {/* Starfield Background */}
      <div className="absolute inset-0">
        {Array.from({ length: 80 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 0.5}px`,
              height: `${Math.random() * 2 + 0.5}px`,
            }}
            animate={{
              opacity: [0.2, 1, 0.2],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-full flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-2xl"
        >
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Choose your orbit.
            </h1>
            <p className="text-lg text-cyan-200 italic">
              What opportunities are you interested in?
            </p>
          </div>

          {/* Interest Chips */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
            {interests.map((interest, index) => {
              const isSelected = selected.has(interest.id);
              return (
                <motion.button
                  key={interest.id}
                  onClick={() => toggleInterest(interest.id)}
                  className={`relative p-6 rounded-2xl border-2 transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-500/20'
                      : 'border-purple-500/30 bg-purple-900/20 hover:border-purple-400/50'
                  }`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    boxShadow: isSelected
                      ? '0 0 30px rgba(6, 182, 212, 0.5)'
                      : 'none',
                  }}
                >
                  <div className="text-4xl mb-2">{interest.emoji}</div>
                  <div className="text-white text-sm">{interest.label}</div>

                  {/* Constellation Lines for Selected */}
                  {isSelected && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <svg
                        className="absolute inset-0 w-full h-full"
                        style={{ pointerEvents: 'none' }}
                      >
                        <motion.circle
                          cx="50%"
                          cy="50%"
                          r="3"
                          fill="cyan"
                          initial={{ scale: 0 }}
                          animate={{ scale: [1, 1.5, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Launch Button */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.button
              onClick={handleLaunch}
              disabled={selected.size === 0}
              className={`px-12 py-4 text-lg rounded-full ${
                selected.size > 0
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
              whileHover={selected.size > 0 ? { scale: 1.05 } : {}}
              whileTap={selected.size > 0 ? { scale: 0.95 } : {}}
              style={{
                boxShadow:
                  selected.size > 0
                    ? '0 0 30px rgba(168, 85, 247, 0.5)'
                    : 'none',
              }}
            >
              Launch My Orbit
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}