'use client'

import React, { useState, useEffect, useRef } from 'react'

const CDN = 'https://d1yei2z3i6k35z.cloudfront.net/4263526'
const AFF = '?tracking=6809eceee15ad'

const PRODUCTS = [
  {
    id: 'kristalon',
    badge: 'Най-използван от фермерите',
    img: `${CDN}/69b0fc97106ef_zelen-kristalon-230x400.webp`,
    name: 'Кристалон Зелен 18-18-18',
    subtitle: 'NPK тор с микроелементи',
    desc: 'Водоразтворимият Кристалон Зелен 18-18-18 стимулира бърз растеж, силна коренова система и по-голям добив. Осигурява идеално съотношение на азот, фосфор и калий.',
    features: ['100% водоразтворим', 'Съдържа микроелементи', 'Листно торене и фертигация', 'Увеличава добива и качеството'],
    tag: 'ТОР',
    tagColor: '#16a34a',
    tagBg: '#dcfce7',
    link: `https://agroapteki.com/torove/npk-npk-torove/kristalon-zelen-specialen-18-18-18-kompleksen-tor/${AFF}`,
    accentColor: '#16a34a',
  },
  {
    id: 'kaliteh',
    badge: 'Предпазва от върхово гниене',
    img: `${CDN}/69b1000d9fb83_kaliteh-224x400.webp`,
    name: 'Калитех (Calitech)',
    subtitle: 'Калциев биостимулатор',
    desc: 'Мощен калциев биостимулатор, който доставя лесно усвоим калций и предотвратява върхово гниене при доматите и пипера. По-здрави, по-твърди и по-качествени плодове.',
    features: ['Предпазва от върхово гниене', 'Подобрява качеството на плодовете', 'Увеличава добива и захарите', 'Листно пръскане и капково'],
    tag: 'БИОСТИМ',
    tagColor: '#0891b2',
    tagBg: '#e0f2fe',
    link: `https://agroapteki.com/torove/biostimulatori/kaliteh/${AFF}`,
    accentColor: '#0891b2',
  },
  {
    id: 'amalgerol',
    badge: 'Легендарният стимулатор',
    img: `${CDN}/69b11176b1758_amalgerol-300x400.webp`,
    name: 'Амалгерол',
    subtitle: 'Биостимулатор за здраве и имунитет',
    desc: '100% природен продукт от алпийски билки и морски водорасли. Действа като щит срещу стреса при градушки, суша или студ. Лекува почвата и помага на растенията.',
    features: ['Анти-стрес (слана, суша, хербициди)', 'Ускорява разграждането на остатъци', 'Подобрява приема на азот', 'Сертифициран за био земеделие'],
    tag: 'БИО',
    tagColor: '#65a30d',
    tagBg: '#f0fdf4',
    link: `https://agroapteki.com/torove/techni-torove/amalgerol-za-uskoryavane-rasteja-na-kulturite/${AFF}`,
    accentColor: '#65a30d',
  },
  {
    id: 'turbo-root',
    badge: '100% прихващане на разсада',
    img: `${CDN}/69b4fd32592803.63113743_turbo-rot-224x400.webp`,
    name: 'Турбо Рут',
    subtitle: 'Биостимулатор за кореновата система',
    desc: 'Тайното оръжие при засаждане. Стимулира растежа на фините бели корени чрез комбинация от хуминови киселини и желязо. Осигурява експлозивен ранен старт.',
    features: ['Бързо вкореняване на разсада', 'Подобрява структурата около корена', 'Аминокиселини за бързо усвояване', 'Устойчивост на младите растения'],
    tag: 'КОРЕНИ',
    tagColor: '#b45309',
    tagBg: '#fef3c7',
    link: `https://agroapteki.com/torove/biostimulatori/turbo-rut/${AFF}`,
    accentColor: '#b45309',
  },
  {
    id: 'sineis',
    badge: 'Само 3 дни карантинен срок',
    img: `${CDN}/69b4f5319cf6f1.51072214_sineis-20-237x400.webp`,
    name: 'Синейс 480 СК',
    subtitle: 'Биологичен инсектицид',
    desc: 'Революционен биологичен продукт базиран на спинозад. Спира атаките на колорадски бръмбар, трипс и миниращ молец само за часове. Кратък карантинен срок.',
    features: ['Ефективен срещу Калифорнийски трипс', 'Унищожава Tuta absoluta', 'Само 3-7 дни карантинен срок', 'Устойчив на отмиване'],
    tag: 'ЗАЩИТА',
    tagColor: '#dc2626',
    tagBg: '#fee2e2',
    link: `https://agroapteki.com/preparati/insekticidi/sineis-480-sk/${AFF}`,
    accentColor: '#dc2626',
  },
  {
    id: 'ridomil',
    badge: 'Стопира маната за 48 часа',
    img: `${CDN}/69b4f6e3264510.81149458_ridomil-gold-300x400.webp`,
    name: 'Ридомил Голд Р ВГ',
    subtitle: 'Системен фунгицид',
    desc: 'Легендарното решение което не само предпазва, но и лекува вече възникнала зараза. Прониква в растението за 30 минути и предпазва дори новите листа.',
    features: ['Лечебно действие до 2 дни след зараза', 'Абсорбира се за 30 минути', 'Предпазва новия прираст', 'Лесна разтворимост'],
    tag: 'ФУНГИЦИД',
    tagColor: '#7c3aed',
    tagBg: '#f3e8ff',
    link: `https://agroapteki.com/preparati/fungicidi/ridomil-gold/${AFF}`,
    accentColor: '#7c3aed',
  },
]

