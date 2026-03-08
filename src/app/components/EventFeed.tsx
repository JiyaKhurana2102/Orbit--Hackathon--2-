import { Link, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Compass, Sparkles, Star, User, Calendar, MapPin, RefreshCw } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { getAllEvents, getSavedEventIds, saveEvent, unsaveEvent, supabase } from '../api/client';

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '🌌' },
  { id: 'tech-talks', label: 'Tech', emoji: '💻' },
  { id: 'networking', label: 'Network', emoji: '🤝' },
  { id: 'workshops', label: 'Workshops', emoji: '🎓' },
  { id: 'career-fairs', label: 'Career', emoji: '🧑‍💼' },
  { id: 'company-visits', label: 'Companies', emoji: '🏢' },
  { id: 'startups', label: 'Startups', emoji: '🚀' },
  { id: 'creative', label: 'Creative', emoji: '🎨' },
  { id: 'social', label: 'Social', emoji: '🌟' },
];

// Stable star positions generated once per session
const STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  left: ((i * 73 + 17) % 100),
  top: ((i * 47 + 31) % 100),
  size: ((i * 13 + 5) % 3) + 0.5,
  delay: ((i * 7) % 30) / 10,
  duration: 2.5 + ((i * 11) % 20) / 10,
}));

const CARD_GRADIENTS = [
  { border: 'border-violet-500/40', glow: 'rgba(139,92,246,0.3)', dot: '#a78bfa' },
  { border: 'border-cyan-500/40',   glow: 'rgba(6,182,212,0.3)',   dot: '#67e8f9' },
  { border: 'border-pink-500/40',   glow: 'rgba(236,72,153,0.3)',  dot: '#f9a8d4' },
  { border: 'border-amber-500/40',  glow: 'rgba(245,158,11,0.3)', dot: '#fcd34d' },
  { border: 'border-emerald-500/40',glow: 'rgba(16,185,129,0.3)', dot: '#6ee7b7' },
  { border: 'border-indigo-500/40', glow: 'rgba(99,102,241,0.3)', dot: '#a5b4fc' },
];

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function EventFeed() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savePending, setSavePending] = useState<Set<string>>(new Set());
  const [isGuest, setIsGuest] = useState(false);
  const hasFetched = useRef(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await getAllEvents();
      if (response.events && Array.isArray(response.events)) {
        setEvents(response.events);
      } else {
        console.error('Unexpected events response:', response);
        setEvents([]);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchEvents();
      // Load saved IDs from backend if authenticated
      supabase.auth.getSession().then(async ({ data }) => {
        if (!data.session) { setIsGuest(true); return; }
        try {
          const ids = await getSavedEventIds();
          setSavedIds(new Set(ids));
        } catch (err) {
          console.error('Could not load saved events:', err);
        }
      });
    }
  }, []);

  const toggleSave = async (event: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const eventId = event.id || '';
    const rawId = eventId.replace('event:', '');

    if (isGuest) {
      toast('Sign in to save events to your orbit ✨', {
        action: { label: 'Sign In', onClick: () => navigate('/welcome') },
      });
      return;
    }

    if (savePending.has(eventId)) return;

    setSavePending((prev) => new Set(prev).add(eventId));

    try {
      if (savedIds.has(eventId)) {
        await unsaveEvent(rawId);
        setSavedIds((prev) => { const next = new Set(prev); next.delete(eventId); return next; });
        toast('Removed from your orbit');
      } else {
        await saveEvent(rawId);
        setSavedIds((prev) => new Set(prev).add(eventId));
        toast.success('⭐ Saved to your orbit!');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error('Could not update. Please try again.');
    } finally {
      setSavePending((prev) => { const next = new Set(prev); next.delete(eventId); return next; });
    }
  };

  const filteredEvents = activeCategory === 'all'
    ? events
    : events.filter((ev) =>
        ev.category === activeCategory ||
        (ev.tags || []).includes(activeCategory.replace('-', '')),
      );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-purple-400/50 border-t-cyan-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
          <motion.p
            className="text-purple-300 text-lg"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Loading your orbit…
          </motion.p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 flex flex-col items-center justify-center px-6">
        <motion.div
          className="text-center max-w-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-6xl mb-6">🌌</div>
          <h2 className="text-2xl text-white mb-3">Your orbit is empty</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Events are loading from the UTD campus database.
          </p>
          <motion.button
            onClick={fetchEvents}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-full text-lg flex items-center gap-3 mx-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ boxShadow: '0 0 30px rgba(168,85,247,0.5)' }}
          >
            <RefreshCw size={20} />
            Retry
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 overflow-hidden flex flex-col">
      {/* Starfield */}
      <div className="absolute inset-0 pointer-events-none">
        {STARS.map((s) => (
          <motion.div
            key={s.id}
            className="absolute rounded-full bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: `${s.size}px`, height: `${s.size}px` }}
            animate={{ opacity: [0.15, 0.9, 0.15] }}
            transition={{ duration: s.duration, repeat: Infinity, delay: s.delay }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 px-5 pt-8 pb-3 flex items-center justify-between">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent leading-tight">
            Events in Your Orbit
          </h1>
          <p className="text-gray-400 text-sm mt-1">{filteredEvents.length} events upcoming</p>
        </motion.div>
        <motion.button
          onClick={fetchEvents}
          className="p-2 rounded-full bg-purple-900/40 border border-purple-500/30 text-gray-400 hover:text-cyan-400 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Refresh events"
        >
          <RefreshCw size={18} />
        </motion.button>
      </div>

      {/* Category Filter Tabs */}
      <div className="relative z-10 px-5 pb-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max pb-1">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <motion.button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${
                  isActive
                    ? 'bg-purple-600/60 border-purple-400/70 text-white'
                    : 'bg-purple-900/20 border-purple-500/20 text-gray-400 hover:border-purple-400/40'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Event Cards */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-24">
        <AnimatePresence mode="popLayout">
          {filteredEvents.length === 0 ? (
            <motion.div
              key="empty-category"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-48 text-center"
            >
              <p className="text-gray-400 text-lg">No events in this category yet</p>
              <button
                onClick={() => setActiveCategory('all')}
                className="mt-3 text-cyan-400 text-sm hover:underline"
              >
                View all events
              </button>
            </motion.div>
          ) : (
            <div className="space-y-4 max-w-2xl mx-auto pt-2">
              {filteredEvents.map((event, index) => {
                const style = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
                const isSaved = savedIds.has(event.id);
                const eventIdForNav = (event.id || '').replace('event:', '');

                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: Math.min(index * 0.06, 0.5), duration: 0.4 }}
                    onClick={() => navigate(`/event/${eventIdForNav}`)}
                    className="relative group cursor-pointer"
                  >
                    <motion.div
                      className={`relative p-5 rounded-2xl border ${style.border} backdrop-blur-sm overflow-hidden`}
                      style={{ background: 'rgba(10,5,30,0.6)' }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Hover glow */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"
                        style={{ background: `radial-gradient(circle at 30% 50%, ${style.glow}, transparent 70%)` }}
                      />

                      <div className="relative z-10">
                        {/* Top row: category badge + date */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex flex-wrap gap-1.5">
                            {(event.tags || []).slice(0, 2).map((tag: string) => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 rounded-full bg-purple-800/50 border border-purple-500/30 text-purple-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          {event.date && (
                            <span className="text-xs text-cyan-400/80 shrink-0 flex items-center gap-1">
                              <Calendar size={11} />
                              {formatDate(event.date)}
                            </span>
                          )}
                        </div>

                        {/* Event name */}
                        <h3 className="text-white text-lg leading-snug mb-1.5 pr-2">{event.name}</h3>

                        {/* Time */}
                        {event.time && (
                          <p className="text-cyan-300 text-sm mb-1">{event.time}</p>
                        )}

                        {/* Location */}
                        {event.location && (
                          <p className="text-purple-300 text-sm mb-1 flex items-center gap-1.5">
                            <MapPin size={13} className="shrink-0" />
                            {event.location}
                          </p>
                        )}

                        {/* Host */}
                        <p className="text-gray-500 text-xs mb-4">Hosted by {event.host}</p>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <motion.button
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm border transition-colors ${
                              savedIds.has(event.id)
                                ? 'bg-yellow-500/30 border-yellow-400/60 text-yellow-300'
                                : 'bg-purple-600/30 border-purple-400/40 text-purple-200 hover:bg-purple-600/50'
                            } ${savePending.has(event.id) ? 'opacity-60' : ''}`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => toggleSave(event, e)}
                            disabled={savePending.has(event.id)}
                          >
                            <Star size={14} fill={savedIds.has(event.id) ? 'currentColor' : 'none'} />
                            {savePending.has(event.id) ? '…' : savedIds.has(event.id) ? 'Saved' : 'Save'}
                          </motion.button>
                          <motion.button
                            className="px-4 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/40 rounded-full text-cyan-200 text-sm"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            View Details →
                          </motion.button>
                        </div>
                      </div>

                      {/* Orbiting dot */}
                      <motion.div
                        className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: style.dot, boxShadow: `0 0 8px ${style.dot}` }}
                        animate={{ rotate: 360, x: [0, 12, 0, -12, 0], y: [0, -12, 0, 12, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                      />
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <BottomNav currentPath="/feed" />
    </div>
  );
}

function BottomNav({ currentPath }: { currentPath: string }) {
  const navItems = [
    { path: '/feed',      icon: Home,     label: 'Home'    },
    { path: '/discover',  icon: Compass,  label: 'Discover'},
    { path: '/assistant', icon: Sparkles, label: 'AI'      },
    { path: '/profile',   icon: Star,     label: 'Saved'   },
    { path: '/profile',   icon: User,     label: 'Profile' },
  ];

  return (
    <div className="relative z-20 border-t border-purple-500/30 bg-gray-950/80 backdrop-blur-lg">
      <div className="flex justify-around items-center px-4 py-3">
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <Link
              key={item.path + item.label}
              to={item.path}
              className="flex flex-col items-center gap-0.5"
            >
              <motion.div
                className={`p-2 rounded-full ${isActive ? 'bg-purple-600/50' : ''}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <item.icon size={22} className={isActive ? 'text-cyan-400' : 'text-gray-500'} />
              </motion.div>
              <span className={`text-xs ${isActive ? 'text-cyan-400' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}