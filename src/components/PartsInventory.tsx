import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, Search, Plus, X, Package, MapPin, Hash, ChevronRight, ChevronDown, Camera, Upload, Loader2, ExternalLink } from 'lucide-react';
import Fuse from 'fuse.js';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { toast, Toaster } from 'sonner';
import { useIsMobile } from './ui/use-mobile';

// ── InvenTree API config ──────────────────────────────────────────────
const API_BASE = 'https://inv.andrew.net/api';
const API_HEADERS: HeadersInit = {
  'Authorization': 'Basic YWRtaW46YzEzOWludmVudHJlZQ==',
  'Content-Type': 'application/json',
};

// ── Types ─────────────────────────────────────────────────────────────
interface Part {
  pk: number;
  name: string;
  description: string;
  category: number | null;
  category_detail?: { pk: number; name: string; pathstring: string };
  image: string | null;
  thumbnail: string | null;
  in_stock: number;
  units: string;
  link: string;
  IPN: string;
  active: boolean;
  keywords: string;
}

interface Category {
  pk: number;
  name: string;
  description: string;
  pathstring: string;
  parent: number | null;
  part_count: number;
  level: number;
}

interface StockItem {
  pk: number;
  part: number;
  part_detail?: { pk: number; name: string; thumbnail: string | null };
  quantity: number;
  location: number | null;
  location_detail?: { pk: number; name: string; pathstring: string } | null;
}

interface StockLocation {
  pk: number;
  name: string;
  description: string;
  pathstring: string;
  parent: number | null;
}

// ── Paper / tape textures (shared with Menu.tsx) ──────────────────────
const paperTextures = [
  '/assets/images/paper/2337696d-9c85-4330-839d-4102c2c8da38_rw_1920.png',
  '/assets/images/paper/44fe7d03-7726-46a0-9b17-5790a11fe42d_rw_3840.png',
  '/assets/images/paper/572e1f03-ee6d-4a6b-95d8-9fec367c58a9_rw_1920.png',
  '/assets/images/paper/6248e7b9-85bc-42bd-9f63-d2e616f0d052_rw_3840.png',
  '/assets/images/paper/7e962015-0433-412b-a317-f61b5443a8d7_rw_1920.png',
  '/assets/images/paper/c2759faf-5614-45ed-8aa1-db8910edd4b1_rw_1920.png',
];

const maskingTapeTextures = [
  '/assets/images/maskingtape/10c87e82-99cf-4df0-b47b-8f650d4b21e9_rw_1920.png',
  '/assets/images/maskingtape/1672c350-9ee4-4030-bca2-abbf9a2756d7_rw_600.png',
  '/assets/images/maskingtape/2ef85379-640c-4e19-9ed3-8ba8485914ae_rw_3840.png',
  '/assets/images/maskingtape/3f238238-e95b-48db-8685-59ae3016ff81_rw_1920.png',
  '/assets/images/maskingtape/494681b1-8ef8-400e-a219-50102c1ee98b_rw_1200.png',
  '/assets/images/maskingtape/5c1ae790-9d7f-40f8-9fe8-0601ef68794d_rw_600.png',
  '/assets/images/maskingtape/884001be-0d19-4cd9-8f07-f930d2f0e6ee_rw_1200.png',
  '/assets/images/maskingtape/9e4367ef-5bd2-44f2-8779-3b4fdd3f696a_rw_1920.png',
  '/assets/images/maskingtape/a05a2d05-7a39-433e-bf76-597003f7789b_rw_1920.png',
  '/assets/images/maskingtape/d868c31c-996d-40bd-ace9-324d7457e1fc_rw_600.png',
  '/assets/images/maskingtape/f08402eb-b275-4034-8d66-4981f93ad679_rw_1200.png',
];

const postItColors = [
  '#fef3c7', '#fde68a', '#fcd34d', // yellows
  '#d1fae5', '#a7f3d0', '#6ee7b7', // greens
  '#dbeafe', '#bfdbfe', '#93c5fd', // blues
  '#fce7f3', '#fbcfe8', '#f9a8d4', // pinks
  '#fed7aa', '#fdba74', '#fb923c', // oranges
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// ── API helpers ───────────────────────────────────────────────────────
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...API_HEADERS, ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  let results: T[] = [];
  let url = path.includes('?') ? `${path}&limit=100` : `${path}?limit=100`;
  while (url) {
    const data = await apiFetch<{ results: T[]; next: string | null }>(url);
    results = results.concat(data.results);
    if (data.next) {
      // next is absolute URL, strip to path
      const u = new URL(data.next);
      url = u.pathname.replace('/api', '') + u.search;
    } else {
      url = '';
    }
  }
  return results;
}

