import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Star, MapPin, Bell, BellOff, Calendar, LogIn, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getEventById,
  saveEvent,
  unsaveEvent,
  getSavedEventIds,
  setReminder,
  removeReminder,
  getReminderIds,
  supabase,
} from '../api/client';

// Stable starfield
const STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  left: ((i * 73 + 17) % 100),
  top: ((i * 47 + 31) % 100),
  size: ((i * 13 + 5) % 3) + 0.5,
  delay: ((i * 7) % 30) / 10,
  dur: 2.5 + ((i * 11) % 20) / 10,
}));

function formatFullDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent]         = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [isGuest, setIsGuest]     = useState(false);

  // Action states
  const [saved, setSaved]           = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [reminded, setReminded]     = useState(false);
  const [remindPending, setRemindPending] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!id) { setLoading(false); return; }

      try {
        // Fetch event
        const res = await getEventById(id);
        if (!res.event) { console.error('Event not found:', id); setLoading(false); return; }
        setEvent(res.event);

        // Check auth and load saved/reminder states in parallel
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setIsGuest(true);
        } else {
          const eventKey = `event:${id}`;
          const [savedIds, reminderIds] = await Promise.all([
            getSavedEventIds(),
            getReminderIds(),
          ]);
          setSaved(savedIds.includes(eventKey));
          setReminded(reminderIds.includes(eventKey));
        }
      } catch (err) {
        console.error('Error loading event details:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id]);

  const handleToggleSave = async () => {
    if (isGuest) {
      toast('Sign in to save events to your orbit ✨', {
        action: { label: 'Sign In', onClick: () => navigate('/welcome') },
      });
      return;
    }
    if (savePending || !event) return;
    setSavePending(true);
    try {
      const rawId = (event.id || '').replace('event:', '');
      if (saved) {
        await unsaveEvent(rawId);
        setSaved(false);
        toast('Removed from your orbit');
      } else {
        await saveEvent(rawId);
        setSaved(true);
        toast.success('⭐ Saved to your orbit!');
      }
    } catch (err: any) {
      console.error('Save toggle error:', err);
      toast.error('Could not update saved events. Please try again.');
    } finally {
      setSavePending(false);
    }
  };

  const handleToggleReminder = async () => {
    if (isGuest) {
      toast('Sign in to set event reminders 🔔', {
        action: { label: 'Sign In', onClick: () => navigate('/welcome') },
      });
      return;
    }
    if (remindPending || !event) return;
    setRemindPending(true);
    try {
      const rawId = (event.id || '').replace('event:', '');
      if (reminded) {
        await removeReminder(rawId);
        setReminded(false);
        toast('Reminder removed');
      } else {
        await setReminder(rawId);
        setReminded(true);
        const dateStr = event.date ? ` for ${formatFullDate(event.date)}` : '';
        toast.success(`🔔 Reminder set${dateStr}!`);
      }
    } catch (err: any) {
      console.error('Reminder toggle error:', err);
      toast.error('Could not update reminder. Please try again.');
    } finally {
      setRemindPending(false);
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 flex items-center justify-center">
        <motion.div
          className="w-14 h-14 rounded-full border-2 border-purple-400/50 border-t-cyan-400"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  // ─── Not found ────────────────────────────────────────────────────────────
  if (!event) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Event not found</p>
          <button onClick={() => navigate('/feed')} className="px-6 py-3 bg-purple-600 text-white rounded-full">
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  // ─── Main view ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 overflow-auto">
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

      <div className="relative z-10 min-h-full">
        {/* Back button */}
        <motion.button
          onClick={() => navigate(-1)}
          className="fixed top-5 left-5 z-20 p-3 bg-purple-900/60 hover:bg-purple-800/80 rounded-full backdrop-blur-sm border border-purple-500/30"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <ArrowLeft size={22} className="text-white" />
        </motion.button>

        {/* Guest sign-in banner */}
        <AnimatePresence>
          {isGuest && (
            <motion.div
              className="fixed top-5 right-5 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full bg-purple-900/70 border border-purple-400/40 backdrop-blur-sm text-sm text-purple-200 cursor-pointer"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => navigate('/welcome')}
              whileHover={{ scale: 1.03 }}
            >
              <LogIn size={15} />
              Sign in to save
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="pt-24 px-5 pb-16 max-w-2xl mx-auto"
        >
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-3xl p-7 md:p-9 backdrop-blur-sm">

            {/* Tags */}
            <motion.div
              className="flex flex-wrap gap-2 mb-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              {(event.tags || []).map((tag: string) => (
                <span key={tag} className="px-3 py-1 bg-cyan-600/25 border border-cyan-400/40 rounded-full text-cyan-200 text-xs">
                  {tag}
                </span>
              ))}
            </motion.div>

            {/* Title */}
            <motion.h1
              className="text-3xl md:text-4xl text-white mb-6 leading-tight"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {event.name}
            </motion.h1>

            {/* Date & Time */}
            <motion.div
              className="flex items-start gap-3 mb-4"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.28 }}
            >
              <Calendar size={18} className="text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-sm">{formatFullDate(event.date)}</p>
                {event.time && <p className="text-cyan-300 text-sm mt-0.5">{event.time}</p>}
              </div>
            </motion.div>

            {/* Location */}
            {event.location && (
              <motion.div
                className="flex items-start gap-3 mb-5"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.34 }}
              >
                <MapPin size={18} className="text-purple-400 mt-0.5 shrink-0" />
                <p className="text-white text-sm">{event.location}</p>
              </motion.div>
            )}

            {/* Host */}
            <motion.div
              className="mb-6 pb-6 border-b border-purple-500/20"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <p className="text-gray-500 text-xs mb-1">Hosted by</p>
              <p className="text-purple-300">{event.host}</p>
            </motion.div>

            {/* Description */}
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.46 }}
            >
              <h2 className="text-lg text-white mb-2">About this event</h2>
              <p className="text-gray-300 leading-relaxed text-sm">{event.description}</p>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-3"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.54 }}
            >
              {/* Save / Unsave */}
              <motion.button
                onClick={handleToggleSave}
                disabled={savePending}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-full text-white text-sm font-medium transition-all ${
                  saved
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                    : 'bg-gradient-to-r from-purple-600 to-cyan-600'
                } disabled:opacity-60`}
                whileHover={{ scale: savePending ? 1 : 1.02 }}
                whileTap={{ scale: savePending ? 1 : 0.97 }}
                style={{ boxShadow: saved ? '0 0 25px rgba(245,158,11,0.4)' : '0 0 25px rgba(139,92,246,0.4)' }}
              >
                {saved ? (
                  <><CheckCircle size={18} /> Saved to Orbit</>
                ) : (
                  <><Star size={18} fill="none" /> {savePending ? 'Saving…' : 'Save Event'}</>
                )}
              </motion.button>

              {/* Reminder */}
              <motion.button
                onClick={handleToggleReminder}
                disabled={remindPending}
                className={`flex items-center justify-center gap-2 px-6 py-4 rounded-full text-sm font-medium transition-all border disabled:opacity-60 ${
                  reminded
                    ? 'bg-cyan-600/30 border-cyan-400/60 text-cyan-200'
                    : 'bg-purple-900/50 hover:bg-purple-800/70 border-purple-500/30 text-white'
                }`}
                whileHover={{ scale: remindPending ? 1 : 1.02 }}
                whileTap={{ scale: remindPending ? 1 : 0.97 }}
              >
                {reminded ? (
                  <><BellOff size={18} /> {remindPending ? '…' : 'Reminder Set'}</>
                ) : (
                  <><Bell size={18} /> {remindPending ? '…' : 'Set Reminder'}</>
                )}
              </motion.button>

              {/* View Map */}
              <motion.button
                className="flex items-center justify-center gap-2 px-6 py-4 bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-500/30 rounded-full text-white text-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const q = encodeURIComponent(`${event.location}, UT Dallas, Richardson TX`);
                  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
                }}
              >
                <MapPin size={18} />
                View Map
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
