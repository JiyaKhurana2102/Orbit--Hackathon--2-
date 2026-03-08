import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Home, Compass, Sparkles, Star, User, Send } from 'lucide-react';
import { sendAIMessage } from '../api/client';

const promptExamples = [
  'What events can help me get internships?',
  'Are there any networking events this week?',
  'What companies are visiting campus?',
  'Show me AI/ML workshops',
];

export default function AIAssistant() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ type: 'user' | 'ai'; content: string; events?: any[] }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setMessages((prev) => [...prev, { type: 'user', content: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendAIMessage(userMessage);
      
      setMessages((prev) => [
        ...prev, 
        { 
          type: 'ai', 
          content: response.response, 
          events: response.events 
        }
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev, 
        { 
          type: 'ai', 
          content: 'Sorry, I encountered an error. Please try again.' 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 overflow-hidden flex flex-col">
      {/* Starfield Background */}
      <div className="absolute inset-0">
        {Array.from({ length: 100 }).map((_, i) => (
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

      {/* Header */}
      <div className="relative z-10 px-6 pt-8 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl md:text-4xl bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            AI Orbit Guide
          </h1>
          <p className="text-cyan-300 text-sm mt-2">Your personal event discovery assistant</p>
        </motion.div>
      </div>

      {/* Chat Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Sparkles size={64} className="text-purple-400 mx-auto mb-4" />
              <h2 className="text-2xl text-white mb-2">How can I help you today?</h2>
              <p className="text-gray-400">Ask me about events, internships, or companies</p>
            </motion.div>

            {/* Prompt Examples */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
              {promptExamples.map((example, index) => (
                <motion.button
                  key={example}
                  onClick={() => handleExampleClick(example)}
                  className="p-4 bg-purple-900/30 border border-purple-500/30 rounded-xl text-left text-white hover:bg-purple-900/50 transition-colors"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                >
                  {example}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    message.type === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
                      : 'bg-purple-900/30 border border-purple-500/30 text-white'
                  }`}
                >
                  <p>{message.content}</p>

                  {/* Event Constellation Layout */}
                  {message.events && message.events.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {message.events.map((event) => (
                        <motion.div
                          key={event.id}
                          className="p-3 bg-purple-800/30 border border-cyan-400/30 rounded-xl hover:bg-purple-800/50 transition-colors cursor-pointer"
                          whileHover={{ scale: 1.02, x: 5 }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h3 className="text-white font-medium">{event.name}</h3>
                              <p className="text-cyan-300 text-sm">{event.host}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Star size={14} className="text-yellow-400" />
                              <span className="text-xs text-yellow-400">{event.relevance}%</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="p-4 bg-purple-900/30 border border-purple-500/30 rounded-2xl">
                  <div className="flex gap-2">
                    <motion.div
                      className="w-2 h-2 bg-purple-400 rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-purple-400 rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-purple-400 rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="relative z-10 px-6 pb-6">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything about events..."
            className="flex-1 px-6 py-4 bg-purple-900/30 border border-purple-500/30 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-purple-400/50 backdrop-blur-sm"
          />
          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`p-4 rounded-full ${
              input.trim() && !isLoading
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600'
                : 'bg-gray-700'
            }`}
            whileHover={input.trim() && !isLoading ? { scale: 1.05 } : {}}
            whileTap={input.trim() && !isLoading ? { scale: 0.95 } : {}}
          >
            <Send size={24} className="text-white" />
          </motion.button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav currentPath="/assistant" />
    </div>
  );
}

function BottomNav({ currentPath }: { currentPath: string }) {
  const navItems = [
    { path: '/feed', icon: Home, label: 'Home' },
    { path: '/discover', icon: Compass, label: 'Discover' },
    { path: '/assistant', icon: Sparkles, label: 'AI' },
    { path: '/profile', icon: Star, label: 'Saved' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="relative z-20 border-t border-purple-500/30 bg-gray-950/80 backdrop-blur-lg">
      <div className="flex justify-around items-center px-6 py-3">
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <Link
              key={item.path + item.label}
              to={item.path}
              className="flex flex-col items-center gap-1"
            >
              <motion.div
                className={`p-2 rounded-full ${
                  isActive ? 'bg-purple-600/50' : ''
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <item.icon
                  size={24}
                  className={isActive ? 'text-cyan-400' : 'text-gray-400'}
                />
              </motion.div>
              <span
                className={`text-xs ${
                  isActive ? 'text-cyan-400' : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}