// ── Main Component ────────────────────────────────────────────────────
export default function PartsInventory() {
  const isMobile = useIsMobile();

  // Data state
  const [parts, setParts] = useState<Part[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false);

  // Textures (stable per session)
  const paperTexture = useMemo(() => paperTextures[Math.floor(Math.random() * paperTextures.length)], []);
  const tapeTexture = useMemo(() => maskingTapeTextures[Math.floor(Math.random() * maskingTapeTextures.length)], []);
  const tapeRotation = useMemo(() => (Math.random() - 0.5) * 10, []);

  // ── Load data ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [partsData, catData, locData] = await Promise.all([
        fetchAllPages<Part>('/part/'),
        apiFetch<Category[]>('/part/category/'),
        apiFetch<StockLocation[]>('/stock/location/'),
      ]);
      setParts(partsData);
      setCategories(Array.isArray(catData) ? catData : []);
      setLocations(Array.isArray(locData) ? locData : []);
    } catch (e: any) {
      console.error('Failed to load inventory:', e);
      setError(e.message || 'Failed to connect to inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Fuse.js search ────────────────────────────────────────────────
  const fuse = useMemo(() => new Fuse(parts, {
    keys: [
      { name: 'name', weight: 0.4 },
      { name: 'description', weight: 0.2 },
      { name: 'keywords', weight: 0.2 },
      { name: 'IPN', weight: 0.1 },
      { name: 'category_detail.name', weight: 0.1 },
    ],
    threshold: 0.4,
    includeScore: true,
  }), [parts]);

  const filteredParts = useMemo(() => {
    let result = parts;
    if (searchQuery.trim()) {
      result = fuse.search(searchQuery).map(r => r.item);
    }
    if (selectedCategory !== null) {
      result = result.filter(p => p.category === selectedCategory);
    }
    return result;
  }, [parts, searchQuery, selectedCategory, fuse]);

  // ── Category tree helpers ─────────────────────────────────────────
  const rootCategories = useMemo(() => categories.filter(c => c.parent === null), [categories]);
  const childrenOf = useCallback((parentPk: number) => categories.filter(c => c.parent === parentPk), [categories]);

  // ── Render ────────────────────────────────────────────────────────
  if (selectedPart) {
    return <PartDetail 
      part={selectedPart} 
      categories={categories}
      locations={locations}
      paperTexture={paperTexture}
      tapeTexture={tapeTexture}
      tapeRotation={tapeRotation}
      onBack={() => setSelectedPart(null)} 
      onStockUpdated={loadData}
    />;
  }

  if (showAddForm) {
    return <AddPartForm
      categories={categories}
      locations={locations}
      paperTexture={paperTexture}
      tapeTexture={tapeTexture}
      tapeRotation={tapeRotation}
      onBack={() => setShowAddForm(false)}
      onCreated={(part) => {
        setParts(prev => [...prev, part]);
        setShowAddForm(false);
        toast.success(`Added ${part.name}`);
      }}
    />;
  }

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <Toaster position="top-center" />

      {/* Main paper card */}
      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-6 sm:py-8">
        <div
          className="relative rounded shadow-2xl overflow-hidden"
          style={{
            backgroundImage: `url(${paperTexture})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Masking tape decoration */}
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 z-10 pointer-events-none opacity-80"
            style={{
              backgroundImage: `url(${tapeTexture})`,
              backgroundSize: 'cover',
              transform: `translateX(-50%) rotate(${tapeRotation}deg)`,
            }}
          />

          <div className="px-4 py-8 sm:px-8 sm:py-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <a href="/" className="text-gray-500 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </a>
              <h1 
                className="text-2xl sm:text-3xl font-light tracking-wide text-gray-800 text-center flex-1"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                parts bin
              </h1>
              <button
                onClick={() => setShowAddForm(true)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Add part"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Search bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="search parts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-white/60 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-amber-300/50 placeholder:text-gray-400"
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category filter pills */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedCategory === null
                      ? 'bg-amber-200/80 text-amber-900 shadow-sm'
                      : 'bg-white/40 text-gray-600 hover:bg-white/60'
                  }`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  all
                </button>
                {rootCategories.map(cat => (
                  <button
                    key={cat.pk}
                    onClick={() => setSelectedCategory(selectedCategory === cat.pk ? null : cat.pk)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedCategory === cat.pk
                        ? 'bg-amber-200/80 text-amber-900 shadow-sm'
                        : 'bg-white/40 text-gray-600 hover:bg-white/60'
                    }`}
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    {cat.name.toLowerCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Loading / error */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <p className="text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>loading inventory...</p>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <p className="text-sm text-red-500/80 mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>{error}</p>
                <button
                  onClick={loadData}
                  className="text-xs text-amber-700 underline underline-offset-2"
                >
                  try again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && filteredParts.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {searchQuery ? 'no parts match your search' : 'no parts yet'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="mt-3 text-xs text-amber-700 underline underline-offset-2"
                  >
                    add the first one
                  </button>
                )}
              </div>
            )}

            {/* Parts list */}
            {!loading && !error && filteredParts.length > 0 && (
              <div className="space-y-2">
                {filteredParts.map((part) => (
                  <PartCard
                    key={part.pk}
                    part={part}
                    onClick={() => setSelectedPart(part)}
                  />
                ))}
              </div>
            )}

            {/* Count */}
            {!loading && !error && parts.length > 0 && (
              <p className="text-center text-xs text-gray-400 mt-6" style={{ fontFamily: "'Inter', sans-serif" }}>
                {filteredParts.length} of {parts.length} parts
              </p>
            )}
          </div>
        </div>

        {/* External link to full InvenTree */}
        <div className="text-center mt-4">
          <a
            href="https://inv.andrew.net"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 transition-colors"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            <ExternalLink className="w-3 h-3" />
            full inventory dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Part Card ─────────────────────────────────────────────────────────
function PartCard({ part, onClick }: { part: Part; onClick: () => void }) {
  const thumbUrl = part.thumbnail
    ? (part.thumbnail.startsWith('http') ? part.thumbnail : `${API_BASE.replace('/api', '')}${part.thumbnail}`)
    : null;

  const stockColor = part.in_stock > 0 ? 'text-green-700' : 'text-red-500';
  const postItColor = postItColors[part.pk % postItColors.length];
  const rotation = seededRandom(part.pk * 7) * 1.5 - 0.75;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg transition-all hover:shadow-md active:scale-[0.98] border border-gray-200/30"
      style={{
        backgroundColor: `${postItColor}90`,
        transform: `rotate(${rotation}deg)`,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded bg-white/50 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={part.name}
              className="w-full h-full object-cover rounded"
              loading="lazy"
            />
          ) : (
            <Package className="w-5 h-5 text-gray-300" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{part.name}</p>
          {part.description && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{part.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs font-medium ${stockColor}`}>
              {part.in_stock} {part.units || 'pcs'}
            </span>
            {part.category_detail && (
              <span className="text-xs text-gray-400 truncate">
                {part.category_detail.name}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </div>
    </button>
  );
}

// ── Part Detail View ──────────────────────────────────────────────────
function PartDetail({
  part,
  categories,
  locations,
  paperTexture,
  tapeTexture,
  tapeRotation,
  onBack,
  onStockUpdated,
}: {
  part: Part;
  categories: Category[];
  locations: StockLocation[];
  paperTexture: string;
  tapeTexture: string;
  tapeRotation: number;
  onBack: () => void;
  onStockUpdated: () => void;
}) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [addingStock, setAddingStock] = useState(false);
  const [newQty, setNewQty] = useState('1');
  const [newLocation, setNewLocation] = useState('');

  useEffect(() => {
    setLoadingStock(true);
    apiFetch<{ results: StockItem[] }>(`/stock/?part=${part.pk}&limit=100`)
      .then(data => setStock(data.results))
      .catch(e => console.error(e))
      .finally(() => setLoadingStock(false));
  }, [part.pk]);

  const imageUrl = part.image
    ? (part.image.startsWith('http') ? part.image : `${API_BASE.replace('/api', '')}${part.image}`)
    : null;

  const handleAddStock = async () => {
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty <= 0) { toast.error('Invalid quantity'); return; }

    setAddingStock(true);
    try {
      const body: any = { part: part.pk, quantity: qty };
      if (newLocation) body.location = parseInt(newLocation);
      await apiFetch('/stock/', { method: 'POST', body: JSON.stringify(body) });
      toast.success(`Added ${qty} to stock`);
      // Refresh
      const data = await apiFetch<{ results: StockItem[] }>(`/stock/?part=${part.pk}&limit=100`);
      setStock(data.results);
      setNewQty('1');
      setNewLocation('');
      onStockUpdated();
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setAddingStock(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <Toaster position="top-center" />
      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-6 sm:py-8">
        <div
          className="relative rounded shadow-2xl overflow-hidden"
          style={{
            backgroundImage: `url(${paperTexture})`,
            backgroundSize: 'cover',
          }}
        >
          {/* Tape */}
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 z-10 pointer-events-none opacity-80"
            style={{
              backgroundImage: `url(${tapeTexture})`,
              backgroundSize: 'cover',
              transform: `translateX(-50%) rotate(${tapeRotation}deg)`,
            }}
          />

          <div className="px-4 py-8 sm:px-8 sm:py-10">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1
                className="text-xl sm:text-2xl font-light text-gray-800 flex-1"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                {part.name}
              </h1>
            </div>

            {/* Image */}
            {imageUrl && (
              <div className="mb-6 rounded-lg overflow-hidden bg-white/30 border border-gray-200/30">
                <img src={imageUrl} alt={part.name} className="w-full max-h-64 object-contain" />
              </div>
            )}

            {/* Details */}
            <div className="space-y-3 mb-6" style={{ fontFamily: "'Inter', sans-serif" }}>
              {part.description && (
                <p className="text-sm text-gray-600">{part.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                {part.IPN && (
                  <div className="bg-white/40 rounded-lg p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">IPN</p>
                    <p className="text-sm font-medium text-gray-700">{part.IPN}</p>
                  </div>
                )}
                <div className="bg-white/40 rounded-lg p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">In Stock</p>
                  <p className={`text-sm font-medium ${part.in_stock > 0 ? 'text-green-700' : 'text-red-500'}`}>
                    {part.in_stock} {part.units || 'pcs'}
                  </p>
                </div>
                {part.category_detail && (
                  <div className="bg-white/40 rounded-lg p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Category</p>
                    <p className="text-sm text-gray-700">{part.category_detail.pathstring || part.category_detail.name}</p>
                  </div>
                )}
              </div>

              {part.link && (
                <a
                  href={part.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  datasheet / listing
                </a>
              )}
            </div>

            {/* Stock locations */}
            <div className="mb-6">
              <h2
                className="text-lg font-light text-gray-700 mb-3"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                stock locations
              </h2>

              {loadingStock ? (
                <div className="flex items-center justify-center py-6 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : stock.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4" style={{ fontFamily: "'Inter', sans-serif" }}>
                  no stock entries
                </p>
              ) : (
                <div className="space-y-1.5">
                  {stock.map(s => (
                    <div
                      key={s.pk}
                      className="flex items-center justify-between bg-white/40 rounded-lg p-2.5"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {s.location_detail?.pathstring || s.location_detail?.name || 'Unassigned'}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {s.quantity} {part.units || 'pcs'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick add stock */}
            <div className="bg-white/30 rounded-lg p-4 border border-gray-200/30">
              <h3 className="text-sm font-medium text-gray-600 mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
                quick add stock
              </h3>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Qty</label>
                  <input
                    type="number"
                    value={newQty}
                    onChange={e => setNewQty(e.target.value)}
                    min="1"
                    className="w-full px-2.5 py-2 bg-white/60 border border-gray-200/60 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                  />
                </div>
                {locations.length > 0 && (
                  <div className="flex-1">
                    <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Location</label>
                    <select
                      value={newLocation}
                      onChange={e => setNewLocation(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white/60 border border-gray-200/60 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                    >
                      <option value="">—</option>
                      {locations.map(loc => (
                        <option key={loc.pk} value={loc.pk}>
                          {loc.pathstring || loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Button
                  onClick={handleAddStock}
                  disabled={addingStock}
                  size="sm"
                  className="bg-amber-200/80 text-amber-900 hover:bg-amber-300/80 border-none shadow-none px-4"
                >
                  {addingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Link to full InvenTree page */}
            <div className="text-center mt-6">
              <a
                href={`https://inv.andrew.net/part/${part.pk}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                <ExternalLink className="w-3 h-3" />
                view in InvenTree
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Part Form ─────────────────────────────────────────────────────
function AddPartForm({
  categories,
  locations,
  paperTexture,
  tapeTexture,
  tapeRotation,
  onBack,
  onCreated,
}: {
  categories: Category[];
  locations: StockLocation[];
  paperTexture: string;
  tapeTexture: string;
  tapeRotation: number;
  onBack: () => void;
  onCreated: (part: Part) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [ipn, setIpn] = useState('');
  const [link, setLink] = useState('');
  const [keywords, setKeywords] = useState('');
  const [initialQty, setInitialQty] = useState('1');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }

    setSaving(true);
    try {
      const body: any = {
        name: name.trim(),
        description: description.trim(),
        active: true,
        component: true,
      };
      if (category) body.category = parseInt(category);
      if (ipn.trim()) body.IPN = ipn.trim();
      if (link.trim()) body.link = link.trim();
      if (keywords.trim()) body.keywords = keywords.trim();

      const newPart = await apiFetch<Part>('/part/', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      // Add initial stock if qty > 0
      const qty = parseFloat(initialQty);
      if (qty > 0) {
        const stockBody: any = { part: newPart.pk, quantity: qty };
        if (location) stockBody.location = parseInt(location);
        await apiFetch('/stock/', { method: 'POST', body: JSON.stringify(stockBody) });
      }

      onCreated(newPart);
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundImage: 'url(/assets/images/corkboard/cork-board-background-2000-x-1333-wtfq50v9g0jpm6gm.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <Toaster position="top-center" />
      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-6 sm:py-8">
        <div
          className="relative rounded shadow-2xl overflow-hidden"
          style={{
            backgroundImage: `url(${paperTexture})`,
            backgroundSize: 'cover',
          }}
        >
          {/* Tape */}
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 z-10 pointer-events-none opacity-80"
            style={{
              backgroundImage: `url(${tapeTexture})`,
              backgroundSize: 'cover',
              transform: `translateX(-50%) rotate(${tapeRotation}deg)`,
            }}
          />

          <div className="px-4 py-8 sm:px-8 sm:py-10">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1
                className="text-xl sm:text-2xl font-light text-gray-800"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                add a part
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
              {/* Name */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. 10kΩ Resistor"
                  required
                  className="w-full px-3 py-2.5 bg-white/60 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="optional description..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white/60 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50 resize-none"
                />
              </div>

              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/60 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                  >
                    <option value="">— none —</option>
                    {categories.map(c => (
                      <option key={c.pk} value={c.pk}>
                        {c.pathstring || c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* IPN + Keywords row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">IPN</label>
                  <input
                    type="text"
                    value={ipn}
                    onChange={e => setIpn(e.target.value)}
                    placeholder="part number"
                    className="w-full px-3 py-2.5 bg-white/60 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Keywords</label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={e => setKeywords(e.target.value)}
                    placeholder="smd, 0805..."
                    className="w-full px-3 py-2.5 bg-white/60 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                  />
                </div>
              </div>

              {/* Link */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Link / Datasheet</label>
                <input
                  type="url"
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 bg-white/60 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                />
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200/40 pt-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-3">Initial Stock</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Quantity</label>
                    <input
                      type="number"
                      value={initialQty}
                      onChange={e => setInitialQty(e.target.value)}
                      min="0"
                      className="w-full px-3 py-2.5 bg-white/60 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                    />
                  </div>
                  {locations.length > 0 && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Location</label>
                      <select
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/60 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                      >
                        <option value="">—</option>
                        {locations.map(loc => (
                          <option key={loc.pk} value={loc.pk}>
                            {loc.pathstring || loc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="w-full py-3 rounded-lg text-sm font-medium transition-all bg-amber-200/80 text-amber-900 hover:bg-amber-300/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    add part
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
