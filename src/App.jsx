import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Heart, Home, Pencil, Plus, Settings, ShoppingCart, Trash2, User, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Supabase (директен REST достъп, без @supabase/supabase-js)
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://epapcmyvwyvwdjcrvprj.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Y7xrMB7N0j4IH_iyvYFGRQ_21SgE6xa'

async function rest(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Грешка ${res.status}`)
  }
  if (res.status === 204) return null
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  return res.json()
}

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Грешен имейл или парола.')
  return data
}

async function signup(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Неуспешна регистрация.')
  return data
}

async function refreshSession(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Сесията изтече.')
  return data
}

// Клиентска сесия (различна от админ; пази се, за да остане клиентът логнат).
const CUSTOMER_KEY = 'customer_session'
function saveCustomer(data) {
  if (!data?.access_token) return null
  const session = {
    id: data.user?.id,
    token: data.access_token,
    refresh_token: data.refresh_token,
    email: data.user?.email,
  }
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(session))
  return session
}
function loadCustomer() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMER_KEY))
  } catch {
    return null
  }
}
function clearCustomer() {
  localStorage.removeItem(CUSTOMER_KEY)
}


async function uploadProductImage(token, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Грешка ${res.status}`)
  }
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

function money(n, currency = '€') {
  const num = Number(n) || 0
  return `${num.toFixed(2)} ${currency}`
}

function isUrl(value) {
  return typeof value === 'string' && /^https?:\/\//.test(value)
}

const ADMIN_EMAIL = 'dimitrkuzmanov3@gmail.com'

function PasswordInput(props) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-field">
      <input {...props} type={show ? 'text' : 'password'} />
      <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Скрий паролата' : 'Покажи паролата'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

function isOnSale(p) {
  return p && p.sale_price != null && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price)
}
function effectivePrice(p) {
  return isOnSale(p) ? Number(p.sale_price) : Number(p.price)
}
function discountPercent(p) {
  return isOnSale(p) ? Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100) : 0
}

