import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { signUp, signIn, supabase } from '../api/client';

// Stable starfield
const STARS = Array.from({ length: 150 }, (_, i) => ({
  id: i,
  x: ((i * 73 + 17) % 100),
  y: ((i * 47 + 31) % 100),
  size: ((i * 13 + 5) % 3) + 0.5,
  delay: ((i * 7) % 30) / 10,
  duration: 2.5 + ((i * 11) % 20) / 10,
}));

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  // If already signed in, skip to feed
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/feed');
      else setCheckingSession(false);
    });
  }, [navigate]);

  if (checkingSession) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 rounded-full border-2 border-purple-400/50 border-t-cyan-400"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 'signup') {
        if (!name.trim()) { setError('Please enter your name.'); setLoading(false); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return; }
        const res = await signUp(email, password, name);
        if (res.error) { setError(res.error); setLoading(false); return; }
        // Sign in automatically after signup
        const { error: signInErr } = await signIn(email, password);
        if (signInErr) { setError(signInErr.message); setLoading(false); return; }
        navigate('/interests');
      } else {
        const { error: signInErr } = await signIn(email, password);
        if (signInErr) { setError('Invalid email or password.'); setLoading(false); return; }
        navigate('/feed');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-950 via-gray-950 to-cyan-950 overflow-hidden">
      {/* Aurora */}
      <motion.div
        className="absolute inset-0 opacity-25 pointer-events-none"
        animate={{
          background: [
            'radial-gradient(ellipse at 20% 20%, rgba(168,85,247,0.4) 0%, transparent 60%)',
            'radial-gradient(ellipse at 80% 80%, rgba(6,182,212,0.4) 0%, transparent 60%)',
            'radial-gradient(ellipse at 50% 10%, rgba(236,72,153,0.3) 0%, transparent 60%)',
          ],
        }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      {/* Starfield */}
      <div className="absolute inset-0 pointer-events-none">
        {STARS.map((s) => (
          <motion.div
            key={s.id}
            className="absolute rounded-full bg-white"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px` }}
            animate={{ opacity: [0.15, 0.9, 0.15] }}
            transition={{ duration: s.duration, repeat: Infinity, delay: s.delay }}
          />
        ))}
      </div>

      {/* Shooting stars */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-0.5 h-0.5 bg-white rounded-full"
          style={{ top: `${15 + i * 20}%`, left: '-4px', boxShadow: '0 0 8px 2px rgba(255,255,255,0.6)' }}
          animate={{ x: ['0vw', '110vw'], y: [`0vh`, `${10 + i * 8}vh`], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.8, delay: i * 7, repeat: Infinity, repeatDelay: 12 }}
        />
      ))}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-5 py-8">
        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
        >
          <motion.h1
            className="text-7xl md:text-8xl bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent"
            style={{ fontWeight: 700 }}
            animate={{ textShadow: ['0 0 20px rgba(168,85,247,0.5)', '0 0 40px rgba(6,182,212,0.8)', '0 0 20px rgba(168,85,247,0.5)'] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            Orbit
          </motion.h1>
          <motion.p
            className="text-cyan-300 text-base md:text-lg italic tracking-wide mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Explore the universe of opportunities at UTD.
          </motion.p>
        </motion.div>

        {/* Auth card */}
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <div className="bg-gray-950/70 border border-purple-500/30 rounded-3xl p-7 backdrop-blur-md"
            style={{ boxShadow: '0 0 60px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)' }}>

            {/* Tabs */}
            <div className="flex bg-purple-900/30 rounded-2xl p-1 mb-6 border border-purple-500/20">
              {(['signin', 'signup'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); }}
                  className={`flex-1 py-2 text-sm rounded-xl transition-all duration-200 ${
                    tab === t
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {t === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {tab === 'signup' && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <input
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={tab === 'signup'}
                      className="w-full px-4 py-3 rounded-xl bg-purple-900/20 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400/70 focus:bg-purple-900/30 transition-colors text-sm"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                type="email"
                placeholder="UTD email (e.g. xyz@utdallas.edu)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-purple-900/20 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400/70 focus:bg-purple-900/30 transition-colors text-sm"
              />

              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-purple-900/20 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400/70 focus:bg-purple-900/30 transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    key="error"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-xs text-center px-2"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                whileHover={!loading ? { scale: 1.02 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                style={{ boxShadow: '0 0 20px rgba(168,85,247,0.35)' }}
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> {tab === 'signup' ? 'Creating account…' : 'Signing in…'}</>
                ) : (
                  tab === 'signup' ? 'Create Account' : 'Sign In'
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 border-t border-purple-500/20" />
              <span className="text-gray-600 text-xs">or</span>
              <div className="flex-1 border-t border-purple-500/20" />
            </div>

            {/* Guest */}
            <motion.button
              onClick={() => navigate('/interests')}
              className="w-full py-2.5 rounded-xl border border-purple-500/30 text-gray-400 text-sm hover:border-purple-400/50 hover:text-gray-200 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue as guest →
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