const ATLAS_PRODUCTS = [
  {
    id: 'atlas-terra',
    name: 'Atlas Terra',
    subtitle: 'Органичен подобрител на почвата',
    price: 28.90,
    priceLabel: '28.90 лв./кг',
    badge: 'Фундамент за здрава почва',
    img: `${CDN}/69b106e276e0e_Jan-2025-ATLAS-TERRA-AMINONITRO.jpg`,
    features: [
      'Възстановява естественото плодородие',
      'Подобрява структурата на тежки почви',
      'Задържа влагата при засушаване',
      'Отключва блокирани микроелементи',
      '100% органичен — безопасен за почвата',
    ],
    desc: 'Богат на хуминови киселини и органично вещество. Трансформира структурата на почвата, прави я рохкава и способна да задържа влага.',
    emoji: '🌍',
  },
  {
    id: 'atlas-amino',
    name: 'Atlas Terra AMINO',
    subtitle: 'Аминокиселини за експлозивен растеж',
    price: 32.90,
    priceLabel: '32.90 лв./л',
    badge: 'Видими резултати след 48ч',
    img: `${CDN}/69b106e276e0e_Jan-2025-ATLAS-TERRA-AMINONITRO.jpg`,
    features: [
      'Висока концентрация свободни аминокиселини',
      'Бърз и обилен цъфтеж',
      'Анти-стрес при жега, студ, градушка',
      'Листно пръскане и капково поливане',
      'Видими резултати само след 48 часа',
    ],
    desc: '"Бързата храна" за домати, краставици и зеленчуци. Действа моментално при стресови ситуации — жеги, застудявания, след пресаждане.',
    emoji: '⚡',
  },
]

const AFFILIATE_CATEGORIES = [
  { icon: '🌱', label: 'Торове и Био Стимулатори', link: `https://agroapteki.com/torove/${AFF}`, color: '#16a34a' },
  { icon: '💧', label: 'Поливни Системи', link: `https://agroapteki.com/polivni-sistemi/${AFF}`, color: '#0891b2' },
  { icon: '🛡️', label: 'Защита от Болести', link: `https://agroapteki.com/preparati/${AFF}`, color: '#dc2626' },
  { icon: '🌾', label: 'Качествени Семена', link: `https://agroapteki.com/semena/${AFF}`, color: '#b45309' },
  { icon: '🏕️', label: 'Израелски Найлон', link: 'https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar', color: '#7c3aed' },
  { icon: '🌳', label: 'Биологично Земеделие', link: '#', color: '#65a30d' },
]

const TESTIMONIALS = [
  { name: 'Иван Петров', location: 'Пловдив', text: 'След Калитех нямам повече върхово гниене. Реколтата е двойно по-добра!', stars: 5, avatar: '👨‍🌾' },
  { name: 'Мария Стоянова', location: 'Стара Загора', text: 'Амалгерол спаси доматите ми след градушката. Страхотен продукт!', stars: 5, avatar: '👩‍🌾' },
  { name: 'Георги Димитров', location: 'Хасково', text: 'Турбо Рут — всеки разсад се прихвана. Няма пропадане!', stars: 5, avatar: '🧑‍🌾' },
]

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  className?: string
  key?: React.Key
}

