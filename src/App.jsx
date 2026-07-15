import { useEffect, useState } from 'react'
import { Pencil, Plus, Settings, ShoppingCart, Trash2, X } from 'lucide-react'

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

function money(n, currency = 'лв.') {
  const num = Number(n) || 0
  return `${num.toFixed(2)} ${currency}`
}

function isUrl(value) {
  return typeof value === 'string' && /^https?:\/\//.test(value)
}

function parseRoute() {
  const hash = window.location.hash
  if (hash === '#admin') return { name: 'admin' }
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
const createOrder = (order) => rest('orders', { method: 'POST', body: order, headers: { Prefer: 'return=minimal' } })
const updateOrderStatus = (token, id, status) =>
  rest(`orders?id=eq.${id}`, { method: 'PATCH', token, body: { status }, headers: { Prefer: 'return=representation' } }).then((r) => r[0])
const deleteOrder = (token, id) => rest(`orders?id=eq.${id}`, { method: 'DELETE', token })

const getSettings = () => rest('shop_settings?select=*&id=eq.1').then((r) => r[0])
const updateSettings = (token, patch) =>
  rest('shop_settings?id=eq.1', { method: 'PATCH', token, body: patch, headers: { Prefer: 'return=representation' } }).then((r) => r[0])

const STATUSES = ['нова', 'изпратена', 'приключена', 'отказана']
const CART_KEY = 'cart'

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  const [settings, setSettings] = useState(null)
  const [session, setSession] = useState(null)
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || []
    } catch {
      return []
    }
  })

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {})
  }, [])

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  function handleLogin(data) {
    setSession({ token: data.access_token, email: data.user?.email })
  }

  function handleLogout() {
    setSession(null)
  }

  function addToCart(product) {
    setCart((c) => {
      const existing = c.find((i) => i.id === product.id)
      if (existing) {
        return c.map((i) => (i.id === product.id ? { ...i, qty: Math.min(i.qty + 1, product.stock) } : i))
      }
      return [...c, { id: product.id, name: product.name, price: product.price, image: product.image, qty: 1, stock: product.stock }]
    })
  }

  function changeQty(id, qty) {
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty } : i)).filter((i) => i.qty > 0))
  }

  function removeFromCart(id) {
    setCart((c) => c.filter((i) => i.id !== id))
  }

  const cartProps = { cart, addToCart, changeQty, removeFromCart, clearCart: () => setCart([]) }

  return (
    <>
      <Style />
      {route.name === 'admin' ? (
        session ? (
          <Admin session={session} settings={settings} onSettingsChange={setSettings} onLogout={handleLogout} />
        ) : (
          <AuthGate onLogin={handleLogin} />
        )
      ) : route.name === 'product' ? (
        <ProductPage productId={route.id} settings={settings} {...cartProps} />
      ) : (
        <Shop settings={settings} {...cartProps} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Shop (витрина, количка, поръчка)
// ---------------------------------------------------------------------------

function Shop({ settings, cart, addToCart, changeQty, removeFromCart, clearCart }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('всички')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

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

  const currency = settings?.currency || 'лв.'
  const categories = ['всички', ...new Set(products.map((p) => p.category).filter(Boolean))]
  const filtered = category === 'всички' ? products : products.filter((p) => p.category === category)
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0)

  function addAndOpen(product) {
    addToCart(product)
    setDrawerOpen(true)
  }

  function handleOrderComplete() {
    clearCart()
    setCheckoutOpen(false)
    setDrawerOpen(false)
  }

  return (
    <div className="shop">
      <header className="shop-header">
        <div>
          <h1>{settings?.shop_name || 'Моят магазин'}</h1>
          {settings?.tagline && <p className="tagline">{settings.tagline}</p>}
        </div>
        <button className="cart-btn" onClick={() => setDrawerOpen(true)}>
          <ShoppingCart size={20} />
          <span>{cartCount}</span>
        </button>
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
            <a className="product-card" key={p.id} href={`#product/${p.id}`}>
              <div className="product-image">
                {isUrl(p.image) ? <img src={p.image} alt={p.name} /> : <span className="emoji">{p.image || '📦'}</span>}
              </div>
              <h3>{p.name}</h3>
              {p.description && <p className="desc">{p.description}</p>}
              <div className="product-footer">
                <strong>{money(p.price, currency)}</strong>
                <button
                  disabled={p.stock <= 0}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    addAndOpen(p)
                  }}
                >
                  {p.stock <= 0 ? 'Изчерпан' : 'Добави'}
                </button>
              </div>
            </a>
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Количка">
        {cart.length === 0 ? (
          <p className="hint">Количката е празна.</p>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((i) => (
                <div className="cart-item" key={i.id}>
                  <span className="emoji">{isUrl(i.image) ? <img src={i.image} alt="" /> : i.image}</span>
                  <div className="cart-item-info">
                    <span>{i.name}</span>
                    <small>{money(i.price, currency)}</small>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={i.stock}
                    value={i.qty}
                    onChange={(e) => changeQty(i.id, Math.max(1, Math.min(Number(e.target.value) || 1, i.stock)))}
                  />
                  <button className="icon-btn" onClick={() => removeFromCart(i.id)}>
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
      </Drawer>

      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Завършване на поръчката">
        <Checkout cart={cart} total={total} currency={currency} onComplete={handleOrderComplete} />
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProductPage (отделна страница за продукт)
// ---------------------------------------------------------------------------

function ProductPage({ productId, settings, cart, addToCart }) {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    getProduct(productId)
      .then((p) => active && setProduct(p || null))
      .catch(() => active && setProduct(null))
      .finally(() => active && setLoading(false))
  }, [productId])

  const currency = settings?.currency || 'лв.'
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0)

  return (
    <div className="shop">
      <header className="shop-header">
        <a className="back-link" href="#">
          ← Към магазина
        </a>
        <a className="cart-btn" href="#">
          <ShoppingCart size={20} />
          <span>{cartCount}</span>
        </a>
      </header>

      {loading ? (
        <p className="hint">Зареждане...</p>
      ) : !product ? (
        <p className="hint">
          Продуктът не е намерен. <a href="#">Обратно към магазина</a>
        </p>
      ) : (
        <div className="product-page">
          <div className="product-page-image">
            {isUrl(product.image) ? (
              <img src={product.image} alt={product.name} />
            ) : (
              <span className="emoji">{product.image || '📦'}</span>
            )}
          </div>
          <div className="product-page-info">
            <h1>{product.name}</h1>
            {product.category && <span className="product-detail-category">{product.category}</span>}
            <div className="product-detail-price">{money(product.price, currency)}</div>
            <p className={product.stock > 0 ? 'product-detail-stock' : 'product-detail-stock out'}>
              {product.stock > 0 ? `Налични: ${product.stock} бр.` : 'Изчерпан'}
            </p>
            {product.description && <p className="product-detail-desc">{product.description}</p>}
            <button
              className="primary"
              disabled={product.stock <= 0}
              onClick={() => {
                addToCart(product)
                setAdded(true)
              }}
            >
              {product.stock <= 0 ? 'Изчерпан' : 'Добави в количката'}
            </button>
            {added && (
              <p className="added-msg">
                Добавено в количката! <a href="#">Виж количката →</a>
              </p>
            )}
          </div>
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
          <input
            type="password"
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
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          Настройки
        </button>
      </nav>

      <main className="admin-content">
        {tab === 'orders' && <Orders token={session.token} />}
        {tab === 'products' && <ProductsAdmin token={session.token} />}
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
        </div>
      ))}
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
    category: product.category || '',
    image: product.image || '',
    stock: product.stock ?? 0,
    description: product.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const url = await uploadProductImage(token, file)
      update('image', url)
    } catch {
      setError('Неуспешно качване на снимката.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
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
        category: form.category || null,
        image: form.image || '📦',
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
        Категория
        <input value={form.category} onChange={(e) => update('category', e.target.value)} />
      </label>
      <label>
        Снимка (емоджи или URL)
        <input value={form.image} onChange={(e) => update('image', e.target.value)} placeholder="📦 или https://..." />
      </label>
      <div className="image-upload">
        <label className="upload-btn">
          {uploading ? 'Качване...' : 'Качи снимка от устройство'}
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} hidden />
        </label>
        {isUrl(form.image) && <img className="image-preview" src={form.image} alt="Преглед" />}
      </div>
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
    currency: settings?.currency || 'лв.',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (settings) {
      setForm({ shop_name: settings.shop_name || '', tagline: settings.tagline || '', currency: settings.currency || 'лв.' })
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

function Checkout({ cart, total, currency, onComplete }) {
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
      await createOrder({
        customer_name: form.name,
        customer_phone: form.phone,
        customer_city: form.city,
        customer_address: form.address,
        notes: form.notes || null,
        items: cart.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        total,
        currency,
        payment: 'Наложен платеж',
      })
      onComplete()
    } catch {
      setError('Възникна грешка при изпращане на поръчката. Опитайте отново.')
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
      .shop { max-width: 1080px; margin: 0 auto; padding: 24px 20px 60px; }

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
        bottom: 20px;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 999px;
        color: var(--muted);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      }
      .admin-fab:hover { color: var(--accent); border-color: var(--accent); }

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

      @media (max-width: 640px) {
        .shop-header { flex-direction: column; }
        .admin-header { flex-direction: column; align-items: flex-start; gap: 10px; }
      }
    `}</style>
  )
}