// Вариантите (дизайни/цветове) могат да са низове (стар формат) или обекти {name, stock}.
function normVariants(p) {
  const arr = Array.isArray(p?.variants) ? p.variants : []
  return arr.map((v) =>
    typeof v === 'string'
      ? { name: v, stock: null }
      : { name: v.name, stock: v.stock === null || v.stock === undefined || v.stock === '' ? null : Number(v.stock) },
  )
}
function hasVariants(p) {
  return normVariants(p).length > 0
}
function variantStock(p, name) {
  const v = normVariants(p).find((x) => x.name === name)
  return v ? v.stock : null // null = без следене на наличност
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('bg-BG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function parseRoute() {
  const hash = window.location.hash
  if (hash === '#admin') return { name: 'admin' }
  if (hash === '#favorites') return { name: 'favorites' }
  if (hash === '#cart') return { name: 'cart' }
  if (hash === '#profile') return { name: 'profile' }
  const m = hash.match(/^#product\/(.+)$/)
  if (m) return { name: 'product', id: decodeURIComponent(m[1]) }
  return { name: 'shop' }
}

const getProducts = () => rest('products?select=*&order=created_at.desc')
const getProduct = (id) => rest(`products?select=*&id=eq.${id}`).then((r) => r[0])
const createProduct = (token, product) =>
  rest('products', { method: 'POST', token, body: product, headers: { Prefer: 'return=representation' } }).then((r) => r[0])
const updateProduct = (token, id, patch) =>
  rest(`products?id=eq.${id}`, { method: 'PATCH', token, body: patch, headers: { Prefer: 'return=representation' } }).then((r) => r[0])
const deleteProduct = (token, id) => rest(`products?id=eq.${id}`, { method: 'DELETE', token })

const getOrders = (token) => rest('orders?select=*&order=created_at.desc', { token })
// При логнат клиент подаваме token — така поръчката се вързва към акаунта (user_id = auth.uid()).
const createOrder = (order, token) => rest('orders', { method: 'POST', token, body: order, headers: { Prefer: 'return=minimal' } })
const updateOrderStatus = (token, id, status) =>
  rest(`orders?id=eq.${id}`, { method: 'PATCH', token, body: { status }, headers: { Prefer: 'return=representation' } }).then((r) => r[0])
const deleteOrder = (token, id) => rest(`orders?id=eq.${id}`, { method: 'DELETE', token })
const getMyOrders = (token) => rest('orders?select=*&order=created_at.desc', { token })
const cancelMyOrder = (token, id) =>
  rest(`orders?id=eq.${id}`, { method: 'PATCH', token, body: { status: 'отказана' }, headers: { Prefer: 'return=representation' } })

const getSettings = () => rest('shop_settings?select=*&id=eq.1').then((r) => r[0])
const updateSettings = (token, patch) =>
  rest('shop_settings?id=eq.1', { method: 'PATCH', token, body: patch, headers: { Prefer: 'return=representation' } }).then((r) => r[0])

// Съобщения „Свържи се с продавача“ (клиентът пише, админът чете)
const createMessage = (msg, token) => rest('messages', { method: 'POST', token, body: msg, headers: { Prefer: 'return=minimal' } })
const getMessages = (token) => rest('messages?select=*&order=created_at.desc', { token })
const getThread = (token) => rest('messages?select=*&order=created_at.asc', { token })

// Синхронизация на количка/любими към акаунта (между устройства)
const getUserData = (token) => rest('user_data?select=cart,favorites', { token }).then((r) => r && r[0])
const saveUserData = (token, userId, cart, favorites) =>
  rest('user_data?on_conflict=user_id', {
    method: 'POST',
    token,
    body: { user_id: userId, cart, favorites, updated_at: new Date().toISOString() },
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  })

function mergeCarts(local, server) {
  const map = new Map()
  for (const it of [...(server || []), ...(local || [])]) map.set(it.key || it.id, it)
  return Array.from(map.values())
}

// Отзиви
const getReviews = (productId) => rest(`reviews?select=*&product_id=eq.${productId}&order=created_at.desc`)
const createReview = (token, review) =>
  rest('reviews', { method: 'POST', token, body: review, headers: { Prefer: 'return=representation' } }).then((r) => r[0])
const deleteReview = (token, id) => rest(`reviews?id=eq.${id}`, { method: 'DELETE', token })
const markMessage = (token, id, handled) =>
  rest(`messages?id=eq.${id}`, { method: 'PATCH', token, body: { handled }, headers: { Prefer: 'return=representation' } }).then((r) => r[0])
const deleteMessage = (token, id) => rest(`messages?id=eq.${id}`, { method: 'DELETE', token })

const STATUSES = ['нова', 'изпратена', 'приключена', 'отказана']
const CART_KEY = 'cart'
const FAV_KEY = 'favorites'
// Formspree endpoint за имейл известия при ново съобщение (напр. 'https://formspree.io/f/xxxxxxx').
// Празно = изключено. Попълни с твоя endpoint, за да получаваш имейли.
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mqerqlww'

async function notifyFormspree(msg) {
  if (!FORMSPREE_ENDPOINT) return
  try {
    await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: msg.name || 'Клиент',
        email: msg.email || '',
        message: msg.body,
        _subject: msg.subject || 'Ново съобщение от магазина',
      }),
    })
  } catch {
    // известието е второстепенно — не спираме, ако падне
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  const [settings, setSettings] = useState(null)
  const [session, setSession] = useState(null)
  const [customer, setCustomer] = useState(loadCustomer)
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || []
    } catch {
      return []
    }
  })
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY)) || []
    } catch {
      return []
    }
  })
  const syncedFor = useRef(null)
  const refreshingRef = useRef(false)

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Автоматично презареждане на страницата на всеки 30 секунди (само админ панелът е изключен).
  useEffect(() => {
    const timer = setInterval(() => {
      if (window.location.hash !== '#admin') window.location.reload()
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {})
  }, [])

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites))
  }, [favorites])

  // Подновяване на клиентската сесия — при отваряне, периодично и при връщане към таба,
  // за да не изтича JWT (токенът важи ~1 час).
  useEffect(() => {
    let active = true
    async function refreshCustomerToken(logoutOnFail) {
      if (refreshingRef.current) return
      const stored = loadCustomer()
      if (!stored?.refresh_token) return
      refreshingRef.current = true
      try {
        const data = await refreshSession(stored.refresh_token)
        if (active) setCustomer(saveCustomer(data))
      } catch {
        if (logoutOnFail && active) {
          clearCustomer()
          setCustomer(null)
          syncedFor.current = null
        }
      } finally {
        refreshingRef.current = false
      }
    }

    refreshCustomerToken(true) // при отваряне
    const interval = setInterval(() => refreshCustomerToken(false), 45 * 60 * 1000) // на всеки 45 мин
    const onFocus = () => !document.hidden && refreshCustomerToken(false)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  // При вход: сливаме количката/любимите от акаунта (синхрон между устройства).
  useEffect(() => {
    if (!customer?.token || !customer?.id) return
    if (syncedFor.current === customer.id) return
    let active = true
    getUserData(customer.token)
      .then((row) => {
        if (!active) return
        setCart((local) => mergeCarts(local, row?.cart || []))
        setFavorites((local) => Array.from(new Set([...(local || []), ...(row?.favorites || [])])))
        syncedFor.current = customer.id
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [customer])

  // Докато клиентът е логнат — записваме промените в акаунта му.
  useEffect(() => {
    if (!customer?.token || !customer?.id || syncedFor.current !== customer.id) return
    const t = setTimeout(() => {
      saveUserData(customer.token, customer.id, cart, favorites).catch(() => {})
    }, 700)
    return () => clearTimeout(t)
  }, [cart, favorites, customer])

  function handleLogin(data) {
    setSession({ token: data.access_token, email: data.user?.email })
  }

  function handleLogout() {
    setSession(null)
  }

  function handleCustomerAuth(data) {
    setCustomer(saveCustomer(data))
  }

  function handleCustomerLogout() {
    clearCustomer()
    setCustomer(null)
    syncedFor.current = null
    // Изчистваме локалната количка/любими, за да не се смесват с друг акаунт на същото устройство.
    setCart([])
    setFavorites([])
  }

  function addToCart(product, note, variant) {
    setCart((c) => {
      // Наличност: за избран дизайн — неговата; иначе на продукта.
      const vStock = variant ? variantStock(product, variant) : null
      const lineStock = variant ? (vStock == null ? 9999 : vStock) : product.stock
      const base = { id: product.id, name: product.name, price: effectivePrice(product), image: product.image, variant: variant || null }
      // Поръчка по заявка: винаги нов ред със своя бележка (не се слива).
      if (product.custom || note) {
        const key = `${product.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`
        return [...c, { key, ...base, qty: 1, stock: variant ? lineStock : product.stock || 9999, note: note || null }]
      }
      // Различен избран дизайн/цвят = отделен ред.
      const key = variant ? `${product.id}::${variant}` : product.id
      const existing = c.find((i) => (i.key || i.id) === key && !i.note)
      if (existing) {
        return c.map((i) => (i.key === existing.key ? { ...i, qty: Math.min(i.qty + 1, lineStock) } : i))
      }
      return [...c, { key, ...base, qty: 1, stock: lineStock, note: null }]
    })
  }

  function changeQty(key, qty) {
    setCart((c) => c.map((i) => ((i.key || i.id) === key ? { ...i, qty } : i)).filter((i) => i.qty > 0))
  }

  function removeFromCart(key) {
    setCart((c) => c.filter((i) => (i.key || i.id) !== key))
  }

  function toggleFavorite(id) {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  }

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0)
  const cartProps = { cart, addToCart, changeQty, removeFromCart, clearCart: () => setCart([]) }
  const favProps = { favorites, toggleFavorite }

  if (route.name === 'admin') {
    return (
      <>
        <Style />
        {session ? (
          <Admin session={session} settings={settings} onSettingsChange={setSettings} onLogout={handleLogout} />
        ) : (
          <AuthGate onLogin={handleLogin} />
        )}
      </>
    )
  }

  return (
    <>
      <Style />
      {route.name === 'favorites' ? (
        <FavoritesPage settings={settings} addToCart={addToCart} {...favProps} />
      ) : route.name === 'cart' ? (
        <CartPage settings={settings} customer={customer} {...cartProps} />
      ) : route.name === 'profile' ? (
        <ProfilePage settings={settings} customer={customer} onAuth={handleCustomerAuth} onLogout={handleCustomerLogout} />
      ) : route.name === 'product' ? (
        <ProductPage productId={route.id} settings={settings} customer={customer} addToCart={addToCart} {...favProps} />
      ) : (
        <Shop settings={settings} addToCart={addToCart} {...favProps} />
      )}
      <BottomNav active={route.name} cartCount={cartCount} favCount={favorites.length} />
    </>
  )
}

// ---------------------------------------------------------------------------
// BottomNav (долна навигация)
// ---------------------------------------------------------------------------

function BottomNav({ active, cartCount, favCount }) {
  const items = [
    { key: 'shop', href: '#', label: 'Начало', icon: Home },
    { key: 'favorites', href: '#favorites', label: 'Любими', icon: Heart, badge: favCount },
    { key: 'cart', href: '#cart', label: 'Количка', icon: ShoppingCart, badge: cartCount },
    { key: 'profile', href: '#profile', label: 'Профил', icon: User },
  ]
  return (
    <nav className="bottom-nav">
      {items.map(({ key, href, label, icon: Icon, badge }) => (
        <a key={key} href={href} className={active === key ? 'bottom-nav-item active' : 'bottom-nav-item'}>
          <span className="bottom-nav-icon">
            <Icon size={22} />
            {badge > 0 && <span className="bottom-nav-badge">{badge}</span>}
          </span>
          {label}
        </a>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// ProductCard (карта на продукт — ползва се в Начало и Любими)
// ---------------------------------------------------------------------------

function ProductCard({ product: p, currency, onAdd, isFav, onToggleFav }) {
  return (
    <a className="product-card" href={`#product/${p.id}`}>
      <div className="product-image">
        {isOnSale(p) && <span className="sale-badge">-{discountPercent(p)}%</span>}
        {p.custom && <span className="custom-badge">★ По заявка</span>}
        {isUrl(p.image) ? <img src={p.image} alt={p.name} /> : <span className="emoji">{p.image || '📦'}</span>}
        <button
          className={isFav ? 'fav-btn active' : 'fav-btn'}
          title={isFav ? 'Премахни от любими' : 'Добави в любими'}
          aria-label="Любими"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleFav(p.id)
          }}
        >
          <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>
      <h3>{p.name}</h3>
      {p.description && <p className="desc">{p.description}</p>}
      {!hasVariants(p) && !p.custom && p.stock > 0 && p.stock <= 2 && (
        <p className="low-stock">{p.stock === 1 ? 'Остава само 1 бр.' : `Остават само ${p.stock} бр.`}</p>
      )}
      <div className="product-footer">
        {isOnSale(p) ? (
          <span className="price-wrap">
            <s className="old-price">{money(p.price, currency)}</s>
            <strong className="sale-price">{money(p.sale_price, currency)}</strong>
          </span>
        ) : (
          <strong>{money(p.price, currency)}</strong>
        )}
        {hasVariants(p) || p.custom ? (
          <span className="card-choose">Избери</span>
        ) : (
          <button
            disabled={p.stock <= 0}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAdd(p)
            }}
          >
            {p.stock <= 0 ? 'Изчерпан' : 'Добави'}
          </button>
        )}
      </div>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Shop / Начало (витрина с продукти)
// ---------------------------------------------------------------------------

function Shop({ settings, addToCart, favorites, toggleFavorite }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('всички')

  useEffect(() => {
    let active = true
    const loadProducts = () => {
      getProducts()
        .then((p) => active && setProducts(p))
        .finally(() => active && setLoading(false))
    }
    loadProducts()
    // Презареждане при връщане към таба, за да се видят нови/променени продукти.
    const onFocus = () => loadProducts()
    const onVisible = () => !document.hidden && loadProducts()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const currency = settings?.currency || '€'
  const categories = ['всички', ...new Set(products.map((p) => p.category).filter(Boolean))]
  const filtered = category === 'всички' ? products : products.filter((p) => p.category === category)

  return (
    <div className="shop">
      <header className="shop-header">
        <div>
          <h1>{settings?.shop_name || 'Моят магазин'}</h1>
          {settings?.tagline && <p className="tagline">{settings.tagline}</p>}
        </div>
      </header>

      <a className="admin-fab" href="#admin" title="Администрация" aria-label="Администрация">
        <Settings size={20} />
      </a>

      {categories.length > 1 && (
        <div className="categories">
          {categories.map((c) => (
            <button key={c} className={c === category ? 'chip active' : 'chip'} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="hint">Зареждане...</p>
      ) : filtered.length === 0 ? (
        <p className="hint">Няма налични продукти.</p>
      ) : (
        <div className="product-grid">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              currency={currency}
              onAdd={addToCart}
              isFav={favorites.includes(p.id)}
              onToggleFav={toggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FavoritesPage (Любими)
// ---------------------------------------------------------------------------

function FavoritesPage({ settings, addToCart, favorites, toggleFavorite }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getProducts()
      .then((p) => active && setProducts(p))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const currency = settings?.currency || '€'
  const favProducts = products.filter((p) => favorites.includes(p.id))

  return (
    <div className="shop">
      <header className="shop-header">
        <div>
          <h1>Любими</h1>
        </div>
      </header>

      {loading ? (
        <p className="hint">Зареждане...</p>
      ) : favProducts.length === 0 ? (
        <p className="hint">Още нямаш любими продукти. Натисни ♥ върху продукт, за да го добавиш тук.</p>
      ) : (
        <div className="product-grid">
          {favProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              currency={currency}
              onAdd={addToCart}
              isFav
              onToggleFav={toggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CartPage (Количка)
// ---------------------------------------------------------------------------

function CartPage({ settings, customer, cart, changeQty, removeFromCart, clearCart }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const currency = settings?.currency || '€'
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0)

  function handleOrderComplete() {
    clearCart()
    setCheckoutOpen(false)
  }

  return (
    <div className="shop">
      <header className="shop-header">
        <div>
          <h1>Количка</h1>
        </div>
      </header>

      {cart.length === 0 ? (
        <p className="hint">
          Количката е празна. <a href="#">Разгледай продуктите →</a>
        </p>
      ) : (
        <>
          <div className="cart-items">
            {cart.map((i) => (
              <div className="cart-item" key={i.key || i.id}>
                <span className="emoji">{isUrl(i.image) ? <img src={i.image} alt="" /> : i.image}</span>
                <div className="cart-item-info">
                  <span>{i.name}</span>
                  <small>{money(i.price, currency)}</small>
                  {i.variant && <small className="cart-variant">Дизайн: {i.variant}</small>}
                  {i.note && <small className="cart-note">Заявка: {i.note}</small>}
                </div>
                <input
                  type="number"
                  min="1"
                  max={i.stock}
                  value={i.qty}
                  onChange={(e) => changeQty(i.key || i.id, Math.max(1, Math.min(Number(e.target.value) || 1, i.stock)))}
                />
                <button className="icon-btn" onClick={() => removeFromCart(i.key || i.id)}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="cart-total">
            <span>Общо:</span>
            <strong>{money(total, currency)}</strong>
          </div>
          <button className="primary" onClick={() => setCheckoutOpen(true)}>
            Поръчай
          </button>
        </>
      )}

      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Завършване на поръчката">
        <Checkout cart={cart} total={total} currency={currency} onComplete={handleOrderComplete} customerToken={customer?.token} />
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProfilePage (Профил — вход и регистрация за клиенти)
// ---------------------------------------------------------------------------

function ProfilePage({ settings, customer, onAuth, onLogout }) {
  if (customer) {
    return (
      <div className="shop">
        <header className="shop-header">
          <div>
            <h1>Профил</h1>
          </div>
        </header>
        <div className="profile-card">
          <p className="hint">Влязъл си като:</p>
          <strong className="profile-email">{customer.email}</strong>
          <button className="primary" onClick={onLogout}>
            Изход
          </button>
        </div>
        <MyOrders token={customer.token} currency={settings?.currency} />
        <SellerChat customer={customer} />
        <ContactDetails settings={settings} />
      </div>
    )
  }

  return (
    <div className="shop">
      <header className="shop-header">
        <div>
          <h1>Профил</h1>
        </div>
      </header>
      <CustomerAuth onAuth={onAuth} />
      <SellerContact settings={settings} customer={customer} />
    </div>
  )
}

function ContactDetails({ settings }) {
  const phone = settings?.contact_phone
  const email = settings?.contact_email
  const note = settings?.contact_note
  if (!phone && !email && !note) return null
  return (
    <div className="seller-contact contact-only">
      <h2>Данни за контакт</h2>
      {phone && (
        <p>
          <span className="contact-label">Телефон:</span> <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
        </p>
      )}
      {email && (
        <p>
          <span className="contact-label">Имейл:</span> <a href={`mailto:${email}`}>{email}</a>
        </p>
      )}
      {note && <p className="contact-note">{note}</p>}
    </div>
  )
}

function SellerChat({ customer }) {
  const [messages, setMessages] = useState(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function load() {
    return getThread(customer.token)
      .then((m) => setMessages(m || []))
      .catch(() => setError('Неуспешно зареждане на съобщенията.'))
  }

  useEffect(() => {
    load()
    const onFocus = () => !document.hidden && load()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function send(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setError('')
    try {
      const msg = { body: body.trim(), email: customer.email }
      await createMessage(msg, customer.token)
      notifyFormspree({ name: customer.email, email: customer.email, body: msg.body })
      setBody('')
      await load()
    } catch (err) {
      setError('Съобщението не се изпрати. ' + (err?.message || '').slice(0, 150))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="seller-contact">
      <h2>Съобщения с продавача</h2>
      <div className="chat-thread">
        {messages === null ? (
          <p className="hint">Зареждане...</p>
        ) : messages.length === 0 ? (
          <p className="hint">Напиши първото си съобщение до продавача.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.sender === 'admin' ? 'chat-msg from-admin' : 'chat-msg from-me'}>
              <p className="chat-body">{m.body}</p>
              <span className="chat-time">{formatDate(m.created_at)}</span>
            </div>
          ))
        )}
      </div>
      <form className="chat-input" onSubmit={send}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Напиши съобщение..." required />
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit" disabled={sending}>
          {sending ? 'Изпращане...' : 'Изпрати'}
        </button>
      </form>
    </div>
  )
}

function SellerContact({ settings, customer }) {
  const phone = settings?.contact_phone
  const email = settings?.contact_email
  const note = settings?.contact_note
  const [name, setName] = useState('')
  const [replyEmail, setReplyEmail] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setError('')
    try {
      const msg = {
        name: (customer ? null : name) || null,
        email: customer?.email || replyEmail || null,
        body: body.trim(),
      }
      await createMessage(msg, customer?.token)
      notifyFormspree(msg)
      setSent(true)
      setBody('')
      setName('')
      setReplyEmail('')
    } catch (err) {
      setError('Съобщението не беше изпратено. ' + (err?.message || '').slice(0, 200))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="seller-contact">
      <h2>Свържи се с продавача</h2>
      {sent ? (
        <p className="hint">Съобщението е изпратено! Продавачът ще се свърже с теб.</p>
      ) : (
        <form className="contact-form" onSubmit={submit}>
          {!customer && (
            <>
              <label>
                Име
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Имейл (за отговор)
                <input type="email" value={replyEmail} onChange={(e) => setReplyEmail(e.target.value)} />
              </label>
            </>
          )}
          <label>
            Съобщение
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required placeholder="Напиши въпроса си тук..." />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={sending}>
            {sending ? 'Изпращане...' : 'Изпрати съобщение'}
          </button>
        </form>
      )}
      {(phone || email || note) && (
        <div className="contact-details">
          <p className="hint">Или директно:</p>
          {phone && (
            <p>
              <span className="contact-label">Телефон:</span>{' '}
              <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
            </p>
          )}
          {email && (
            <p>
              <span className="contact-label">Имейл:</span> <a href={`mailto:${email}`}>{email}</a>
            </p>
          )}
          {note && <p className="contact-note">{note}</p>}
        </div>
      )}
    </div>
  )
}

function CustomerAuth({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(next) {
    setMode(next)
    setError('')
    setInfo('')
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'register') {
        const data = await signup(email, password)
        if (data.access_token) {
          onAuth(data)
        } else {
          setInfo('Регистрацията е успешна! Провери имейла си за потвърждение, след което влез.')
          setMode('login')
        }
      } else {
        const data = await login(email, password)
        onAuth(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
          Вход
        </button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>
          Регистрация
        </button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Имейл
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Парола
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        {error && <p className="error">{error}</p>}
        {info && <p className="hint">{info}</p>}
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Моля изчакай...' : mode === 'register' ? 'Регистрирай се' : 'Вход'}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MyOrders (история на поръчките в Профил + отказване)
// ---------------------------------------------------------------------------

function MyOrders({ token, currency }) {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    let active = true
    getMyOrders(token)
      .then((o) => active && setOrders(o || []))
      .catch(() => active && setError('Неуспешно зареждане на поръчките.'))
    return () => {
      active = false
    }
  }, [token])

  async function cancel(id) {
    if (!window.confirm('Сигурни ли сте, че искате да откажете тази поръчка?')) return
    setBusy(id)
    setError('')
    try {
      await cancelMyOrder(token, id)
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: 'отказана' } : o)))
    } catch {
      setError('Неуспешно отказване на поръчката.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="my-orders">
      <h2>Моите поръчки</h2>
      {error && <p className="error">{error}</p>}
      {orders === null ? (
        <p className="hint">Зареждане на поръчките...</p>
      ) : orders.length === 0 ? (
        <p className="hint">Още нямаш поръчки.</p>
      ) : (
        orders.map((o) => (
          <div className="order-card" key={o.id}>
            <div className="order-card-header">
              <span className="order-date">{formatDate(o.created_at)}</span>
              <span className={`status status-${statusClass(o.status)}`}>{o.status}</span>
            </div>
            <ul className="order-items">
              {(o.items || []).map((it, idx) => (
                <li key={idx}>
                  {it.qty} × {it.name} — {money(it.price * it.qty, o.currency || currency)}
                  {it.variant && <span className="item-note"> · Дизайн: {it.variant}</span>}
                  {it.note && <span className="item-note"> · Заявка: {it.note}</span>}
                </li>
              ))}
            </ul>
            <div className="order-card-footer">
              <strong>Общо: {money(o.total, o.currency || currency)}</strong>
              {o.status === 'нова' && (
                <button className="order-cancel" disabled={busy === o.id} onClick={() => cancel(o.id)}>
                  {busy === o.id ? 'Отказване...' : 'Откажи поръчката'}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProductPage (отделна страница за продукт)
// ---------------------------------------------------------------------------

function ProductPage({ productId, settings, customer, addToCart, favorites, toggleFavorite }) {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState(false)
  const [mainIdx, setMainIdx] = useState(0)
  const [note, setNote] = useState('')
  const [variant, setVariant] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    getProduct(productId)
      .then((p) => active && setProduct(p || null))
      .catch(() => active && setProduct(null))
      .finally(() => active && setLoading(false))
  }, [productId])

  const currency = settings?.currency || '€'
  const isFav = product && favorites.includes(product.id)

  return (
    <div className="shop">
      <header className="shop-header">
        <a className="back-link" href="#">
          ← Към магазина
        </a>
      </header>

      {loading ? (
        <p className="hint">Зареждане...</p>
      ) : !product ? (
        <p className="hint">
          Продуктът не е намерен. <a href="#">Обратно към магазина</a>
        </p>
      ) : (
        (() => {
          const gallery = Array.isArray(product.images) && product.images.length ? product.images : isUrl(product.image) ? [product.image] : []
          const shown = gallery[mainIdx] || gallery[0]
          const nvars = normVariants(product)
          const chosen = variant || (nvars[0] && nvars[0].name) || ''
          const chosenStock = nvars.length ? variantStock(product, chosen) : null // null = без следене
          const variantOut = nvars.length > 0 && chosenStock === 0
          const canAdd =
            (product.custom ? note.trim().length > 0 : nvars.length ? !variantOut : product.stock > 0) &&
            (nvars.length === 0 || !!chosen)
          return (
            <div className="product-page">
              <div>
                <div className="product-page-image">
                  {isOnSale(product) && <span className="sale-badge">-{discountPercent(product)}%</span>}
                  {product.custom && <span className="custom-badge">★ По заявка</span>}
                  {shown ? <img src={shown} alt={product.name} /> : <span className="emoji">{product.image || '📦'}</span>}
                </div>
                {gallery.length > 1 && (
                  <div className="gallery-thumbs">
                    {gallery.map((url, idx) => (
                      <button
                        key={url}
                        className={idx === mainIdx ? 'gthumb active' : 'gthumb'}
                        onClick={() => setMainIdx(idx)}
                        type="button"
                      >
                        <img src={url} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="product-page-info">
                <div className="product-page-title">
                  <h1>{product.name}</h1>
                  <button
                    className={isFav ? 'fav-btn active' : 'fav-btn'}
                    title={isFav ? 'Премахни от любими' : 'Добави в любими'}
                    aria-label="Любими"
                    onClick={() => toggleFavorite(product.id)}
                  >
                    <Heart size={22} fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                </div>
                {product.category && <span className="product-detail-category">{product.category}</span>}
                {isOnSale(product) ? (
                  <div className="product-detail-price">
                    <s className="old-price">{money(product.price, currency)}</s>{' '}
                    <span className="sale-price">{money(product.sale_price, currency)}</span>
                  </div>
                ) : (
                  <div className="product-detail-price">{money(product.price, currency)}</div>
                )}
                {!product.custom && nvars.length === 0 && (
                  <p className={product.stock > 0 ? 'product-detail-stock' : 'product-detail-stock out'}>
                    {product.stock > 0 ? `Налични: ${product.stock} бр.` : 'Изчерпан'}
                  </p>
                )}
                {product.description && <p className="product-detail-desc">{product.description}</p>}

                {nvars.length > 0 && (
                  <div className="variant-pick">
                    <span className="variant-pick-label">Дизайн / цвят:</span>
                    <div className="variant-options">
                      {nvars.map((v) => {
                        const out = v.stock === 0
                        return (
                          <button
                            key={v.name}
                            type="button"
                            className={`${chosen === v.name ? 'variant-opt active' : 'variant-opt'}${out ? ' out' : ''}`}
                            disabled={out}
                            onClick={() => setVariant(v.name)}
                          >
                            {v.name}
                            {out ? ' (изчерпан)' : ''}
                          </button>
                        )
                      })}
                    </div>
                    {chosenStock != null && (
                      <p className={chosenStock > 0 ? 'product-detail-stock' : 'product-detail-stock out'}>
                        {chosenStock > 0 ? `Налични: ${chosenStock} бр.` : 'Изчерпан'}
                      </p>
                    )}
                  </div>
                )}

                {product.custom && (
                  <label className="custom-req">
                    Опиши какво искаш да ти направя (по заявка)
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="напр. фигурка 10см, син цвят, с надпис..."
                    />
                  </label>
                )}

                <button
                  className="primary"
                  disabled={!canAdd}
                  onClick={() => {
                    addToCart(product, product.custom ? note.trim() : undefined, chosen || undefined)
                    setAdded(true)
                    setNote('')
                  }}
                >
                  {product.custom
                    ? 'Добави заявката в количката'
                    : nvars.length
                      ? variantOut
                        ? 'Изчерпан'
                        : 'Добави в количката'
                      : product.stock <= 0
                        ? 'Изчерпан'
                        : 'Добави в количката'}
                </button>
                {product.custom && !note.trim() && <p className="hint">Опиши заявката, за да продължиш.</p>}
                {added && (
                  <p className="added-msg">
                    Добавено в количката! <a href="#cart">Виж количката →</a>
                  </p>
                )}
              </div>
            </div>
          )
        })()
      )}

      {product && <Reviews productId={product.id} customer={customer} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reviews (отзиви за продукт)
// ---------------------------------------------------------------------------

function Stars({ value }) {
  return (
    <span className="stars" aria-label={`${value} от 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'star on' : 'star'}>
          ★
        </span>
      ))}
    </span>
  )
}

function Reviews({ productId, customer }) {
  const [reviews, setReviews] = useState(null)
  const [rating, setRating] = useState(5)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function load() {
    return getReviews(productId)
      .then((r) => setReviews(r || []))
      .catch(() => setError('Неуспешно зареждане на отзивите.'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const isAdmin = customer?.email === ADMIN_EMAIL
  const avg = reviews && reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

  async function submit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError('')
    try {
      await createReview(customer.token, {
        product_id: productId,
        rating,
        body: body.trim(),
        author_name: name.trim() || customer.email,
      })
      setBody('')
      setName('')
      setRating(5)
      await load()
    } catch {
      setError('Отзивът не се запази.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    if (!window.confirm('Да изтрия ли този отзив?')) return
    try {
      await deleteReview(customer.token, id)
      setReviews((rs) => rs.filter((r) => r.id !== id))
    } catch {
      setError('Неуспешно изтриване.')
    }
  }

  return (
    <div className="reviews">
      <div className="reviews-head">
        <h2>Отзиви</h2>
        {reviews && reviews.length > 0 && (
          <span className="reviews-avg">
            <Stars value={Math.round(avg)} /> {avg.toFixed(1)} ({reviews.length})
          </span>
        )}
      </div>

      {customer ? (
        <form className="review-form" onSubmit={submit}>
          <label>
            Оценка
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} звезди
                </option>
              ))}
            </select>
          </label>
          <label>
            Име (по желание)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как да се показва" />
          </label>
          <label>
            Отзив
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required placeholder="Сподели мнението си..." />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Изпращане...' : 'Публикувай отзив'}
          </button>
        </form>
      ) : (
        <p className="hint">
          <a href="#profile">Влез в профила си</a>, за да оставиш отзив.
        </p>
      )}

      {reviews === null ? (
        <p className="hint">Зареждане...</p>
      ) : reviews.length === 0 ? (
        <p className="hint">Още няма отзиви за този продукт.</p>
      ) : (
        <div className="review-list">
          {reviews.map((r) => (
            <div className="review-item" key={r.id}>
              <div className="review-top">
                <strong>{r.author_name || 'Клиент'}</strong>
                <Stars value={r.rating} />
              </div>
              {r.body && <p className="review-body">{r.body}</p>}
              <div className="review-meta">
                <span>{formatDate(r.created_at)}</span>
                {(isAdmin || (customer && r.user_id === customer.id)) && (
                  <button className="review-del" onClick={() => remove(r.id)}>
                    Изтрий
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AuthGate (вход за администратор)
// ---------------------------------------------------------------------------

function AuthGate({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await login(email, password)
      onLogin(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-gate">
      <form className="auth-form" onSubmit={submit} autoComplete="off">
        <h2>Вход за администратор</h2>
        <label>
          Имейл
          <input
            type="email"
            name="admin-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="off"
          />
        </label>
        <label>
          Парола
          <PasswordInput
            name="admin-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Вход...' : 'Вход'}
        </button>
        <a className="back-link" href="#">
          ← Обратно към магазина
        </a>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

function Admin({ session, settings, onSettingsChange, onLogout }) {
  const [tab, setTab] = useState('orders')

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>Администраторски панел</h1>
        <div className="admin-header-right">
          <span>{session.email}</span>
          <button onClick={onLogout}>Изход</button>
          <a href="#">Към магазина</a>
        </div>
      </header>

      <nav className="admin-tabs">
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          Поръчки
        </button>
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
          Продукти
        </button>
        <button className={tab === 'messages' ? 'active' : ''} onClick={() => setTab('messages')}>
          Съобщения
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          Настройки
        </button>
      </nav>

      <main className="admin-content">
        {tab === 'orders' && <Orders token={session.token} />}
        {tab === 'products' && <ProductsAdmin token={session.token} />}
        {tab === 'messages' && <Messages token={session.token} />}
        {tab === 'settings' && <SettingsPanel token={session.token} settings={settings} onChange={onSettingsChange} />}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Orders (админ преглед и смяна на статус)
// ---------------------------------------------------------------------------

function statusClass(status) {
  return { нова: 'new', изпратена: 'shipped', приключена: 'done', отказана: 'cancelled' }[status] || 'new'
}

function Orders({ token }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState({})
  const [sent, setSent] = useState({})
  const [sendingMsg, setSendingMsg] = useState(null)

  async function messageCustomer(o) {
    const text = (drafts[o.id] || '').trim()
    if (!text) return
    setSendingMsg(o.id)
    try {
      await createMessage({ user_id: o.user_id, body: `Относно поръчка от ${formatDate(o.created_at)}:\n${text}`, sender: 'admin' }, token)
      setDrafts((d) => ({ ...d, [o.id]: '' }))
      setSent((s) => ({ ...s, [o.id]: true }))
    } catch {
      setError('Съобщението не се изпрати.')
    } finally {
      setSendingMsg(null)
    }
  }

  useEffect(() => {
    load()
    const refresh = () => {
      if (document.hidden) return
      getOrders(token)
        .then(setOrders)
        .catch(() => {})
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setOrders(await getOrders(token))
    } catch {
      setError('Неуспешно зареждане на поръчките.')
    } finally {
      setLoading(false)
    }
  }

  async function changeStatus(id, status) {
    const updated = await updateOrderStatus(token, id, status)
    setOrders((os) => os.map((o) => (o.id === id ? updated : o)))
  }

  async function remove(id) {
    if (!window.confirm('Сигурни ли сте, че искате да изтриете тази поръчка?')) return
    await deleteOrder(token, id)
    setOrders((os) => os.filter((o) => o.id !== id))
  }

  if (loading) return <p className="hint">Зареждане...</p>
  if (error) return <p className="error">{error}</p>
  if (orders.length === 0) return <p className="hint">Все още няма поръчки.</p>

  return (
    <div className="orders-list">
      {orders.map((o) => (
        <div className="order-card" key={o.id}>
          <div className="order-card-header">
            <div>
              <strong>{o.customer_name}</strong> · {o.customer_phone}
              <div className="hint">
                {o.customer_city}, {o.customer_address}
              </div>
            </div>
            <span className={`status status-${statusClass(o.status)}`}>{o.status}</span>
          </div>
          <ul className="order-items">
            {(o.items || []).map((it, idx) => (
              <li key={idx}>
                {it.qty} × {it.name} — {money(it.price * it.qty, o.currency)}
                {it.variant && <span className="item-note"> · Дизайн: {it.variant}</span>}
                {it.note && <span className="item-note"> · Заявка: {it.note}</span>}
              </li>
            ))}
          </ul>
          {o.notes && <p className="hint">Бележка: {o.notes}</p>}
          <div className="order-card-footer">
            <strong>Общо: {money(o.total, o.currency)}</strong>
            <div className="order-card-actions">
              <select value={o.status} onChange={(e) => changeStatus(o.id, e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button className="order-delete" onClick={() => remove(o.id)} title="Изтрий поръчката" aria-label="Изтрий поръчката">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {o.user_id ? (
            <form
              className="order-msg"
              onSubmit={(e) => {
                e.preventDefault()
                messageCustomer(o)
              }}
            >
              <textarea
                value={drafts[o.id] || ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [o.id]: e.target.value }))}
                placeholder="Съобщение до клиента за тази поръчка..."
              />
              <div className="order-msg-row">
                {sent[o.id] && <span className="hint">Изпратено ✓</span>}
                <button className="primary" type="submit" disabled={sendingMsg === o.id}>
                  {sendingMsg === o.id ? 'Изпращане...' : 'Пиши на клиента'}
                </button>
              </div>
            </form>
          ) : (
            <p className="hint order-msg-guest">
              Гост-поръчка — свържи се по телефон: <a href={`tel:${(o.customer_phone || '').replace(/\s+/g, '')}`}>{o.customer_phone}</a>
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Messages (админ — съобщения от клиенти)
// ---------------------------------------------------------------------------

function Messages({ token }) {
  const [messages, setMessages] = useState(null)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(false)

  function load() {
    return getMessages(token)
      .then((m) => setMessages(m || []))
      .catch(() => setError('Неуспешно зареждане на съобщенията.'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function reply(userId, key) {
    const text = (drafts[key] || '').trim()
    if (!text) return
    setBusy(true)
    setError('')
    try {
      await createMessage({ user_id: userId, body: text, sender: 'admin' }, token)
      setDrafts((d) => ({ ...d, [key]: '' }))
      await load()
    } catch {
      setError('Отговорът не се изпрати.')
    } finally {
      setBusy(false)
    }
  }

  async function removeConversation(ids) {
    if (!window.confirm('Да изтрия ли целия разговор?')) return
    setBusy(true)
    try {
      for (const id of ids) await deleteMessage(token, id)
      await load()
    } catch {
      setError('Неуспешно изтриване.')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="error">{error}</p>
  if (messages === null) return <p className="hint">Зареждане...</p>
  if (messages.length === 0) return <p className="hint">Все още няма съобщения.</p>

  // Групиране в разговори по клиент (user_id), а гостите — по имейл/id.
  const groups = {}
  const order = []
  for (const m of messages) {
    const key = m.user_id ? `u:${m.user_id}` : `g:${m.email || m.id}`
    if (!groups[key]) {
      groups[key] = { key, userId: m.user_id || null, label: m.email || m.name || 'Гост', msgs: [] }
      order.push(key)
    }
    groups[key].msgs.push(m)
  }
  // Съобщенията идват в низходящ ред; за нишката ги подреждаме възходящо.
  for (const key of order) groups[key].msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  return (
    <div className="orders-list">
      {order.map((key) => {
        const conv = groups[key]
        const ids = conv.msgs.map((m) => m.id)
        return (
          <div className="order-card" key={key}>
            <div className="order-card-header">
              <div>
                <strong>{conv.label}</strong>
                {!conv.userId && <div className="hint">гост (не може да получава отговори в сайта)</div>}
              </div>
              <button className="order-delete" onClick={() => removeConversation(ids)} disabled={busy} title="Изтрий разговора" aria-label="Изтрий">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="chat-thread">
              {conv.msgs.map((m) => (
                <div key={m.id} className={m.sender === 'admin' ? 'chat-msg from-me' : 'chat-msg from-admin'}>
                  <p className="chat-body">{m.body}</p>
                  <span className="chat-time">{formatDate(m.created_at)}</span>
                </div>
              ))}
            </div>

            {conv.userId ? (
              <form
                className="chat-input"
                onSubmit={(e) => {
                  e.preventDefault()
                  reply(conv.userId, key)
                }}
              >
                <textarea
                  value={drafts[key] || ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                  placeholder="Отговори на клиента..."
                />
                <button className="primary" type="submit" disabled={busy}>
                  Отговори
                </button>
              </form>
            ) : (
              conv.label.includes('@') && (
                <a
                  className="message-reply"
                  href={`mailto:${conv.label}?subject=${encodeURIComponent('Отговор на вашето съобщение')}`}
                >
                  Отговори по имейл
                </a>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProductsAdmin
// ---------------------------------------------------------------------------

function ProductsAdmin({ token }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    load()
    // Тихо обновяване при връщане към таба (без индикатор за зареждане).
    const refresh = () => {
      if (document.hidden) return
      getProducts()
        .then(setProducts)
        .catch(() => {})
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setProducts(await getProducts())
    } catch {
      setError('Неуспешно зареждане на продуктите.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(product) {
    if (product.id) {
      const { id, ...patch } = product
      const updated = await updateProduct(token, id, patch)
      setProducts((ps) => ps.map((p) => (p.id === id ? updated : p)))
    } else {
      const created = await createProduct(token, product)
      setProducts((ps) => [created, ...ps])
    }
    setEditing(null)
  }

  async function handleDelete(id) {
    if (!window.confirm('Изтриване на продукта?')) return
    await deleteProduct(token, id)
    setProducts((ps) => ps.filter((p) => p.id !== id))
  }

  return (
    <div>
      <div className="admin-toolbar">
        <button className="primary" onClick={() => setEditing({})}>
          <Plus size={16} /> Нов продукт
        </button>
      </div>
      {loading ? (
        <p className="hint">Зареждане...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Име</th>
              <th>Категория</th>
              <th>Цена</th>
              <th>Наличност</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="emoji-cell">{isUrl(p.image) ? <img src={p.image} alt="" /> : p.image}</td>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>{money(p.price)}</td>
                <td>{p.stock}</td>
                <td className="row-actions">
                  <button className="icon-btn" onClick={() => setEditing(p)}>
                    <Pencil size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => handleDelete(p.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Редакция на продукт' : 'Нов продукт'}>
        {editing && <ProductForm product={editing} token={token} onSave={handleSave} onCancel={() => setEditing(null)} />}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProductForm
// ---------------------------------------------------------------------------

function ProductForm({ product, token, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: product.name || '',
    price: product.price ?? '',
    sale_price: product.sale_price ?? '',
    category: product.category || '',
    image: product.image || '',
    images: Array.isArray(product.images) && product.images.length ? product.images : isUrl(product.image) ? [product.image] : [],
    variants: normVariants(product),
    custom: !!product.custom,
    stock: product.stock ?? 0,
    description: product.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [variantInput, setVariantInput] = useState('')
  const [variantStockInput, setVariantStockInput] = useState('')
  const [error, setError] = useState('')

  function addVariant() {
    const name = variantInput.trim()
    if (!name || form.variants.some((v) => v.name === name)) {
      setVariantInput('')
      setVariantStockInput('')
      return
    }
    const stock = variantStockInput === '' ? 0 : Number(variantStockInput) || 0
    setForm((f) => ({ ...f, variants: [...f.variants, { name, stock }] }))
    setVariantInput('')
    setVariantStockInput('')
  }
  function removeVariant(name) {
    setForm((f) => ({ ...f, variants: f.variants.filter((v) => v.name !== name) }))
  }
  function setVariantStockValue(name, stock) {
    setForm((f) => ({ ...f, variants: f.variants.map((v) => (v.name === name ? { ...v, stock: stock === '' ? 0 : Number(stock) || 0 } : v)) }))
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    setError('')
    try {
      const urls = []
      for (const file of files) urls.push(await uploadProductImage(token, file))
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }))
    } catch {
      setError('Неуспешно качване на снимка.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function removeImage(url) {
    setForm((f) => ({ ...f, images: f.images.filter((u) => u !== url) }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name || form.price === '') {
      setError('Име и цена са задължителни.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        ...(product.id ? { id: product.id } : {}),
        name: form.name,
        price: Number(form.price),
        sale_price: form.sale_price === '' || form.sale_price === null ? null : Number(form.sale_price),
        category: form.category || null,
        image: form.images[0] || form.image || '📦',
        images: form.images,
        variants: form.variants,
        custom: form.custom,
        stock: Number(form.stock) || 0,
        description: form.description || null,
      })
    } catch {
      setError('Неуспешно записване.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="product-form" onSubmit={submit}>
      <label>
        Име*
        <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
      </label>
      <label>
        Цена*
        <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => update('price', e.target.value)} required />
      </label>
      <label>
        Промоцена (намаление) — остави празно за без промоция
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.sale_price}
          onChange={(e) => update('sale_price', e.target.value)}
          placeholder="напр. 19.99"
        />
      </label>
      <label>
        Категория
        <input value={form.category} onChange={(e) => update('category', e.target.value)} />
      </label>
      <label>
        Емоджи или URL (ако няма качени снимки)
        <input value={form.image} onChange={(e) => update('image', e.target.value)} placeholder="📦 или https://..." />
      </label>
      <div className="image-upload">
        <label className="upload-btn">
          {uploading ? 'Качване...' : 'Качи снимки от устройство'}
          <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} hidden />
        </label>
      </div>
      {form.images.length > 0 && (
        <div className="image-gallery-edit">
          {form.images.map((url, idx) => (
            <div className="thumb" key={url}>
              <img src={url} alt="" />
              {idx === 0 && <span className="thumb-main">Главна</span>}
              <button type="button" className="thumb-del" onClick={() => removeImage(url)} aria-label="Премахни">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label>
        Дизайни / цветове (всеки със своя наличност; клиентът избира един)
        <div className="variant-add">
          <input
            value={variantInput}
            onChange={(e) => setVariantInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addVariant()
              }
            }}
            placeholder="Име (напр. Червен)"
          />
          <input
            type="number"
            min="0"
            className="variant-stock-in"
            value={variantStockInput}
            onChange={(e) => setVariantStockInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addVariant()
              }
            }}
            placeholder="бр."
          />
          <button type="button" onClick={addVariant}>
            Добави
          </button>
        </div>
      </label>
      {form.variants.length > 0 && (
        <div className="variant-rows">
          {form.variants.map((v) => (
            <div className="variant-row" key={v.name}>
              <span className="variant-row-name">{v.name}</span>
              <input
                type="number"
                min="0"
                value={v.stock ?? 0}
                onChange={(e) => setVariantStockValue(v.name, e.target.value)}
                title="Наличност за този дизайн"
              />
              <span className="variant-row-unit">бр.</span>
              <button type="button" className="icon-btn" onClick={() => removeVariant(v.name)} aria-label="Премахни">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="custom-toggle">
        <button
          type="button"
          className={form.custom ? 'star-btn on' : 'star-btn'}
          onClick={() => update('custom', !form.custom)}
          aria-label="Поръчка по заявка"
        >
          ★
        </button>
        Поръчка по заявка (клиентът пише какво иска да му направиш)
      </label>
      <label>
        Наличност
        <input type="number" min="0" value={form.stock} onChange={(e) => update('stock', e.target.value)} />
      </label>
      <label>
        Описание
        <textarea value={form.description} onChange={(e) => update('description', e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Отказ
        </button>
        <button className="primary" type="submit" disabled={saving}>
          {saving ? 'Запазване...' : 'Запази'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// SettingsPanel
// ---------------------------------------------------------------------------

function SettingsPanel({ token, settings, onChange }) {
  const [form, setForm] = useState({
    shop_name: settings?.shop_name || '',
    tagline: settings?.tagline || '',
    currency: settings?.currency || '€',
    contact_phone: settings?.contact_phone || '',
    contact_email: settings?.contact_email || '',
    contact_note: settings?.contact_note || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (settings) {
      setForm({
        shop_name: settings.shop_name || '',
        tagline: settings.tagline || '',
        currency: settings.currency || '€',
        contact_phone: settings.contact_phone || '',
        contact_email: settings.contact_email || '',
        contact_note: settings.contact_note || '',
      })
    }
  }, [settings])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const updated = await updateSettings(token, form)
      onChange(updated)
      setSaved(true)
    } catch {
      setError('Неуспешно запазване на настройките.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        Име на магазина
        <input value={form.shop_name} onChange={(e) => update('shop_name', e.target.value)} />
      </label>
      <label>
        Слоган
        <input value={form.tagline} onChange={(e) => update('tagline', e.target.value)} />
      </label>
      <label>
        Валута
        <input value={form.currency} onChange={(e) => update('currency', e.target.value)} />
      </label>

      <h3 className="settings-subtitle">Данни за контакт (виждат се в „Профил“ → „Свържи се с продавача“)</h3>
      <label>
        Телефон
        <input value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} placeholder="напр. 0888 123 456" />
      </label>
      <label>
        Имейл
        <input type="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} placeholder="напр. shop@example.com" />
      </label>
      <label>
        Допълнителна бележка
        <textarea
          value={form.contact_note}
          onChange={(e) => update('contact_note', e.target.value)}
          placeholder="напр. работно време, Viber, адрес..."
        />
      </label>
      {error && <p className="error">{error}</p>}
      {saved && <p className="hint">Запазено.</p>}
      <button className="primary" type="submit" disabled={saving}>
        {saving ? 'Запазване...' : 'Запази'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

function Checkout({ cart, total, currency, onComplete, customerToken }) {
  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name || !form.phone || !form.city || !form.address) {
      setError('Моля, попълнете всички задължителни полета.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createOrder(
        {
          customer_name: form.name,
          customer_phone: form.phone,
          customer_city: form.city,
          customer_address: form.address,
          notes: form.notes || null,
          items: cart.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, variant: i.variant || null, note: i.note || null })),
          total,
          currency,
          payment: 'Наложен платеж',
        },
        customerToken,
      )
      const summary = cart
        .map((i) => `${i.qty} × ${i.name}${i.variant ? ` (Дизайн: ${i.variant})` : ''}${i.note ? ` (Заявка: ${i.note})` : ''} — ${money(i.price * i.qty, currency)}`)
        .join('\n')
      notifyFormspree({
        subject: 'Нова поръчка от магазина',
        name: form.name,
        email: '',
        body: `НОВА ПОРЪЧКА\nКлиент: ${form.name}\nТелефон: ${form.phone}\nАдрес: ${form.city}, ${form.address}\n${
          form.notes ? `Бележка: ${form.notes}\n` : ''
        }\n${summary}\n\nОбщо: ${money(total, currency)}\nПлащане: Наложен платеж`,
      })
      onComplete()
    } catch (err) {
      const detail = (err?.message || '').slice(0, 300)
      setError('Възникна грешка при изпращане на поръчката. ' + (detail || 'Опитайте отново.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="checkout-form" onSubmit={submit}>
      <label>
        Име и фамилия*
        <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
      </label>
      <label>
        Телефон*
        <input value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
      </label>
      <label>
        Град*
        <input value={form.city} onChange={(e) => update('city', e.target.value)} required />
      </label>
      <label>
        Адрес*
        <input value={form.address} onChange={(e) => update('address', e.target.value)} required />
      </label>
      <label>
        Бележка
        <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} />
      </label>
      <div className="checkout-summary">
        <span>Общо за плащане:</span>
        <strong>{money(total, currency)}</strong>
      </div>
      <p className="hint">Плащане: наложен платеж при доставка.</p>
      {error && <p className="error">{error}</p>}
      <button className="primary" type="submit" disabled={submitting || cart.length === 0}>
        {submitting ? 'Изпращане...' : 'Потвърди поръчката'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Drawer / Modal
// ---------------------------------------------------------------------------

function Drawer({ open, onClose, title, children }) {
  return (
    <>
      <div className={`overlay ${open ? 'show' : ''}`} onClick={onClose} />
      <div className={`drawer ${open ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  )
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Style
// ---------------------------------------------------------------------------

function Style() {
  return (
    <style>{`
      :root {
        --bg: #f7f6f3;
        --surface: #ffffff;
        --text: #1f2320;
        --muted: #767a75;
        --border: #e5e3dd;
        --accent: #2f6b3e;
        --accent-dark: #23532f;
        --danger: #b3432b;
        --radius: 12px;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      button { font-family: inherit; cursor: pointer; }
      input, textarea, select { font-family: inherit; font-size: 0.95rem; }

      .hint { color: var(--muted); }
      .error { color: var(--danger); }

      /* Shop */
      .shop { max-width: 1080px; margin: 0 auto; padding: 24px 20px 96px; }

      .shop-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 20px;
      }
      .shop-header h1 { margin: 0; font-size: 1.8rem; }
      .shop-header .tagline { margin: 4px 0 0; color: var(--muted); }

      .cart-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 10px 16px;
        font-weight: 600;
      }

      .admin-fab {
        position: fixed;
        left: 20px;
        bottom: 84px;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 999px;
        color: var(--muted);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      }
      .admin-fab:hover { color: var(--accent); border-color: var(--accent); }


      .bottom-nav {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 60;
        display: flex;
        background: var(--surface);
        border-top: 1px solid var(--border);
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
      }
      .bottom-nav-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 8px 4px calc(8px + env(safe-area-inset-bottom, 0px));
        font-size: 0.72rem;
        color: var(--muted);
        text-decoration: none;
      }
      .bottom-nav-item.active { color: var(--accent); }
      .bottom-nav-icon { position: relative; display: flex; }
      .bottom-nav-badge {
        position: absolute;
        top: -6px;
        right: -10px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 999px;
        background: var(--accent);
        color: #fff;
        font-size: 0.65rem;
        line-height: 16px;
        text-align: center;
      }

      .fav-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid var(--border);
        color: var(--muted);
      }
      .fav-btn.active { color: #e0245e; border-color: #e0245e; }

      .product-page-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .product-page-title h1 { margin: 0; }
      .product-page-title .fav-btn { position: static; width: 40px; height: 40px; }

      .auth-card { max-width: 380px; margin: 0 auto; }
      .auth-tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
      .auth-tabs button {
        flex: 1;
        padding: 10px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--muted);
        font-weight: 600;
      }
      .auth-tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }
      .profile-card {
        max-width: 380px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: flex-start;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 20px;
      }
      .profile-email { font-size: 1.1rem; }
      .profile-card .primary { margin-top: 8px; }

      .seller-contact {
        max-width: 640px;
        margin: 24px auto 0;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 20px;
      }
      .seller-contact h2 { margin: 0 0 10px; font-size: 1.2rem; }
      .seller-contact p { margin: 6px 0; }
      .contact-label { color: var(--muted); }
      .contact-note { color: var(--muted); white-space: pre-wrap; }
      .settings-subtitle { margin: 8px 0 0; font-size: 1rem; }
      .contact-form { display: flex; flex-direction: column; gap: 12px; }
      .contact-details { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
      .message-body { margin: 4px 0 0; white-space: pre-wrap; line-height: 1.5; }
      .message-handled { opacity: 0.6; }
      .message-check { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; color: var(--muted); font-weight: 500; }
      .message-check input { width: auto; }
      .message-reply {
        display: inline-flex;
        align-items: center;
        background: var(--surface);
        border: 1px solid var(--accent);
        color: var(--accent);
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 0.85rem;
        font-weight: 600;
      }

      .contact-only { margin-top: 16px; }
      .chat-thread {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 340px;
        overflow-y: auto;
        padding: 4px 2px;
        margin: 8px 0 12px;
      }
      .chat-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; }
      .chat-msg .chat-body { margin: 0; white-space: pre-wrap; line-height: 1.4; }
      .chat-msg .chat-time { display: block; margin-top: 4px; font-size: 0.7rem; opacity: 0.7; }
      .chat-msg.from-me { align-self: flex-end; background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
      .chat-msg.from-admin { align-self: flex-start; background: var(--bg); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
      .chat-input { display: flex; flex-direction: column; gap: 8px; }
      .chat-input textarea { min-height: 60px; }

      .categories { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
      .chip {
        border: 1px solid var(--border);
        background: var(--surface);
        border-radius: 999px;
        padding: 6px 14px;
        font-size: 0.85rem;
      }
      .chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }

      .product-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
      }
      .product-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 16px;
        display: flex;
        flex-direction: column;
        cursor: pointer;
        color: inherit;
        text-decoration: none;
        transition: box-shadow 0.15s, transform 0.15s;
      }
      .product-card:hover { box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1); transform: translateY(-2px); }

      .back-link { font-size: 0.95rem; font-weight: 600; color: var(--muted); }
      .back-link:hover { color: var(--accent); }
      .product-page { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start; }
      @media (max-width: 640px) { .product-page { grid-template-columns: 1fr; } }
      .product-page-image {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        min-height: 300px;
        overflow: hidden;
      }
      .product-page-image img { max-width: 100%; max-height: 420px; object-fit: contain; }
      .product-page-image .emoji { font-size: 8rem; }
      .product-page-info { display: flex; flex-direction: column; gap: 12px; }
      .product-page-info h1 { margin: 0; font-size: 1.8rem; }
      .added-msg { margin: 4px 0 0; color: var(--accent); font-size: 0.9rem; }
      .product-detail-category {
        align-self: flex-start;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 3px 12px;
        font-size: 0.8rem;
        color: var(--muted);
      }
      .product-detail-price { font-size: 1.5rem; font-weight: 700; }
      .product-detail-stock { margin: 0; color: var(--muted); font-size: 0.9rem; }
      .product-detail-stock.out { color: #dc2626; font-weight: 600; }
      .product-detail-desc { margin: 4px 0; color: var(--text); line-height: 1.5; white-space: pre-wrap; }
      .product-image {
        position: relative;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg);
        border-radius: var(--radius);
        margin-bottom: 12px;
        overflow: hidden;
      }
      .product-image img { max-width: 100%; max-height: 100%; object-fit: cover; }
      .product-image .emoji { font-size: 3rem; }
      .product-card h3 { margin: 0 0 4px; font-size: 1.05rem; }
      .product-card .desc { color: var(--muted); font-size: 0.85rem; margin: 0 0 12px; flex-grow: 1; }
      .low-stock { margin: 0 0 10px; color: #dc2626; font-size: 0.8rem; font-weight: 600; }

      .sale-badge {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 1;
        background: #dc2626;
        color: #fff;
        font-size: 0.78rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 999px;
      }
      .price-wrap { display: flex; flex-direction: column; line-height: 1.1; }
      .old-price { color: var(--muted); font-size: 0.85rem; }
      .sale-price { color: #dc2626; }
      .product-detail-price .old-price { font-size: 1rem; font-weight: 400; }
      .product-detail-price .sale-price { color: #dc2626; }

      .stars { white-space: nowrap; }
      .stars .star { color: var(--border); }
      .stars .star.on { color: #f5a623; }

      .reviews { max-width: 640px; margin: 32px auto 0; }
      .reviews-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .reviews-head h2 { margin: 0; font-size: 1.3rem; }
      .reviews-avg { color: var(--muted); font-size: 0.9rem; }
      .review-form { display: flex; flex-direction: column; gap: 10px; margin: 14px 0 20px; }
      .review-list { display: flex; flex-direction: column; gap: 12px; }
      .review-item { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
      .review-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .review-body { margin: 6px 0; line-height: 1.5; white-space: pre-wrap; }
      .review-meta { display: flex; align-items: center; justify-content: space-between; color: var(--muted); font-size: 0.8rem; }
      .review-del { background: none; border: none; color: var(--danger); font-size: 0.8rem; padding: 0; }

      .custom-badge {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 1;
        background: #7c3aed;
        color: #fff;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 999px;
      }
      .product-page-image .custom-badge { top: 8px; left: 8px; }
      .gallery-thumbs { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
      .gthumb { width: 60px; height: 60px; border: 2px solid var(--border); border-radius: 8px; overflow: hidden; padding: 0; background: var(--bg); }
      .gthumb.active { border-color: var(--accent); }
      .gthumb img { width: 100%; height: 100%; object-fit: cover; }
      .image-gallery-edit { display: flex; gap: 10px; flex-wrap: wrap; }
      .thumb { position: relative; width: 72px; height: 72px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
      .thumb img { width: 100%; height: 100%; object-fit: cover; }
      .thumb-del {
        position: absolute; top: 2px; right: 2px;
        width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.6); color: #fff; border: none; border-radius: 999px;
      }
      .thumb-main { position: absolute; bottom: 0; left: 0; right: 0; background: var(--accent); color: #fff; font-size: 0.6rem; text-align: center; }
      .custom-toggle { flex-direction: row; align-items: center; gap: 8px; }
      .star-btn { width: 34px; height: 34px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--border); font-size: 1.1rem; }
      .star-btn.on { color: #f5a623; border-color: #f5a623; }
      .custom-req textarea { min-height: 70px; }
      .variant-add { display: flex; gap: 8px; }
      .variant-add input { flex: 1; }
      .variant-add .variant-stock-in { flex: 0 0 80px; }
      .variant-add button { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0 14px; font-weight: 600; white-space: nowrap; }
      .variant-rows { display: flex; flex-direction: column; gap: 8px; }
      .variant-row { display: flex; align-items: center; gap: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; }
      .variant-row-name { flex: 1; font-weight: 500; }
      .variant-row input { width: 80px; }
      .variant-row-unit { color: var(--muted); font-size: 0.85rem; }
      .variant-opt.out { opacity: 0.5; text-decoration: line-through; cursor: not-allowed; }
      .card-choose { background: var(--accent); color: #fff; border-radius: 8px; padding: 8px 14px; font-weight: 600; font-size: 0.9rem; }
      .variant-pick { margin: 4px 0; }
      .variant-pick-label { display: block; font-size: 0.85rem; color: var(--muted); margin-bottom: 6px; }
      .variant-options { display: flex; flex-wrap: wrap; gap: 8px; }
      .variant-opt { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 7px 14px; font-size: 0.9rem; font-weight: 500; }
      .variant-opt.active { background: var(--accent); color: #fff; border-color: var(--accent); }
      .cart-variant { color: var(--accent); }
      .cart-note { color: #7c3aed; }
      .item-note { color: #7c3aed; }
      .product-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
      .product-footer button {
        background: var(--accent);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 8px 14px;
        font-weight: 600;
      }
      .product-footer button:disabled { background: var(--border); color: var(--muted); cursor: not-allowed; }


      /* Buttons */
      .primary {
        background: var(--accent);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-weight: 600;
      }
      .primary:hover { background: var(--accent-dark); }
      .primary:disabled { background: var(--border); color: var(--muted); cursor: not-allowed; }

      .icon-btn {
        background: none;
        border: none;
        color: var(--muted);
        padding: 4px;
        display: inline-flex;
        border-radius: 6px;
      }
      .icon-btn:hover { background: var(--bg); color: var(--text); }

      /* Overlay / Drawer / Modal */
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.35);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        z-index: 40;
      }
      .overlay.show { opacity: 1; pointer-events: auto; }

      .drawer {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(380px, 100%);
        background: var(--surface);
        transform: translateX(100%);
        transition: transform 0.25s ease;
        z-index: 50;
        display: flex;
        flex-direction: column;
      }
      .drawer.open { transform: translateX(0); }
      .drawer-header, .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
      }
      .drawer-header h2, .modal-header h2 { margin: 0; font-size: 1.1rem; }
      .drawer-body { padding: 16px 20px; overflow-y: auto; flex-grow: 1; }

      .cart-items { display: flex; flex-direction: column; gap: 12px; }
      .cart-item { display: flex; align-items: center; gap: 10px; }
      .cart-item .emoji { font-size: 1.6rem; width: 36px; text-align: center; }
      .cart-item .emoji img { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; }
      .cart-item-info { flex-grow: 1; display: flex; flex-direction: column; }
      .cart-item-info small { color: var(--muted); }
      .cart-item input[type='number'] { width: 50px; padding: 4px; border: 1px solid var(--border); border-radius: 6px; }

      .cart-total {
        display: flex;
        justify-content: space-between;
        margin: 16px 0;
        font-size: 1.1rem;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }

      .modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--surface);
        border-radius: var(--radius);
        width: min(480px, 92vw);
        max-height: 88vh;
        display: flex;
        flex-direction: column;
        z-index: 51;
      }
      .modal-body { padding: 20px; overflow-y: auto; }

      /* Forms */
      .checkout-form, .product-form, .settings-form, .auth-form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      label { display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; font-weight: 500; }
      input, textarea, select {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 9px 12px;
        background: #fff;
        color: var(--text);
      }
      textarea { resize: vertical; min-height: 60px; }

      .pw-field { position: relative; display: flex; }
      .pw-field input { flex: 1; padding-right: 42px; width: 100%; }
      .pw-eye {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: none;
        border: none;
        color: var(--muted);
        cursor: pointer;
      }
      .pw-eye:hover { color: var(--accent); }

      .image-upload { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .upload-btn {
        display: inline-flex;
        align-items: center;
        cursor: pointer;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 9px 14px;
        font-size: 0.9rem;
        font-weight: 500;
      }
      .upload-btn:hover { border-color: var(--accent); color: var(--accent); }
      .image-preview {
        width: 56px;
        height: 56px;
        object-fit: cover;
        border-radius: 8px;
        border: 1px solid var(--border);
      }

      .checkout-summary { display: flex; justify-content: space-between; font-size: 1.05rem; }
      .form-actions { display: flex; justify-content: flex-end; gap: 10px; }
      .form-actions button:not(.primary) {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 10px 18px;
      }

      /* Auth */
      .auth-gate { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
      .auth-form {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 28px;
        width: min(360px, 100%);
      }
      .auth-form h2 { margin: 0 0 4px; }
      .back-link { text-align: center; color: var(--muted); font-size: 0.85rem; text-decoration: none; margin-top: 4px; }

      /* Admin */
      .admin { max-width: 1080px; margin: 0 auto; padding: 24px 20px 60px; }
      .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .admin-header h1 { margin: 0; font-size: 1.5rem; }
      .admin-header-right { display: flex; align-items: center; gap: 14px; color: var(--muted); font-size: 0.9rem; }
      .admin-header-right a { color: var(--muted); }
      .admin-header-right button {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 6px 12px;
      }

      .admin-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border); }
      .admin-tabs button {
        background: none;
        border: none;
        padding: 10px 16px;
        font-weight: 600;
        color: var(--muted);
        border-bottom: 2px solid transparent;
      }
      .admin-tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }

      .admin-toolbar { margin-bottom: 16px; }
      .admin-toolbar .primary { display: inline-flex; align-items: center; gap: 6px; }

      .admin-table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: var(--radius); overflow: hidden; }
      .admin-table th, .admin-table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
      .admin-table th { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; }
      .emoji-cell { font-size: 1.4rem; width: 40px; }
      .emoji-cell img { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; }
      .row-actions { display: flex; gap: 4px; }

      .orders-list { display: flex; flex-direction: column; gap: 12px; }
      .order-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
      .order-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
      .order-items { margin: 0 0 8px; padding-left: 18px; color: var(--text); }
      .order-card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
      .order-card-actions { display: flex; align-items: center; gap: 8px; }
      .order-delete {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--muted);
      }
      .order-delete:hover { color: #dc2626; border-color: #dc2626; }

      .status {
        font-size: 0.78rem;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 999px;
        white-space: nowrap;
      }
      .status-new { background: #e4ecf9; color: #2a4d8f; }
      .status-shipped { background: #fdf1cf; color: #93650a; }
      .status-done { background: #e1f0e3; color: #2f6b3e; }
      .status-cancelled { background: #f8e2df; color: var(--danger); }

      .my-orders { max-width: 640px; margin: 24px auto 0; display: flex; flex-direction: column; gap: 12px; }
      .my-orders h2 { margin: 0 0 4px; font-size: 1.2rem; }
      .order-date { color: var(--muted); font-size: 0.85rem; }
      .order-cancel {
        background: var(--surface);
        border: 1px solid var(--danger);
        color: var(--danger);
        border-radius: 8px;
        padding: 6px 12px;
        font-weight: 600;
        font-size: 0.85rem;
      }
      .order-cancel:disabled { opacity: 0.6; }
      .order-msg { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
      .order-msg textarea { min-height: 54px; }
      .order-msg-row { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
      .order-msg-guest { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }

      @media (max-width: 640px) {
        .shop-header { flex-direction: column; }
        .admin-header { flex-direction: column; align-items: flex-start; gap: 10px; }
      }
    `}</style>
  )
}