const FadeIn = ({ children, delay = 0, className = '' }: FadeInProps): React.ReactElement => {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.75s cubic-bezier(.4,0,.2,1) ${delay}ms, transform 0.75s cubic-bezier(.4,0,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

function ProductCard({ p, idx }: { p: typeof PRODUCTS[0]; idx: number }) {
  const [hovered, setHovered] = useState(false)
  const { ref, visible } = useInView()

  const trackClick = async () => {
    try {
      await fetch('/api/analytics/affiliate-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner: 'agroapteki', product_slug: p.id }),
      })
    } catch {}
  }

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.65s ease ${idx * 90}ms, transform 0.65s ease ${idx * 90}ms`,
      }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: '#fff',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: hovered
            ? `0 24px 64px rgba(0,0,0,0.14), 0 0 0 2px ${p.accentColor}33`
            : '0 2px 20px rgba(0,0,0,0.06)',
          transition: 'all 0.35s cubic-bezier(.4,0,.2,1)',
          transform: hovered ? 'translateY(-8px) scale(1.01)' : 'translateY(0) scale(1)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          border: `1px solid ${hovered ? p.accentColor + '44' : '#f0f0f0'}`,
        }}
      >
        {/* Image area */}
        <div style={{
          position: 'relative',
          background: `linear-gradient(135deg, ${p.tagBg}, #fff)`,
          padding: '32px 24px 24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 240,
        }}>
          {/* Tag pill */}
          <span style={{
            position: 'absolute', top: 14, left: 14,
            background: p.tagColor, color: '#fff',
            fontSize: 10, fontWeight: 800, padding: '4px 12px',
            borderRadius: 30, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            boxShadow: `0 4px 12px ${p.tagColor}55`,
          }}>{p.tag}</span>

          {/* Bestseller badge */}
          <span style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${p.tagColor}33`,
            color: p.tagColor,
            fontSize: 10, fontWeight: 700,
            padding: '4px 10px', borderRadius: 20,
          }}>⭐ {p.badge}</span>

          <img
            src={p.img}
            alt={p.name}
            style={{
              maxHeight: 200, maxWidth: 160, objectFit: 'contain',
              display: 'block',
              filter: hovered ? 'drop-shadow(0 16px 32px rgba(0,0,0,0.18))' : 'drop-shadow(0 8px 16px rgba(0,0,0,0.1))',
              transition: 'filter 0.35s ease, transform 0.35s ease',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
            }}
          />
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: 11, color: p.tagColor, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.subtitle}</div>
          <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: '#111', fontFamily: "'Cormorant Garamond', Georgia, serif", lineHeight: 1.3 }}>{p.name}</h3>
          <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.65, marginBottom: 14, flex: 1 }}>{p.desc}</p>

          <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none' }}>
            {p.features.map((f, i) => (
              <li key={i} style={{
                fontSize: 12.5, color: '#374151', padding: '4px 0',
                display: 'flex', gap: 8, alignItems: 'flex-start',
                borderBottom: i < p.features.length - 1 ? '1px solid #f5f5f5' : 'none',
              }}>
                <span style={{
                  color: '#fff', background: p.accentColor,
                  width: 16, height: 16, borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 900, flexShrink: 0, marginTop: 1,
                }}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          <a
            href={p.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackClick}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: hovered ? p.accentColor : '#fff',
              color: hovered ? '#fff' : p.accentColor,
              border: `2px solid ${p.accentColor}`,
              textDecoration: 'none',
              padding: '12px 20px', borderRadius: 14,
              fontWeight: 800, fontSize: 14,
              transition: 'all 0.25s ease',
              letterSpacing: '0.01em',
            }}
          >
            Виж продукта →
          </a>
        </div>
      </div>
    </div>
  )
}

function LeadForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, source: 'naruchnik' }),
      })
      if (res.ok) setDone(true)
      else setError('Грешка. Моля опитай отново.')
    } catch {
      setError('Грешка. Моля опитай отново.')
    }
    setLoading(false)
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: '28px 16px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
      <h3 style={{ color: '#fff', fontSize: 22, margin: '0 0 8px', fontFamily: "'Cormorant Garamond', serif", fontWeight: 700 }}>Провери имейла си!</h3>
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>Изпратихме ти наръчника на <strong>{email}</strong></p>
    </div>
  )

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        type="text"
        placeholder="Твоето ime (по желание)"
        value={name}
        onChange={e => setName(e.target.value)}
        style={{
          padding: '14px 18px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.25)',
          fontSize: 15, outline: 'none', background: 'rgba(255,255,255,0.12)',
          color: '#fff', backdropFilter: 'blur(8px)',
        }}
      />
      <input
        type="email"
        placeholder="Твоят имейл адрес *"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        style={{
          padding: '14px 18px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.25)',
          fontSize: 15, outline: 'none', background: 'rgba(255,255,255,0.12)',
          color: '#fff', backdropFilter: 'blur(8px)',
        }}
      />
      {error && <div style={{ color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      <button
        type="submit"
        disabled={loading}
        className="cta-btn"
        style={{
          padding: '15px 20px', borderRadius: 14, border: 'none',
          background: loading ? 'rgba(255,255,255,0.5)' : '#fff',
          color: '#15803d', fontWeight: 900, fontSize: 16,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.25s',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          letterSpacing: '0.01em',
        }}
      >
        {loading ? 'Изпращане...' : '📗 Изтегли БЕЗПЛАТНО →'}
      </button>
      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', textAlign: 'center', margin: 0 }}>
        🔒 Без спам. Можеш да се отпишеш по всяко време.
      </p>
    </form>
  )
}

export default function HomePage() {
  const [cartVisible, setCartVisible] = useState(false)
  const [cart, setCart] = useState<{ id: string; name: string; price: number; qty: number }[]>([])
  const [orderForm, setOrderForm] = useState({ name: '', phone: '', email: '', address: '', city: '', notes: '', payment: 'cod' })
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderDone, setOrderDone] = useState('')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const addToCart = (product: typeof ATLAS_PRODUCTS[0]) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }]
    })
    setCartVisible(true)
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const shipping = cartTotal >= 60 ? 0 : 5.99

  const submitOrder = async () => {
    if (!orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city) return
    setOrderLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: orderForm.name,
          customer_phone: orderForm.phone,
          customer_email: orderForm.email,
          customer_address: orderForm.address,
          customer_city: orderForm.city,
          customer_notes: orderForm.notes,
          payment_method: orderForm.payment,
          items: cart.map(i => ({ product_name: i.name, quantity: i.qty, unit_price: i.price, total_price: i.price * i.qty })),
          subtotal: cartTotal, shipping, total: cartTotal + shipping,
        }),
      })
      const data = await res.json()
      if (data.order_number) { setOrderDone(data.order_number); setCart([]) }
    } catch {}
    setOrderLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;0,800;1,600;1,700&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', -apple-system, sans-serif; background: #fafaf8; color: #1a1a1a; -webkit-font-smoothing: antialiased; }

        ::placeholder { color: rgba(255,255,255,0.5) !important; }
        input, textarea, select { font-family: inherit; }

        @keyframes fadeDown { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100% { transform:scale(1); box-shadow: 0 0 0 0 rgba(22,163,74,0.4) } 50% { transform:scale(1.03); box-shadow: 0 0 0 12px rgba(22,163,74,0) } }
        @keyframes float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-10px) } }
        @keyframes shimmer { 0% { background-position: -200% center } 100% { background-position: 200% center } }
        @keyframes spin-slow { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
        @keyframes badge-glow { 0%,100% { opacity:1 } 50% { opacity:0.7 } }

        .hero-float { animation: float 4s ease-in-out infinite; }
        .cta-pulse { animation: pulse 2.5s ease-in-out infinite; }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.25) !important; }
        .shimmer-text {
          background: linear-gradient(90deg, #86efac 0%, #fff 40%, #86efac 80%);
          background-size: 200%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s ease infinite;
        }
        .nav-link { color: #374151; text-decoration: none; font-size: 14px; font-weight: 600; padding: 6px 12px; border-radius: 8px; transition: all 0.2s; }
        .nav-link:hover { color: #16a34a; background: #f0fdf4; }
        .category-card { transition: all 0.25s cubic-bezier(.4,0,.2,1); text-decoration: none; }
        .category-card:hover { transform: translateY(-4px); }
        .cart-btn:hover { background: #15803d !important; }
        .order-btn:hover:not(:disabled) { background: #15803d !important; transform: translateY(-1px); }

        /* Floating trust badge */
        .trust-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 30px; padding: 7px 16px; backdrop-filter: blur(12px); animation: badge-glow 3s ease-in-out infinite; }

        /* Urgency bar */
        .urgency-bar { background: linear-gradient(90deg, #dc2626, #b91c1c); }

        @media(max-width: 900px) {
          .products-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media(max-width: 640px) {
          .products-grid { grid-template-columns: 1fr !important; }
          .atlas-grid { grid-template-columns: 1fr !important; }
          .stats-row { grid-template-columns: repeat(2,1fr) !important; }
          .categories-grid { grid-template-columns: repeat(2,1fr) !important; }
          .hero-features { flex-direction: column !important; align-items: stretch !important; }
          .nav-links-desktop { display: none !important; }
        }
        @media(min-width: 641px) {
          .nav-links-desktop { display: flex !important; }
        }
      `}</style>

      {/* URGENCY BAR */}
      <div className="urgency-bar" style={{ padding: '9px 20px', textAlign: 'center', fontSize: 13, color: '#fff', fontWeight: 600, letterSpacing: '0.02em' }}>
        🔥 <strong>Безплатна доставка</strong> при поръчка над 60 лв. &nbsp;·&nbsp; Ограничен брой наръчници — изтегли сега
      </div>

      {/* STICKY HEADER */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64,
        boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.08)' : '0 1px 8px rgba(0,0,0,0.04)',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>🍅</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, fontFamily: "'Cormorant Garamond', serif", color: '#1a1a1a', lineHeight: 1 }}>Denny Angelow</div>
            <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Агро Консултант</div>
          </div>
        </div>

        <nav className="nav-links-desktop" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <a href="#produkti" className="nav-link">Продукти</a>
          <a href="#atlas" className="nav-link">Atlas Terra</a>
          <a href="#kategorii" className="nav-link">Магазин</a>
          <a href="#kontakt" className="nav-link">Контакт</a>
        </nav>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setCartVisible(true)}
            style={{
              background: cartCount > 0 ? '#16a34a' : '#f0fdf4',
              color: cartCount > 0 ? '#fff' : '#16a34a',
              border: '2px solid #16a34a',
              borderRadius: 12, padding: '8px 16px', cursor: 'pointer',
              fontWeight: 800, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
          >
            🛒 {cartCount > 0 ? `(${cartCount}) Количка` : 'Количка'}
          </button>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section style={{
        background: 'linear-gradient(145deg, #0f3d20 0%, #14532d 35%, #166534 65%, #15803d 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -120, right: -120, width: 500, height: 500, borderRadius: '50%', background: 'rgba(134,239,172,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', left: '10%', width: 180, height: 180, borderRadius: '50%', background: 'rgba(134,239,172,0.05)', pointerEvents: 'none' }} />

        {/* Subtle dot grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.15,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 28px 80px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 60, alignItems: 'center', justifyContent: 'space-between' }}>

            {/* LEFT — text + form */}
            <div style={{ flex: '1 1 420px', maxWidth: 560 }}>
              {/* Social proof pill */}
              <div style={{ marginBottom: 28 }}>
                <div className="trust-badge">
                  <img
                    src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`}
                    alt="Denny Angelow"
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.5)' }}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: 600 }}>@dennyangelow · 85K+ последователи</span>
                  <span style={{ width: 7, height: 7, background: '#86efac', borderRadius: '50%', animation: 'pulse 2s ease-in-out infinite' }} />
                </div>
              </div>

              <h1 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(36px, 5.5vw, 62px)',
                color: '#fff', margin: '0 0 16px',
                lineHeight: 1.1, fontWeight: 800,
                letterSpacing: '-0.01em',
              }}>
                Тайните на<br />
                <span className="shimmer-text">Едрите и Вкусни<br />Домати</span>
              </h1>

              <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 17, lineHeight: 1.7, marginBottom: 10, maxWidth: 460 }}>
                Искаш едри, здрави и сочни домати — без болести, без гниене и без загубена реколта?
              </p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(220,38,38,0.25)', color: '#fca5a5', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                  ⚠️ Не рискувай реколтата без правилната информация
                </span>
              </p>

              {/* What's inside chips */}
              <div className="hero-features" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 36 }}>
                {[
                  { icon: '🛡️', text: 'Защита от болести' },
                  { icon: '🌿', text: 'Кои торове работят' },
                  { icon: '📅', text: 'Календар за третиране' },
                  { icon: '❌', text: 'Грешки убиващи реколтата' },
                ].map(f => (
                  <span key={f.text} style={{
                    fontSize: 13, color: 'rgba(255,255,255,0.88)',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    padding: '7px 14px', borderRadius: 24,
                    display: 'flex', alignItems: 'center', gap: 6,
                    backdropFilter: 'blur(8px)',
                  }}>
                    <span>{f.icon}</span> {f.text}
                  </span>
                ))}
              </div>

              {/* Lead Form */}
              <div style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
                borderRadius: 24, padding: '28px',
                border: '1px solid rgba(255,255,255,0.18)',
                maxWidth: 420,
              }}>
                <p style={{ color: '#86efac', fontWeight: 700, fontSize: 11, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  📗 БЕЗПЛАТЕН НАРЪЧНИК
                </p>
                <h2 style={{ color: '#fff', fontSize: 18, margin: '0 0 20px', fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, lineHeight: 1.3 }}>
                  "Тайните на Едрите Домати" — изтегли сега
                </h2>
                <LeadForm />
              </div>
            </div>

            {/* RIGHT — visual stack */}
            <div className="hero-float" style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              {/* Profile card */}
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 20, padding: '20px',
                textAlign: 'center', backdropFilter: 'blur(12px)',
                width: '100%', maxWidth: 260,
              }}>
                <img
                  src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`}
                  alt="Denny Angelow"
                  style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', border: '3px solid #86efac', marginBottom: 12 }}
                />
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, fontFamily: "'Cormorant Garamond', serif" }}>Denny Angelow</div>
                <div style={{ color: '#86efac', fontSize: 12, fontWeight: 600, marginBottom: 14 }}>Агро консултант & фермер</div>
                <blockquote style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
                  "С правилните продукти, здрави домати без излишен стрес."
                </blockquote>
              </div>

              {/* Stats mini-cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 260 }}>
                {[
                  { n: '85K+', l: 'Последователи' },
                  { n: '6000+', l: 'Наръчника' },
                  { n: '100%', l: 'Органично' },
                  { n: '3+', l: 'Партньора' },
                ].map(s => (
                  <div key={s.n} style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 14, padding: '12px 10px', textAlign: 'center',
                    backdropFilter: 'blur(8px)',
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#86efac', fontFamily: "'Cormorant Garamond', serif" }}>{s.n}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CATEGORIES ============ */}
      <section id="kategorii" style={{ padding: '64px 28px', maxWidth: 1100, margin: '0 auto' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#16a34a', textTransform: 'uppercase' }}>Магазин</span>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(28px, 4vw, 40px)', margin: '10px 0 10px', fontWeight: 800 }}>
              Всичко за Твоята Градина
            </h2>
            <p style={{ color: '#6b7280', fontSize: 15, maxWidth: 420, margin: '0 auto' }}>Избери категорията, която те интересува</p>
          </div>
        </FadeIn>

        <div className="categories-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {AFFILIATE_CATEGORIES.map((c, i) => (
            <FadeIn key={c.label} delay={i * 55}>
              <a
                href={c.link}
                target="_blank"
                rel="noopener noreferrer"
                className="category-card"
                onClick={() => fetch('/api/analytics/affiliate-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partner: 'agroapteki', product_slug: c.label }) })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: '#fff', borderRadius: 18, padding: '18px 20px',
                  border: '2px solid #f0f0f0',
                  fontWeight: 700, fontSize: 14, color: '#1a1a1a',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = c.color + '55'
                  el.style.boxShadow = `0 8px 28px ${c.color}22`
                  el.style.background = c.color + '08'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = '#f0f0f0'
                  el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'
                  el.style.background = '#fff'
                }}
              >
                <span style={{
                  fontSize: 24, background: c.color + '18',
                  width: 48, height: 48, borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>{c.icon}</span>
                {c.label}
              </a>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ============ PRODUCTS GRID ============ */}
      <section id="produkti" style={{ padding: '20px 28px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#16a34a', textTransform: 'uppercase' }}>Препоръчани продукти</span>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(28px, 4vw, 42px)', margin: '10px 0 12px', fontWeight: 800 }}>
              Проверени от Практиката
            </h2>
            <p style={{ color: '#6b7280', fontSize: 15, maxWidth: 500, margin: '0 auto' }}>
              Продуктите, които лично използвам и препоръчвам за здрави и продуктивни домати
            </p>
          </div>
        </FadeIn>

        <div className="products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {PRODUCTS.map((p, i) => <ProductCard key={p.id} p={p} idx={i} />)}
        </div>
      </section>

      {/* ============ ATLAS TERRA DIRECT SALE ============ */}
      <section id="atlas" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)', padding: '80px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'rgba(22,163,74,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(22,163,74,0.06)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '6px 18px', borderRadius: 30, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                🏭 ДИРЕКТНО ОТ ПРОИЗВОДИТЕЛЯ
              </span>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(28px, 4vw, 42px)', marginTop: 18, marginBottom: 10, fontWeight: 800 }}>
                Atlas Terra — Поръчай Директно
              </h2>
              <p style={{ color: '#374151', fontSize: 15, maxWidth: 480, margin: '0 auto' }}>Два продукта. Един резултат — здрава почва и мощен растеж.</p>
            </div>
          </FadeIn>

          <div className="atlas-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 28, marginBottom: 40 }}>
            {ATLAS_PRODUCTS.map((p, i) => (
              <FadeIn key={p.id} delay={i * 120}>
                <div style={{
                  background: '#fff', borderRadius: 24, overflow: 'hidden',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.09)',
                  border: '2px solid #d1fae5',
                  display: 'flex', flexDirection: 'column',
                  transition: 'all 0.3s ease',
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = 'translateY(-6px)'
                    el.style.boxShadow = '0 20px 60px rgba(22,163,74,0.15)'
                    el.style.borderColor = '#86efac'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = 'translateY(0)'
                    el.style.boxShadow = '0 8px 40px rgba(0,0,0,0.09)'
                    el.style.borderColor = '#d1fae5'
                  }}
                >
                  {/* Image */}
                  <div style={{ position: 'relative', background: 'linear-gradient(135deg, #f0fdf4, #fff)', minHeight: 220 }}>
                    <img src={p.img} alt={p.name} style={{ width: '100%', height: 220, objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)',
                    }} />
                    <div style={{ position: 'absolute', top: 14, left: 14 }}>
                      <span style={{
                        background: 'rgba(255,255,255,0.95)', color: '#16a34a',
                        fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 24,
                        letterSpacing: '0.05em', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}>⭐ {p.badge}</span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
                      <div style={{ fontSize: 28, marginBottom: 4 }}>{p.emoji}</div>
                      <h3 style={{ color: '#fff', margin: 0, fontSize: 22, fontFamily: "'Cormorant Garamond', serif", fontWeight: 800 }}>{p.name}</h3>
                      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>{p.subtitle}</div>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '22px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.65, marginBottom: 16, fontStyle: 'italic' }}>"{p.desc}"</p>
                    <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', flex: 1 }}>
                      {p.features.map(f => (
                        <li key={f} style={{
                          fontSize: 13, color: '#374151', padding: '5px 0',
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                          borderBottom: '1px solid #f3f4f6',
                        }}>
                          <span style={{
                            background: '#16a34a', color: '#fff',
                            width: 16, height: 16, borderRadius: 4,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 900, flexShrink: 0, marginTop: 1,
                          }}>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#16a34a', fontFamily: "'Cormorant Garamond', serif" }}>{p.priceLabel}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>+ доставка от 5.99 лв.</div>
                      </div>
                      <button
                        className="cart-btn"
                        onClick={() => addToCart(p)}
                        style={{
                          background: '#16a34a', color: '#fff', border: 'none',
                          borderRadius: 14, padding: '12px 22px', cursor: 'pointer',
                          fontWeight: 800, fontSize: 15,
                          boxShadow: '0 4px 16px rgba(22,163,74,0.35)',
                          transition: 'all 0.2s',
                        }}
                      >
                        🛒 Добави
                      </button>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14 }}>Или поръчай директно от производителя</p>
              <a
                href="https://atlasagro.eu/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => fetch('/api/analytics/affiliate-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partner: 'atlasagro', product_slug: 'atlas-terra' }) })}
                className="cta-btn"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: '#15803d', color: '#fff',
                  padding: '15px 36px', borderRadius: 16,
                  textDecoration: 'none', fontWeight: 800, fontSize: 16,
                  boxShadow: '0 8px 28px rgba(22,163,74,0.35)',
                  transition: 'all 0.25s',
                }}
              >
                🛒 Купи от AtlasAgro.eu
              </a>
              <div style={{ marginTop: 12, fontSize: 13, color: '#16a34a', fontWeight: 700 }}>
                🚚 Безплатна доставка над 60 лв.
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ GINEGAR ============ */}
      <section style={{ background: '#0f1f14', padding: '80px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 600, height: '100%', opacity: 0.12, pointerEvents: 'none', background: 'radial-gradient(ellipse at top right, #22c55e, transparent 65%)' }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.08, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.25) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <FadeIn>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 56, alignItems: 'center' }}>
              <div style={{ flex: '1 1 380px' }}>
                <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '6px 16px', borderRadius: 30, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  🏕️ ИЗРАЕЛСКА ТЕХНОЛОГИЯ
                </span>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fff', fontSize: 'clamp(26px, 3.5vw, 38px)', margin: '18px 0 14px', fontWeight: 800, lineHeight: 1.15 }}>
                  Ginegar — Премиум<br />Найлон за Оранжерии
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.75, marginBottom: 24 }}>
                  Световен стандарт за здравина, светлина и дълъг живот. GINEGAR не е най-евтиният избор — той е изборът, <strong style={{ color: '#86efac' }}>който излиза най-изгоден с времето.</strong>
                </p>
                <ul style={{ margin: '0 0 32px', padding: 0, listStyle: 'none' }}>
                  {[
                    '9-слойна технология (всеки слой с функция)',
                    'UV защита и анти-капка ефект',
                    'Равномерно осветление на растенията',
                    'По-малко подмяна — по-ниска цена на сезон',
                  ].map(f => (
                    <li key={f} style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, padding: '7px 0', display: 'flex', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ background: '#16a34a', color: '#fff', width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fetch('/api/analytics/affiliate-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partner: 'oranjeriata', product_slug: 'ginegar' }) })}
                  className="cta-btn"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: '#16a34a', color: '#fff', textDecoration: 'none',
                    padding: '14px 28px', borderRadius: 14, fontWeight: 800, fontSize: 15,
                    boxShadow: '0 8px 24px rgba(22,163,74,0.4)',
                    transition: 'all 0.25s',
                  }}
                >
                  👉 Разгледай фолиата на Ginegar
                </a>
              </div>

              <div style={{ flex: '0 0 260px', textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <div style={{ position: 'absolute', inset: -12, background: 'radial-gradient(circle, rgba(22,163,74,0.25), transparent 70%)', borderRadius: '50%' }} />
                  <img
                    src={`${CDN}/6940e17e0d4a3_pe-film-supflor-ginegar.jpg`}
                    alt="Ginegar фолио"
                    style={{ width: '100%', maxWidth: 260, borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', position: 'relative' }}
                  />
                </div>
                <img
                  src={`${CDN}/694242e9c1baa_ginegar-logo-mk-group.600x600.png`}
                  alt="Ginegar logo"
                  style={{ width: 90, marginTop: 20, filter: 'brightness(0) invert(1)', opacity: 0.65 }}
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section style={{ padding: '80px 28px', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#16a34a', textTransform: 'uppercase' }}>Отзиви</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(26px, 3.5vw, 38px)', margin: '10px 0', fontWeight: 800 }}>
                Какво казват фермерите
              </h2>
            </div>
          </FadeIn>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 56 }}>
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={t.name} delay={i * 100}>
                <div style={{
                  background: '#f9fafb', borderRadius: 20, padding: '24px',
                  border: '1px solid #e5e7eb',
                  transition: 'all 0.25s',
                }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)'; el.style.transform = 'translateY(-3px)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = 'none'; el.style.transform = 'translateY(0)' }}
                >
                  <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
                    {Array.from({ length: t.stars }).map((_, j) => <span key={j} style={{ color: '#f59e0b', fontSize: 16 }}>★</span>)}
                  </div>
                  <p style={{ fontSize: 14.5, color: '#374151', lineHeight: 1.65, marginBottom: 16, fontStyle: 'italic' }}>
                    "{t.text}"
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 28 }}>{t.avatar}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{t.location}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Author quote */}
          <FadeIn>
            <div style={{ textAlign: 'center', padding: '32px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderRadius: 24, border: '1px solid #bbf7d0' }}>
              <img
                src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`}
                alt="Denny Angelow"
                style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '3px solid #16a34a', marginBottom: 18 }}
              />
              <blockquote style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(18px, 2.5vw, 24px)', color: '#1a1a1a',
                fontStyle: 'italic', lineHeight: 1.6, margin: '0 0 18px',
                maxWidth: 600, marginLeft: 'auto', marginRight: 'auto',
              }}>
                "С правилната грижа и нужните продукти можеш да отгледаш здрави и продуктивни растения, без излишни усилия."
              </blockquote>
              <div style={{ fontWeight: 800, color: '#16a34a', fontSize: 15 }}>Denny Angelow</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>@iammyoungmoney · Агро Консултант</div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ SECOND CTA / LEAD RECAPTURE ============ */}
      <section style={{
        background: 'linear-gradient(145deg, #14532d 0%, #15803d 100%)',
        padding: '72px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.1, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div style={{ maxWidth: 540, margin: '0 auto', position: 'relative' }}>
          <FadeIn>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📗</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fff', fontSize: 'clamp(26px, 4vw, 38px)', margin: '0 0 12px', fontWeight: 800 }}>
              Изтегли Безплатния Наръчник
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 16, lineHeight: 1.6, marginBottom: 36 }}>
              Над 6000 фермери вече го имат. Вземи и ти тайните за едри, здрави домати.
            </p>
            <LeadForm />
          </FadeIn>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer id="kontakt" style={{ background: '#0f1f14', color: 'rgba(255,255,255,0.7)', padding: '48px 28px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🍅</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#fff', fontWeight: 700, marginBottom: 6 }}>Denny Angelow</div>
          <div style={{ fontSize: 12, color: '#86efac', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>Агро Консултант</div>

          <p style={{ fontSize: 14, marginBottom: 24 }}>
            Въпроси? Пиши ни на{' '}
            <a href="mailto:support@dennyangelow.com" style={{ color: '#86efac', fontWeight: 600 }}>support@dennyangelow.com</a>
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 28, fontSize: 14 }}>
            {[
              { label: 'AgroApteki', href: `https://agroapteki.com/${AFF}` },
              { label: 'Oranjeriata', href: 'https://oranjeriata.com/' },
              { label: 'AtlasAgro', href: 'https://atlasagro.eu/' },
            ].map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontWeight: 600, transition: 'color 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#86efac' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)' }}
              >{l.label}</a>
            ))}
            <a href="/admin" style={{ color: 'rgba(255,255,255,0.25)', textDecoration: 'none', fontSize: 12 }}>Admin</a>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 20 }} />
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>© 2025-2026 Denny Angelow · Всички права запазени</div>
        </div>
      </footer>

      {/* ============ CART DRAWER ============ */}
      {cartVisible && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div onClick={() => setCartVisible(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }} />
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: 480,
            background: '#fff', animation: 'fadeDown 0.3s ease',
            display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 48px rgba(0,0,0,0.2)',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700 }}>🛒 Количка</h3>
              <button onClick={() => setCartVisible(false)} style={{ background: '#f3f4f6', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {orderDone ? (
                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
                  <h3 style={{ color: '#16a34a', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, margin: '0 0 8px' }}>Поръчката е приета!</h3>
                  <p style={{ color: '#374151' }}>Номер: <strong>{orderDone}</strong></p>
                  <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>Ще се свържем с теб до 24 часа.</p>
                  <button onClick={() => { setCartVisible(false); setOrderDone('') }} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', cursor: 'pointer', fontWeight: 800, fontSize: 15 }}>Затвори</button>
                </div>
              ) : cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '72px 0', color: '#9ca3af' }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>🛒</div>
                  <p style={{ fontSize: 16, fontWeight: 600 }}>Количката е празна</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Добави Atlas Terra продукти по-горе</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 24 }}>
                    {cart.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{item.name}</div>
                          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{item.price.toFixed(2)} лв. × {item.qty}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => setCart(p => p.map(i => i.id === item.id ? { ...i, qty: Math.max(0, i.qty - 1) } : i).filter(i => i.qty > 0))}
                            style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 800, fontSize: 16 }}>−</button>
                          <span style={{ fontWeight: 800, minWidth: 22, textAlign: 'center', fontSize: 15 }}>{item.qty}</span>
                          <button onClick={() => setCart(p => p.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))}
                            style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 800, fontSize: 16 }}>+</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: '14px 0', fontSize: 14, color: '#4b5563', borderTop: '2px solid #f3f4f6', marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Продукти:</span><span>{cartTotal.toFixed(2)} лв.</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Доставка:</span><span style={{ color: shipping === 0 ? '#16a34a' : 'inherit', fontWeight: shipping === 0 ? 700 : 400 }}>{shipping === 0 ? '🎉 Безплатна!' : `${shipping.toFixed(2)} лв.`}</span></div>
                      {shipping > 0 && (
                        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 8 }}>
                          Добави още {(60 - cartTotal).toFixed(2)} лв. за безплатна доставка
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 18, color: '#111', borderTop: '2px solid #e5e7eb', paddingTop: 12, marginTop: 8 }}>
                        <span>Общо:</span><span style={{ color: '#16a34a' }}>{(cartTotal + shipping).toFixed(2)} лв.</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📦 Данни за доставка</div>
                    {[
                      { key: 'name', placeholder: 'Имена *', type: 'text' },
                      { key: 'phone', placeholder: 'Телефон *', type: 'tel' },
                      { key: 'email', placeholder: 'Имейл (за потвърждение)', type: 'email' },
                      { key: 'address', placeholder: 'Адрес *', type: 'text' },
                      { key: 'city', placeholder: 'Град *', type: 'text' },
                    ].map(field => (
                      <input
                        key={field.key}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={orderForm[field.key as keyof typeof orderForm]}
                        onChange={e => setOrderForm(f => ({ ...f, [field.key]: e.target.value }))}
                        style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', color: '#111', transition: 'border-color 0.2s' }}
                        onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#16a34a' }}
                        onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb' }}
                      />
                    ))}
                    <textarea
                      placeholder="Бележки към поръчката"
                      value={orderForm.notes}
                      onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', color: '#111' }}
                    />
                    <select
                      value={orderForm.payment}
                      onChange={e => setOrderForm(f => ({ ...f, payment: e.target.value }))}
                      style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, background: '#fff', color: '#111' }}
                    >
                      <option value="cod">💵 Наложен платеж</option>
                      <option value="bank">🏦 Банков превод</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {!orderDone && cart.length > 0 && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', background: '#fafaf8' }}>
                <button
                  className="order-btn"
                  onClick={submitOrder}
                  disabled={orderLoading || !orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city}
                  style={{
                    width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                    background: (!orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city) ? '#d1d5db' : '#16a34a',
                    color: '#fff', fontWeight: 900, fontSize: 17, cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: (!orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city) ? 'none' : '0 6px 20px rgba(22,163,74,0.4)',
                  }}
                >
                  {orderLoading ? 'Изпращане...' : `✅ Поръчай — ${(cartTotal + shipping).toFixed(2)} лв.`}
                </button>
                <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
                  🔒 Сигурна поръчка · Плащане при доставка
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
