import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Home, Compass, Sparkles, Star, User, Settings, Bell, LogOut, LogIn, Calendar, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getProfile, getSavedEvents, signOut, supabase } from '../api/client';

// Stable starfield
const STARS = Array.from({ length: 90 }, (_, i) => ({
  id: i,
  left: ((i * 73 + 17) % 100),
  top: ((i * 47 + 31) % 100),
  size: ((i * 13 + 5) % 3) + 0.5,
  delay: ((i * 7) % 30) / 10,
  dur: 2.5 + ((i * 11) % 20) / 10,
}));

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [savedEvents, setSavedEvents] = useState<any[]>([]);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setIsGuest(true);
        setLoading(false);
        return;
      }
      // Authenticated — load profile + saved events in parallel
      const [profileRes, savedRes] = await Promise.all([
        getProfile().catch((err) => { console.error('getProfile error:', err); return { profile: null }; }),
        getSavedEvents().catch((err) => { console.error('getSavedEvents error:', err); return { events: [] }; }),
      ]);
      setProfile(profileRes.profile);
      setSavedEvents(savedRes.events || []);
    } catch (err) {
      console.error('Profile load error:', err);
      setIsGuest(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refresh saved events when user returns to this tab/window
  useEffect(() => {
    const onFocus = async () => {
      if (isGuest || loading) return;
      setRefreshing(true);
      try {
        const savedRes = await getSavedEvents();
        setSavedEvents(savedRes.events || []);
      } catch (err) {
        console.error('Refresh saved events error:', err);
      } finally {
        setRefreshing(false);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isGuest, loading]);

  const handleLogout = async () => {
    await signOut();
    navigate('/welcome');
  };

  if (loading) {
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

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 overflow-hidden flex flex-col">
      {/* Starfield */}
      <div className="absolute inset-0 pointer-events-none">
        {STARS.map((s) => (
          <motion.div
            key={s.id}
            className="absolute rounded-full bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: `${s.size}px`, height: `${s.size}px` }}
            animate={{ opacity: [0.1, 0.8, 0.1] }}
            transition={{ duration: s.dur, repeat: Infinity, delay: s.delay }}
          />
        ))}
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-28">
        <div className="max-w-xl mx-auto">

          {/* Header */}
          <motion.div
            className="text-center py-10 pb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div
              className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center"
              animate={{ boxShadow: ['0 0 20px rgba(168,85,247,0.5)', '0 0 40px rgba(6,182,212,0.8)', '0 0 20px rgba(168,85,247,0.5)'] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <User size={44} className="text-white" />
            </motion.div>

            {isGuest ? (
              <>
                <h1 className="text-2xl text-white mb-1">Guest Comet</h1>
                <p className="text-gray-400 text-sm mb-5">Sign in to save events &amp; personalize your orbit</p>
                <motion.button
                  onClick={() => navigate('/welcome')}
                  className="flex items-center gap-2 mx-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-full text-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}
                >
                  <LogIn size={16} />
                  Sign In / Create Account
                </motion.button>
              </>
            ) : (
              <>
                <h1 className="text-2xl text-white mb-1">{profile?.name || 'Comet Explorer'}</h1>
                <p className="text-cyan-300 text-sm">{profile?.email || ''}</p>
              </>
            )}
          </motion.div>

          {/* Saved Events */}
          {!isGuest && (
            <motion.section
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-lg text-white mb-3 flex items-center gap-2">
                <Star size={18} className="text-yellow-400" />
                Saved Events
                {refreshing && (
                  <span className="ml-1 w-3 h-3 rounded-full border border-purple-400/50 border-t-cyan-400 animate-spin inline-block" />
                )}
              </h2>

              {savedEvents.length === 0 ? (
                <div className="text-center py-8 rounded-2xl border border-purple-500/20 bg-purple-900/10">
                  <div className="text-3xl mb-2">🌌</div>
                  <p className="text-gray-400 text-sm">No saved events yet.</p>
                  <button
                    onClick={() => navigate('/feed')}
                    className="mt-2 text-cyan-400 text-sm hover:underline"
                  >
                    Browse events →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedEvents.map((event, i) => (
                    <motion.div
                      key={event.id || i}
                      className="p-4 rounded-2xl border border-purple-500/25 bg-purple-900/15 backdrop-blur-sm cursor-pointer"
                      whileHover={{ scale: 1.02, y: -1 }}
                      onClick={() => navigate(`/event/${(event.id || '').replace('event:', '')}`)}
                    >
                      <h3 className="text-white text-sm font-medium mb-1">{event.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {event.date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={11} className="text-cyan-400" />
                            {event.date}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin size={11} className="text-purple-400" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {/* Interests */}
          {!isGuest && profile?.interests?.length > 0 && (
            <motion.section
              className="mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-lg text-white mb-3 flex items-center gap-2">
                <Sparkles size={18} className="text-purple-400" />
                My Interests
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest: string, i: number) => (
                  <motion.span
                    key={interest}
                    className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-400/40 rounded-full text-cyan-200 text-xs"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                  >
                    {interest}
                  </motion.span>
                ))}
              </div>
            </motion.section>
          )}

          {/* Settings */}
          <motion.section
            className="space-y-3 pb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-lg text-white mb-3 flex items-center gap-2">
              <Settings size={18} className="text-gray-400" />
              Settings
            </h2>

            <motion.button
              className="w-full flex items-center gap-4 p-4 bg-purple-900/20 border border-purple-500/25 rounded-2xl text-white hover:bg-purple-900/40 transition-colors"
              whileHover={{ scale: 1.01 }}
            >
              <Bell size={20} className="text-purple-400 shrink-0" />
              <div className="text-left flex-1">
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-gray-400">Manage event alerts</p>
              </div>
            </motion.button>

            <motion.button
              className="w-full flex items-center gap-4 p-4 bg-purple-900/20 border border-purple-500/25 rounded-2xl text-white hover:bg-purple-900/40 transition-colors"
              whileHover={{ scale: 1.01 }}
              onClick={() => navigate('/interests')}
            >
              <Sparkles size={20} className="text-purple-400 shrink-0" />
              <div className="text-left flex-1">
                <p className="text-sm font-medium">Update Interests</p>
                <p className="text-xs text-gray-400">Customize your orbit</p>
              </div>
            </motion.button>

            {!isGuest && (
              <motion.button
                className="w-full flex items-center gap-4 p-4 bg-red-900/15 border border-red-500/25 rounded-2xl text-white hover:bg-red-900/30 transition-colors"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
              >
                <LogOut size={20} className="text-red-400 shrink-0" />
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">Sign Out</p>
                  <p className="text-xs text-gray-400">See you in another orbit</p>
                </div>
              </motion.button>
            )}
          </motion.section>
        </div>
      </div>

      <BottomNav currentPath="/profile" />
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
            <Link key={item.path + item.label} to={item.path} className="flex flex-col items-center gap-0.5">
              <motion.div
                className={`p-2 rounded-full ${isActive ? 'bg-purple-600/50' : ''}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <item.icon size={22} className={isActive ? 'text-cyan-400' : 'text-gray-500'} />
              </motion.div>
              <span className={`text-xs ${isActive ? 'text-cyan-400' : 'text-gray-500'}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}