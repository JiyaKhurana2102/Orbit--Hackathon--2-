import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Compass, Sparkles, Star, User, X, ExternalLink, Users, Map, Globe } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getAllClubs, getAllEvents } from '../api/client';

// ─── UTD Building coordinates ──────────────────────────────────────────────────
const UTD_BUILDINGS: Record<string, { lat: number; lng: number; label: string; color: string }> = {
  'ECSN': { lat: 32.9882, lng: -96.7492, label: 'ECS North',       color: '#67e8f9' },
  'ECSS': { lat: 32.9875, lng: -96.7485, label: 'ECS South',       color: '#67e8f9' },
  'JSOM': { lat: 32.9898, lng: -96.7463, label: 'JSOM',            color: '#fcd34d' },
  'SLC':  { lat: 32.9876, lng: -96.7468, label: 'Student Learning', color: '#86efac' },
  'SPN':  { lat: 32.9869, lng: -96.7479, label: 'Spellman Center',  color: '#f9a8d4' },
  'Student Union': { lat: 32.9872, lng: -96.7467, label: 'Student Union', color: '#a78bfa' },
  'Union': { lat: 32.9872, lng: -96.7467, label: 'Student Union',  color: '#a78bfa' },
  'ATC':  { lat: 32.9858, lng: -96.7471, label: 'Activity Center', color: '#fb923c' },
  'Activity Center': { lat: 32.9858, lng: -96.7471, label: 'Activity Center', color: '#fb923c' },
  'FO':   { lat: 32.9869, lng: -96.7460, label: 'Founders Building',color: '#c4b5fd' },
  'GR':   { lat: 32.9893, lng: -96.7480, label: 'Green Hall',      color: '#6ee7b7' },
  'ATEC': { lat: 32.9861, lng: -96.7496, label: 'ATEC',            color: '#f472b6' },
  'CB':   { lat: 32.9888, lng: -96.7474, label: 'Classroom Building',color: '#93c5fd' },
  'GC':   { lat: 32.9865, lng: -96.7463, label: 'Galaxy Café',     color: '#fde68a' },
};

const UTD_CENTER: [number, number] = [32.9876, -96.7477];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getBuildingForEvent(location: string): { key: string; data: typeof UTD_BUILDINGS[string] } | null {
  if (!location) return null;
  for (const [key, data] of Object.entries(UTD_BUILDINGS)) {
    if (location.toUpperCase().includes(key.toUpperCase()) ||
        location.toLowerCase().includes(data.label.toLowerCase())) {
      return { key, data };
    }
  }
  // Fuzzy match common phrases
  if (location.toLowerCase().includes('union')) return { key: 'Union', data: UTD_BUILDINGS['Union'] };
  if (location.toLowerCase().includes('activity')) return { key: 'ATC', data: UTD_BUILDINGS['ATC'] };
  return null;
}

function groupEventsByBuilding(events: any[]) {
  const groups: Record<string, { building: typeof UTD_BUILDINGS[string]; events: any[] }> = {};
  for (const ev of events) {
    const match = getBuildingForEvent(ev.location || '');
    if (!match) continue;
    const key = match.key;
    if (!groups[key]) groups[key] = { building: match.data, events: [] };
    groups[key].events.push(ev);
  }
  return groups;
}

function formatShortDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Auto-fit map to markers
function MapFitter({ groups }: { groups: Record<string, any> }) {
  const map = useMap();
  useEffect(() => {
    const keys = Object.keys(groups);
    if (keys.length === 0) {
      map.setView(UTD_CENTER, 16);
      return;
    }
    const lats = keys.map((k) => groups[k].building.lat);
    const lngs = keys.map((k) => groups[k].building.lng);
    const bounds = L.latLngBounds(
      [Math.min(...lats) - 0.001, Math.min(...lngs) - 0.001],
      [Math.max(...lats) + 0.001, Math.max(...lngs) + 0.001],
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [groups, map]);
  return null;
}

// ─── Galaxy view helpers ───────────────────────────────────────────────────────
const getStarPosition = (index: number, total: number) => {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const rings = [0.22, 0.38, 0.5];
  const ring = rings[index % rings.length];
  const jitter = ((index * 37) % 13) / 100 - 0.065;
  return {
    x: 50 + (ring + jitter) * 80 * Math.cos(angle + (index % 3) * 0.4),
    y: 50 + (ring + jitter) * 65 * Math.sin(angle + (index % 3) * 0.4),
  };
};

const TAG_COLORS: Record<string, { gradient: string; glow: string }> = {
  'Tech & Computing':   { gradient: 'from-blue-400 to-cyan-500',    glow: 'rgba(6,182,212,0.6)' },
  'Engineering':        { gradient: 'from-indigo-400 to-blue-500',  glow: 'rgba(99,102,241,0.6)' },
  'Art and Music':      { gradient: 'from-pink-400 to-rose-500',    glow: 'rgba(236,72,153,0.6)' },
  'Cultural':           { gradient: 'from-amber-400 to-orange-500', glow: 'rgba(245,158,11,0.6)' },
  'Healthcare/Medical': { gradient: 'from-emerald-400 to-green-500',glow: 'rgba(16,185,129,0.6)' },
  'Academic Interests': { gradient: 'from-purple-400 to-violet-500',glow: 'rgba(139,92,246,0.6)' },
  'Service':            { gradient: 'from-teal-400 to-cyan-500',    glow: 'rgba(20,184,166,0.6)' },
  'Sports':             { gradient: 'from-orange-400 to-red-500',   glow: 'rgba(239,68,68,0.6)' },
  'Recreation':         { gradient: 'from-lime-400 to-green-500',   glow: 'rgba(132,204,22,0.6)' },
  'Social':             { gradient: 'from-violet-400 to-purple-500',glow: 'rgba(167,139,250,0.6)' },
  'default':            { gradient: 'from-gray-400 to-slate-500',   glow: 'rgba(148,163,184,0.5)' },
};

const getClubColor = (tags: string[]) => {
  for (const tag of (tags || [])) if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  return TAG_COLORS['default'];
};
const getClubSize = (tags: string[]) => {
  if (tags.includes('Tech & Computing') || tags.includes('Academic Interests')) return 52;
  if (tags.includes('Engineering') || tags.includes('Healthcare/Medical')) return 46;
  return 38;
};

const BG_STARS = Array.from({ length: 180 }, (_, i) => ({
  id: i, left: ((i * 61 + 23) % 100), top: ((i * 43 + 17) % 100),
  size: ((i * 11) % 3) + 0.5, delay: ((i * 9) % 30) / 10, dur: 2.5 + ((i * 13) % 20) / 10,
}));

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📷', discord: '💬', email: '✉️', website: '🌐',
  linkedIn: '💼', youtube: '▶️', other: '🔗',
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function DiscoverMap() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [view, setView] = useState<'galaxy' | 'map'>('galaxy');

  useEffect(() => {
    const load = async () => {
      try {
        const [clubRes, eventRes] = await Promise.all([getAllClubs(), getAllEvents()]);
        setClubs(clubRes.clubs || []);
        setEvents(eventRes.events || []);
      } catch (err) {
        console.error('DiscoverMap load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const tagFilters = [
    { id: 'all', label: 'All' }, { id: 'Tech & Computing', label: 'Tech' },
    { id: 'Engineering', label: 'Engineering' }, { id: 'Art and Music', label: 'Arts' },
    { id: 'Healthcare/Medical', label: 'Health' }, { id: 'Academic Interests', label: 'Academic' },
    { id: 'Service', label: 'Service' }, { id: 'Sports', label: 'Sports' },
    { id: 'Social', label: 'Social' },
  ];

  const visibleClubs = activeFilter === 'all' ? clubs : clubs.filter((c) => (c.tags || []).includes(activeFilter));

  const getClubEvents = (clubName: string) =>
    events.filter((ev) => (ev.host || '').toLowerCase().includes(clubName.toLowerCase().split(' ')[0])).slice(0, 3);

  const buildingGroups = groupEventsByBuilding(events);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-purple-950 to-gray-950 overflow-hidden flex flex-col">
      {/* Background stars (galaxy view only) */}
      {view === 'galaxy' && (
        <div className="absolute inset-0 pointer-events-none">
          {BG_STARS.map((s) => (
            <motion.div
              key={s.id}
              className="absolute rounded-full bg-white"
              style={{ left: `${s.left}%`, top: `${s.top}%`, width: `${s.size}px`, height: `${s.size}px` }}
              animate={{ opacity: [0.15, 0.85, 0.15] }}
              transition={{ duration: s.dur, repeat: Infinity, delay: s.delay }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 px-5 pt-8 pb-2 flex items-start justify-between">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            {view === 'galaxy' ? 'Galaxy of Clubs' : 'Campus Event Map'}
          </h1>
          <p className="text-cyan-300/70 text-sm mt-0.5">
            {loading ? 'Loading…' : view === 'galaxy'
              ? `${visibleClubs.length} clubs in orbit`
              : `${Object.keys(buildingGroups).length} active buildings · ${events.length} events`}
          </p>
        </motion.div>

        {/* View toggle */}
        <motion.div
          className="flex items-center bg-purple-900/40 border border-purple-500/30 rounded-full p-1 gap-1"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <motion.button
            onClick={() => { setView('galaxy'); setSelectedClub(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
              view === 'galaxy' ? 'bg-purple-600/80 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <Globe size={13} /> Clubs
          </motion.button>
          <motion.button
            onClick={() => setView('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
              view === 'map' ? 'bg-cyan-600/80 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <Map size={13} /> Map
          </motion.button>
        </motion.div>
      </div>

      {/* Filter tabs — galaxy only */}
      {view === 'galaxy' && (
        <div className="relative z-10 px-5 pb-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max pb-1">
            {tagFilters.map((f) => (
              <motion.button
                key={f.id}
                onClick={() => { setActiveFilter(f.id); setSelectedClub(null); }}
                className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${
                  activeFilter === f.id
                    ? 'bg-purple-600/60 border-purple-400/70 text-white'
                    : 'bg-purple-900/20 border-purple-500/20 text-gray-400 hover:border-purple-400/40'
                }`}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              >
                {f.label}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.div
              className="w-12 h-12 rounded-full border-2 border-purple-400/50 border-t-cyan-400"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : view === 'galaxy' ? (
          // ── Galaxy view ───────────────────────────────────────────────────────
          <div className="relative w-full h-full">
            {/* Constellation lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {visibleClubs.slice(0, 20).map((_, i) => {
                if (i === 0) return null;
                const from = getStarPosition(i - 1, Math.min(visibleClubs.length, 20));
                const to   = getStarPosition(i,     Math.min(visibleClubs.length, 20));
                return (
                  <motion.line
                    key={`line-${i}`}
                    x1={`${from.x}%`} y1={`${from.y}%`} x2={`${to.x}%`} y2={`${to.y}%`}
                    stroke="rgba(139,92,246,0.2)" strokeWidth="0.5"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: i * 0.05, duration: 0.8 }}
                  />
                );
              })}
            </svg>

            {/* Club stars */}
            {visibleClubs.slice(0, 24).map((club, index) => {
              const pos = getStarPosition(index, Math.min(visibleClubs.length, 24));
              const color = getClubColor(club.tags || []);
              const size  = getClubSize(club.tags || []);
              const isSelected = selectedClub?.id === club.id;
              return (
                <motion.div
                  key={club.id}
                  className="absolute cursor-pointer"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${size}px`, height: `${size}px`, transform: 'translate(-50%,-50%)', zIndex: isSelected ? 30 : 10 }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: selectedClub && !isSelected ? 0.4 : 1, scale: isSelected ? 1.4 : 1 }}
                  transition={{ delay: index * 0.04, duration: 0.5 }}
                  onClick={() => setSelectedClub(isSelected ? null : club)}
                  whileHover={{ scale: isSelected ? 1.5 : 1.25 }}
                >
                  <motion.div className={`absolute inset-0 rounded-full bg-gradient-to-br ${color.gradient} blur-lg`}
                    animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.3, 1] }}
                    transition={{ duration: 2.5 + (index % 3) * 0.5, repeat: Infinity }}
                  />
                  <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${color.gradient}`}
                    style={{ boxShadow: `0 0 ${isSelected ? 20 : 10}px ${color.glow}` }}
                  />
                  {club.profile_image ? (
                    <img src={club.profile_image} alt={club.name} className="absolute inset-0 w-full h-full rounded-full object-cover opacity-80"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-white font-bold rounded-full"
                      style={{ fontSize: `${Math.max(8, size / 5)}px` }}>
                      {club.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <motion.div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap pointer-events-none"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.04 + 0.3 }}
                  >
                    <span className="text-white bg-gray-950/70 px-1.5 py-0.5 rounded text-[10px] backdrop-blur-sm">
                      {club.name.length > 20 ? club.name.slice(0, 18) + '…' : club.name}
                    </span>
                  </motion.div>
                </motion.div>
              );
            })}

            {/* Club detail panel */}
            <AnimatePresence>
              {selectedClub && (
                <motion.div
                  className="absolute inset-x-0 bottom-0 bg-gray-950/95 backdrop-blur-lg border-t border-purple-500/30 max-h-[55%] overflow-y-auto"
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  <div className="p-5 max-w-2xl mx-auto">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        {selectedClub.profile_image && (
                          <img src={selectedClub.profile_image} alt={selectedClub.name}
                            className="w-12 h-12 rounded-full object-cover border border-purple-500/40"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div>
                          <h3 className="text-white text-lg leading-tight">{selectedClub.name}</h3>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(selectedClub.tags || []).slice(0, 3).map((tag: string) => (
                              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-800/50 border border-purple-500/30 text-purple-300">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setSelectedClub(null)}
                        className="p-2 rounded-full bg-gray-800/60 hover:bg-gray-700/60 text-gray-400">
                        <X size={18} />
                      </button>
                    </div>

                    {(selectedClub.officers || []).length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-purple-300 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Users size={12} /> Officers
                        </h4>
                        <div className="grid grid-cols-2 gap-1.5">
                          {selectedClub.officers.slice(0, 4).map((o: any, i: number) => (
                            <div key={i} className="text-xs bg-purple-900/20 border border-purple-500/20 rounded-lg px-2.5 py-1.5">
                              <p className="text-white">{o.name}</p><p className="text-gray-500">{o.position}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(selectedClub.contacts || []).length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-purple-300 text-xs uppercase tracking-wider mb-2">Connect</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedClub.contacts.map((c: any, i: number) => (
                            <a key={i} href={c.url.startsWith('http') ? c.url : `mailto:${c.url}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-cyan-900/30 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/50 transition-colors"
                              onClick={(e) => e.stopPropagation()}>
                              <span>{PLATFORM_ICONS[c.platform] || '🔗'}</span>
                              <span className="capitalize">{c.platform}</span>
                              <ExternalLink size={10} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const clubEvents = getClubEvents(selectedClub.name);
                      return clubEvents.length > 0 ? (
                        <div>
                          <h4 className="text-purple-300 text-xs uppercase tracking-wider mb-2">Upcoming Events</h4>
                          <div className="space-y-2">
                            {clubEvents.map((ev: any) => (
                              <motion.div key={ev.id}
                                className="p-3 bg-purple-900/20 border border-purple-500/20 rounded-xl cursor-pointer hover:bg-purple-900/40 transition-colors"
                                whileHover={{ x: 4 }}
                                onClick={() => navigate(`/event/${(ev.id || '').replace('event:', '')}`)}>
                                <p className="text-white text-sm">{ev.name}</p>
                                <p className="text-cyan-300 text-xs mt-0.5">{ev.date} · {ev.time}</p>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          // ── Campus Map view ───────────────────────────────────────────────────
          <CampusMapView buildingGroups={buildingGroups} events={events} navigate={navigate} />
        )}
      </div>

      <BottomNav currentPath="/discover" />
    </div>
  );
}

// ─── Campus Map sub-component ──────────────────────────────────────────────────
function CampusMapView({
  buildingGroups,
  events,
  navigate,
}: {
  buildingGroups: Record<string, { building: typeof UTD_BUILDINGS[string]; events: any[] }>;
  events: any[];
  navigate: (path: string) => void;
}) {
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = [
    { id: 'all',          label: 'All',        emoji: '🌌' },
    { id: 'tech-talks',   label: 'Tech',       emoji: '💻' },
    { id: 'workshops',    label: 'Workshops',  emoji: '🎓' },
    { id: 'networking',   label: 'Networking', emoji: '🤝' },
    { id: 'career-fairs', label: 'Career',     emoji: '🧑‍💼' },
    { id: 'social',       label: 'Social',     emoji: '🌟' },
  ];

  // Filter events by category then regroup
  const filteredEvents = categoryFilter === 'all' ? events : events.filter((ev) =>
    ev.category === categoryFilter || (ev.tags || []).includes(categoryFilter.replace('-', ''))
  );
  const filteredGroups = groupEventsByBuilding(filteredEvents);

  const selectedData = selectedBuilding ? filteredGroups[selectedBuilding] : null;

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Category filter */}
      <div className="absolute top-2 left-2 right-2 z-[1000] flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {categories.map((cat) => (
          <motion.button
            key={cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap border backdrop-blur-md transition-colors shrink-0 ${
              categoryFilter === cat.id
                ? 'bg-purple-600/80 border-purple-400/70 text-white'
                : 'bg-gray-950/70 border-purple-500/25 text-gray-400 hover:border-purple-400/40'
            }`}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          >
            <span>{cat.emoji}</span><span>{cat.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Leaflet map */}
      <MapContainer
        center={UTD_CENTER}
        zoom={16}
        className="w-full h-full"
        zoomControl={true}
        style={{ background: '#050510' }}
      >
        {/* Dark CartoDB tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        <MapFitter groups={filteredGroups} />

        {/* Building markers */}
        {Object.entries(filteredGroups).map(([key, { building, events: bEvents }]) => {
          const isSelected = selectedBuilding === key;
          const count = bEvents.length;
          const radius = Math.max(14, Math.min(28, 12 + count * 2));

          return (
            <CircleMarker
              key={key}
              center={[building.lat, building.lng]}
              radius={radius}
              pathOptions={{
                color: isSelected ? '#ffffff' : building.color,
                fillColor: building.color,
                fillOpacity: isSelected ? 0.9 : 0.5,
                weight: isSelected ? 3 : 1.5,
              }}
              eventHandlers={{
                click: () => setSelectedBuilding(isSelected ? null : key),
              }}
            >
              <Popup>
                <div className="min-w-[220px] max-w-[280px]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: building.color, boxShadow: `0 0 8px ${building.color}` }} />
                    <h3 className="text-white font-semibold text-sm">{building.label}</h3>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-800/60 text-purple-300">{count} event{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {bEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2 rounded-xl bg-purple-900/30 border border-purple-500/25 cursor-pointer hover:bg-purple-900/60 transition-colors"
                        onClick={() => navigate(`/event/${(ev.id || '').replace('event:', '')}`)}
                      >
                        <p className="text-white text-xs font-medium leading-snug">{ev.name}</p>
                        <p className="text-cyan-400 text-xs mt-1">{formatShortDate(ev.date)} · {ev.time}</p>
                        {ev.location && <p className="text-gray-500 text-xs mt-0.5 truncate">{ev.location}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-3 z-[1000]">
        <div className="bg-gray-950/90 border border-purple-500/30 rounded-2xl p-3 backdrop-blur-md max-w-[160px]">
          <p className="text-purple-300 text-xs uppercase tracking-wider mb-2">Buildings</p>
          {Object.keys(filteredGroups).length === 0 ? (
            <p className="text-gray-500 text-xs">No events match this filter</p>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(filteredGroups).slice(0, 6).map(([key, { building, events: bEvents }]) => (
                <div key={key} className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedBuilding(selectedBuilding === key ? null : key)}>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: building.color, boxShadow: `0 0 6px ${building.color}` }} />
                  <span className="text-gray-300 text-xs truncate">{building.label}</span>
                  <span className="ml-auto text-xs text-purple-400 shrink-0">{bEvents.length}</span>
                </div>
              ))}
              {Object.keys(filteredGroups).length > 6 && (
                <p className="text-gray-600 text-xs">+{Object.keys(filteredGroups).length - 6} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bottom nav ────────────────────────────────────────────────────────────────
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
              <motion.div className={`p-2 rounded-full ${isActive ? 'bg-purple-600/50' : ''}`}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
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
