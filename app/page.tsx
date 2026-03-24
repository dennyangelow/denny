'use client'

import { useState, useEffect, useRef } from 'react'

const CDN = 'https://d1yei2z3i6k35z.cloudfront.net/4263526'
const AFF = '?tracking=6809eceee15ad'

const PRODUCTS = [
  {
    id: 'kristalon',
    badge: '⭐ Най-използван от фермерите',
    img: `${CDN}/69b0fc97106ef_zelen-kristalon-230x400.webp`,
    name: 'Кристалон Зелен 18-18-18',
    subtitle: 'NPK тор с микроелементи',
    desc: 'Водоразтворимият Кристалон Зелен 18-18-18 стимулира бърз растеж, силна коренова система и по-голям добив. Осигурява идеално съотношение на азот, фосфор и калий за правилно развитие на растенията.',
    features: ['100% водоразтворим', 'Съдържа микроелементи', 'Листно торене и фертигация', 'Увеличава добива и качеството'],
    tag: 'ТОР',
    tagColor: '#16a34a',
    link: `https://agroapteki.com/torove/npk-npk-torove/kristalon-zelen-specialen-18-18-18-kompleksen-tor/${AFF}`,
  },
  {
    id: 'kaliteh',
    badge: '⭐ Предпазва от върхово гниене',
    img: `${CDN}/69b1000d9fb83_kaliteh-224x400.webp`,
    name: 'Калитех (Calitech)',
    subtitle: 'Калциев биостимулатор',
    desc: 'Мощен калциев биостимулатор, който доставя лесно усвоим калций и предотвратява върхово гниене при доматите и пипера. Помага за образуване на по-здрави, по-твърди и по-качествени плодове.',
    features: ['Предпазва от върхово гниене', 'Подобрява качеството на плодовете', 'Увеличава добива и захарите', 'Листно пръскане и капково'],
    tag: 'БИОСТИМ',
    tagColor: '#0891b2',
    link: `https://agroapteki.com/torove/biostimulatori/kaliteh/${AFF}`,
  },
  {
    id: 'amalgerol',
    badge: '⭐ Легендарният стимулатор',
    img: `${CDN}/69b11176b1758_amalgerol-300x400.webp`,
    name: 'Амалгерол',
    subtitle: 'Биостимулатор за здраве и имунитет',
    desc: '100% природен продукт от алпийски билки и морски водорасли. Действа като щит срещу стреса при градушки, суша или студ. Лекува почвата и помага на растенията да усвоят азота напълно.',
    features: ['Анти-стрес (слана, суша, хербициди)', 'Ускорява разграждането на остатъци', 'Подобрява приема на азот', 'Сертифициран за био земеделие'],
    tag: 'БИО',
    tagColor: '#65a30d',
    link: `https://agroapteki.com/torove/techni-torove/amalgerol-za-uskoryavane-rasteja-na-kulturite/${AFF}`,
  },
  {
    id: 'turbo-root',
    badge: '⭐ 100% прихващане на разсада',
    img: `${CDN}/69b4fd32592803.63113743_turbo-rot-224x400.webp`,
    name: 'Турбо Рут',
    subtitle: 'Биостимулатор за кореновата система',
    desc: 'Тайното оръжие при засаждане. Стимулира растежа на фините бели корени чрез комбинация от хуминови киселини и желязо. Осигурява експлозивен ранен старт и предпазва от шок при пресаждане.',
    features: ['Бързо вкореняване на разсада', 'Подобрява структурата около корена', 'Аминокиселини за бързо усвояване', 'Устойчивост на младите растения'],
    tag: 'КОРЕНИ',
    tagColor: '#b45309',
    link: `https://agroapteki.com/torove/biostimulatori/turbo-rut/${AFF}`,
  },
  {
    id: 'sineis',
    badge: '⭐ Само 3 дни карантинен срок',
    img: `${CDN}/69b4f5319cf6f1.51072214_sineis-20-237x400.webp`,
    name: 'Синейс 480 СК',
    subtitle: 'Биологичен инсектицид',
    desc: 'Революционен биологичен продукт базиран на спинозад. Спира атаките на колорадски бръмбар, трипс и миниращ молец само за часове. Изключително кратък карантинен срок — идеален за чиста реколта.',
    features: ['Ефективен срещу Калифорнийски трипс', 'Унищожава Tuta absoluta', 'Само 3-7 дни карантинен срок', 'Устойчив на отмиване'],
    tag: 'ЗАЩИТА',
    tagColor: '#dc2626',
    link: `https://agroapteki.com/preparati/insekticidi/sineis-480-sk/${AFF}`,
  },
  {
    id: 'ridomil',
    badge: '⭐ Стопира маната за 48 часа',
    img: `${CDN}/69b4f6e3264510.81149458_ridomil-gold-300x400.webp`,
    name: 'Ридомил Голд Р ВГ',
    subtitle: 'Системен фунгицид',
    desc: 'Легендарното решение което не само предпазва, но и лекува вече възникнала зараза. Прониква в растението за 30 минути и предпазва дори новите листа. Незаменим при влажно време.',
    features: ['Лечебно действие до 2 дни след зараза', 'Абсорбира се за 30 минути', 'Предпазва новия прираст', 'Лесна разтворимост'],
    tag: 'ФУНГИЦИД',
    tagColor: '#7c3aed',
    link: `https://agroapteki.com/preparati/fungicidi/ridomil-gold/${AFF}`,
  },
]

const ATLAS_PRODUCTS = [
  {
    id: 'atlas-terra',
    name: 'Atlas Terra',
    subtitle: 'Органичен подобрител на почвата',
    price: '28.90 лв./кг',
    badge: 'Фундамент за здрава почва',
    img: `${CDN}/69b106e276e0e_Jan-2025-ATLAS-TERRA-AMINONITRO.jpg`,
    features: [
      'Възстановява естественото плодородие',
      'Подобрява структурата на тежки почви',
      'Задържа влагата при засушаване',
      'Отключва блокирани микроелементи',
      '100% органичен — безопасен за почвата',
    ],
    desc: 'Богат на хуминови киселини и органично вещество. Трансформира структурата на почвата, прави я рохкава и способна да задържа влага. Идеален за изтощени почви.',
  },
  {
    id: 'atlas-amino',
    name: 'Atlas Terra AMINO',
    subtitle: 'Аминокиселини за експлозивен растеж',
    price: '32.90 лв./л',
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
  },
]

const AFFILIATE_CATEGORIES = [
  { icon: '🌱', label: 'Торове и Био Стимулатори', link: `https://agroapteki.com/torove/${AFF}` },
  { icon: '💧', label: 'Поливни Системи', link: `https://agroapteki.com/polivni-sistemi/${AFF}` },
  { icon: '🛡️', label: 'Защита от Болести', link: `https://agroapteki.com/preparati/${AFF}` },
  { icon: '🌾', label: 'Качествени Семена', link: `https://agroapteki.com/semena/${AFF}` },
  { icon: '🏕️', label: 'Израелски Найлон', link: 'https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar' },
  { icon: '🌳', label: 'Биологично Земеделие', link: '#' },
]

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function AnimatedSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
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
        transition: `opacity 0.6s ease ${idx * 80}ms, transform 0.6s ease ${idx * 80}ms`,
      }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: '#fff',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: hovered ? '0 20px 60px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.07)',
          transition: 'box-shadow 0.3s ease, transform 0.3s ease',
          transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          border: '1px solid #f0f0f0',
        }}
      >
        {/* Image */}
        <div style={{ position: 'relative', background: '#f8faf7', padding: '24px', display: 'flex', justifyContent: 'center', minHeight: 220 }}>
          <span style={{
            position: 'absolute', top: 12, left: 12,
            background: p.tagColor, color: '#fff',
            fontSize: 11, fontWeight: 700, padding: '4px 10px',
            borderRadius: 20, letterSpacing: '0.05em',
          }}>{p.tag}</span>
          <img
            src={p.img}
            alt={p.name}
            style={{ maxHeight: 200, maxWidth: 160, objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginBottom: 6, fontStyle: 'italic' }}>{p.badge}</div>
          <h3 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 800, color: '#1a1a1a', fontFamily: "'Georgia', serif" }}>{p.name}</h3>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>{p.subtitle}</div>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 16, flex: 1 }}>{p.desc}</p>

          <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none' }}>
            {p.features.map((f, i) => (
              <li key={i} style={{ fontSize: 13, color: '#374151', padding: '3px 0', display: 'flex', gap: 8 }}>
                <span style={{ color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>✓</span>
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
              display: 'block', textAlign: 'center',
              background: hovered ? '#15803d' : '#16a34a',
              color: '#fff', textDecoration: 'none',
              padding: '12px 20px', borderRadius: 12,
              fontWeight: 700, fontSize: 14,
              transition: 'background 0.2s ease',
            }}
          >
            Прочети повече →
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

  const submit = async (e: React.FormEvent) => {
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
    <div style={{ textAlign: 'center', padding: '32px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
      <h3 style={{ color: '#fff', fontSize: 22, margin: '0 0 8px', fontFamily: "'Georgia', serif" }}>Провери имейла си!</h3>
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>Изпратихме ти наръчника на <strong>{email}</strong></p>
    </div>
  )

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text"
          placeholder="Твоето име (по желание)"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            padding: '14px 18px', borderRadius: 12, border: 'none',
            fontSize: 15, outline: 'none', background: 'rgba(255,255,255,0.15)',
            color: '#fff', '::placeholder': { color: 'rgba(255,255,255,0.6)' } as any,
          }}
        />
        <input
          type="email"
          placeholder="Твоят имейл адрес *"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{
            padding: '14px 18px', borderRadius: 12, border: 'none',
            fontSize: 15, outline: 'none', background: 'rgba(255,255,255,0.15)',
            color: '#fff',
          }}
        />
        {error && <div style={{ color: '#fca5a5', fontSize: 13 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '15px 20px', borderRadius: 12, border: 'none',
            background: loading ? '#86efac' : '#fff',
            color: '#15803d', fontWeight: 800, fontSize: 16,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Изпращане...' : '📗 Изтегли БЕЗПЛАТНО →'}
        </button>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', margin: 0 }}>
          Без спам. Можеш да се отпишеш по всяко време.
        </p>
      </div>
    </form>
  )
}

export default function HomePage() {
  const [cartVisible, setCartVisible] = useState(false)
  const [cart, setCart] = useState<{ id: string; name: string; price: number; qty: number }[]>([])
  const [orderForm, setOrderForm] = useState({ name: '', phone: '', email: '', address: '', city: '', notes: '', payment: 'cod' })
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderDone, setOrderDone] = useState('')

  const addToCart = (product: typeof ATLAS_PRODUCTS[0]) => {
    const price = parseFloat(product.price)
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: product.id, name: product.name, price, qty: 1 }]
    })
    setCartVisible(true)
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
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
          subtotal: cartTotal,
          shipping,
          total: cartTotal + shipping,
        }),
      })
      const data = await res.json()
      if (data.order_number) {
        setOrderDone(data.order_number)
        setCart([])
      }
    } catch {}
    setOrderLoading(false)
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: 'DM Sans', -apple-system, sans-serif; background: #fafaf8; color: #1a1a1a; }
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');
        ::placeholder { color: rgba(255,255,255,0.55) !important; }
        input::placeholder { color: rgba(255,255,255,0.55) !important; }
        @keyframes fadeDown { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100% { transform:scale(1) } 50% { transform:scale(1.05) } }
        @keyframes float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-8px) } }
        .hero-badge { animation: float 3s ease-in-out infinite; }
        .cta-pulse { animation: pulse 2.5s ease-in-out infinite; }
        .cart-btn:hover { background: #15803d !important; }
        a { color: inherit; }
        @media(max-width:768px) {
          .products-grid { grid-template-columns: 1fr !important; }
          .atlas-grid { grid-template-columns: 1fr !important; }
          .hero-content { padding: 60px 20px 40px !important; }
          .stats-row { grid-template-columns: repeat(2,1fr) !important; }
          .categories-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {/* STICKY HEADER */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60,
        boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🍅</span>
          <span style={{ fontWeight: 800, fontSize: 17, fontFamily: "'Playfair Display', serif", color: '#1a1a1a' }}>Denny Angelow</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="https://agroapteki.com/?tracking=6809eceee15ad" target="_blank" rel="noopener"
            style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>
            Магазин
          </a>
          <button
            onClick={() => setCartVisible(true)}
            style={{
              background: '#16a34a', color: '#fff', border: 'none',
              borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            🛒 {cart.reduce((s, i) => s + i.qty, 0) > 0 ? `(${cart.reduce((s, i) => s + i.qty, 0)})` : ''}
          </button>
        </div>
      </header>

      {/* HERO */}
      <section style={{
        background: 'linear-gradient(145deg, #14532d 0%, #166534 40%, #15803d 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -60, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

        <div className="hero-content" style={{ maxWidth: 700, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center', position: 'relative', zIndex: 1 }}>

          <div className="hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 30, padding: '8px 20px', marginBottom: 24 }}>
            <img
              src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`}
              alt="Denny Angelow"
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)' }}
            />
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 600 }}>@dennyangelow · 85K+ последователи</span>
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(32px, 6vw, 52px)',
            color: '#fff', margin: '0 0 20px',
            lineHeight: 1.2, fontWeight: 800,
          }}>
            Тайните на Едрите<br />
            <span style={{ color: '#86efac' }}>и Вкусни Домати</span>
          </h1>

          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, lineHeight: 1.7, marginBottom: 12, maxWidth: 520, margin: '0 auto 16px' }}>
            Искаш едри, здрави и сочни домати — без болести, без гниене и без загубена реколта?
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 40 }}>
            ⚠️ Не рискувай реколтата си само защото нямаш нужната информация навреме.
          </p>

          {/* LEAD FORM */}
          <div style={{
            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
            borderRadius: 20, padding: '28px 28px',
            border: '1px solid rgba(255,255,255,0.2)',
            maxWidth: 440, margin: '0 auto',
          }}>
            <p style={{ color: '#86efac', fontWeight: 700, fontSize: 14, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📗 БЕЗПЛАТЕН НАРЪЧНИК
            </p>
            <h2 style={{ color: '#fff', fontSize: 20, margin: '0 0 20px', fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
              Изтегли "Тайните на Едрите Домати"
            </h2>
            <LeadForm />
          </div>

          {/* What's inside */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 32 }}>
            {['✓ Предпазване от болести', '✓ Кои торове работят', '✓ Календар за третиране', '✓ Грешки убиващи реколтата'].map(f => (
              <span key={f} style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 20 }}>{f}</span>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
          <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, textAlign: 'center' }}>
            {[
              { num: '85K+', label: 'Последователи', sub: 'Facebook, Instagram, TikTok' },
              { num: '6000+', label: 'Изтеглен наръчник', sub: 'Безплатни съвети' },
              { num: '100%', label: 'Органични продукти', sub: 'Безопасно за семейството' },
            ].map(s => (
              <div key={s.num}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#16a34a', fontFamily: "'Playfair Display', serif" }}>{s.num}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a', marginTop: 4 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AFFILIATE CATEGORIES */}
      <section style={{ padding: '60px 24px', maxWidth: 900, margin: '0 auto' }}>
        <AnimatedSection>
          <h2 style={{ textAlign: 'center', fontFamily: "'Playfair Display', serif", fontSize: 30, marginBottom: 8, fontWeight: 800 }}>
            Всичко за Твоята Градина
          </h2>
          <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: 36 }}>Избери категорията която те интересува</p>
        </AnimatedSection>
        <div className="categories-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {AFFILIATE_CATEGORIES.map((c, i) => (
            <AnimatedSection key={c.label} delay={i * 60}>
              <a
                href={c.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => fetch('/api/analytics/affiliate-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partner: 'agroapteki', product_slug: c.label }) })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: '#fff', borderRadius: 16, padding: '18px 20px',
                  textDecoration: 'none', color: '#1a1a1a',
                  border: '1px solid #e5e7eb',
                  fontWeight: 600, fontSize: 15,
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#16a34a'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(22,163,74,0.15)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                }}
              >
                <span style={{ fontSize: 28 }}>{c.icon}</span>
                {c.label}
              </a>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ATLAS TERRA DIRECT SALE */}
      <section style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', padding: '60px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <AnimatedSection>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{ background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 20, letterSpacing: '0.05em' }}>
                🏭 ДИРЕКТНО ОТ ПРОИЗВОДИТЕЛЯ
              </span>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, marginTop: 16, marginBottom: 8, fontWeight: 800 }}>
                Atlas Terra — Поръчай Директно
              </h2>
              <p style={{ color: '#374151', fontSize: 16 }}>Два продукта. Един резултат — здрава почва и мощен растеж.</p>
            </div>
          </AnimatedSection>

          <div className="atlas-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 24, marginBottom: 36 }}>
            {ATLAS_PRODUCTS.map((p, i) => (
              <AnimatedSection key={p.id} delay={i * 100}>
                <div style={{
                  background: '#fff', borderRadius: 20, overflow: 'hidden',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                  border: '1px solid #d1fae5',
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ position: 'relative' }}>
                    <img src={p.img} alt={p.name} style={{ width: '100%', height: 220, objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)',
                    }} />
                    <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
                      <div style={{ fontSize: 12, color: '#86efac', fontWeight: 600, marginBottom: 4 }}>⭐ {p.badge}</div>
                      <h3 style={{ color: '#fff', margin: 0, fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 800 }}>{p.name}</h3>
                      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{p.subtitle}</div>
                    </div>
                  </div>
                  <div style={{ padding: '20px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{p.desc}</p>
                    <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none' }}>
                      {p.features.map(f => (
                        <li key={f} style={{ fontSize: 13, color: '#374151', padding: '3px 0', display: 'flex', gap: 8 }}>
                          <span style={{ color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                        </li>
                      ))}
                    </ul>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{p.price}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>Доставка от 5.99 лв.</div>
                      </div>
                      <button
                        className="cart-btn"
                        onClick={() => addToCart(p)}
                        style={{
                          background: '#16a34a', color: '#fff', border: 'none',
                          borderRadius: 12, padding: '12px 24px', cursor: 'pointer',
                          fontWeight: 700, fontSize: 15, transition: 'background 0.2s',
                        }}
                      >
                        🛒 Добави
                      </button>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 15 }}>
                Или поръчай директно от производителя AtlasAgro
              </p>
              <a
                href="https://atlasagro.eu/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => fetch('/api/analytics/affiliate-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partner: 'atlasagro', product_slug: 'atlas-terra' }) })}
                style={{
                  display: 'inline-block',
                  background: '#15803d', color: '#fff',
                  padding: '14px 32px', borderRadius: 14,
                  textDecoration: 'none', fontWeight: 700, fontSize: 16,
                }}
              >
                🛒 Купи от AtlasAgro.eu
              </a>
              <div style={{ marginTop: 12, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                🚚 Безплатна доставка над 60 лв.
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* PRODUCTS GRID — AGROAPTEKI */}
      <section style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <AnimatedSection>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#16a34a', textTransform: 'uppercase' }}>Препоръчани продукти</span>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, margin: '12px 0 8px', fontWeight: 800 }}>
              Проверени от Практиката
            </h2>
            <p style={{ color: '#6b7280', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>
              Продуктите, които използвам и препоръчвам за здрави и продуктивни растения
            </p>
          </div>
        </AnimatedSection>

        <div className="products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {PRODUCTS.map((p, i) => <ProductCard key={p.id} p={p} idx={i} />)}
        </div>
      </section>

      {/* GINEGAR GREENHOUSE */}
      <section style={{ background: '#1a1a2e', padding: '60px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 600, height: '100%', opacity: 0.15, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at top right, #16a34a, transparent 60%)' }} />
        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <AnimatedSection>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center' }}>
              <div style={{ flex: '1 1 400px' }}>
                <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 20, letterSpacing: '0.06em' }}>🏕️ ИЗРАЕЛСКА ТЕХНОЛОГИЯ</span>
                <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#fff', fontSize: 32, margin: '16px 0 12px', fontWeight: 800 }}>
                  Ginegar — Премиум Найлон за Оранжерии
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
                  Световен стандарт за здравина, светлина и дълъг живот. GINEGAR не са най-евтиният избор — те са изборът, който излиза най-изгоден с времето.
                </p>
                <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none' }}>
                  {[
                    '9-слойна технология (всеки слой с функция)',
                    'UV защита и анти-капка ефект',
                    'Равномерно осветление на растенията',
                    'По-малко подмяна — по-ниска цена на сезон',
                  ].map(f => (
                    <li key={f} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, padding: '4px 0', display: 'flex', gap: 10 }}>
                      <span style={{ color: '#86efac', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <a
                  href="https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fetch('/api/analytics/affiliate-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partner: 'oranjeriata', product_slug: 'ginegar' }) })}
                  style={{
                    display: 'inline-block', background: '#16a34a',
                    color: '#fff', textDecoration: 'none',
                    padding: '14px 28px', borderRadius: 12,
                    fontWeight: 700, fontSize: 15,
                  }}
                >
                  👉 Разгледай фолиата на Ginegar
                </a>
              </div>

              <div style={{ flex: '0 0 280px', textAlign: 'center' }}>
                <img
                  src={`${CDN}/6940e17e0d4a3_pe-film-supflor-ginegar.jpg`}
                  alt="Ginegar фолио"
                  style={{ width: '100%', maxWidth: 280, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
                />
                <img
                  src={`${CDN}/694242e9c1baa_ginegar-logo-mk-group.600x600.png`}
                  alt="Ginegar logo"
                  style={{ width: 100, marginTop: 16, filter: 'brightness(0) invert(1)', opacity: 0.7 }}
                />
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* TESTIMONIAL / SOCIAL PROOF */}
      <section style={{ padding: '60px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <AnimatedSection>
            <img
              src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`}
              alt="Denny Angelow"
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #16a34a', marginBottom: 20 }}
            />
            <blockquote style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22, color: '#1a1a1a',
              fontStyle: 'italic', lineHeight: 1.6,
              margin: '0 0 20px',
            }}>
              "С правилната грижа и нужните продукти можеш да отгледаш здрави и продуктивни растения, без излишни усилия."
            </blockquote>
            <div style={{ fontWeight: 700, color: '#16a34a' }}>Denny Angelow</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>@iammyoungmoney · Агро Консултант</div>
          </AnimatedSection>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#14532d', color: 'rgba(255,255,255,0.8)', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🍅</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: '#fff', fontWeight: 700, marginBottom: 8 }}>Denny Angelow</div>
          <p style={{ fontSize: 14, marginBottom: 20 }}>Имаш въпроси? Пиши ни на{' '}
            <a href="mailto:support@dennyangelow.com" style={{ color: '#86efac' }}>support@dennyangelow.com</a>
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 24, fontSize: 14 }}>
            <a href="https://agroapteki.com/?tracking=6809eceee15ad" target="_blank" rel="noopener" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>AgroApteki</a>
            <a href="https://oranjeriata.com/" target="_blank" rel="noopener" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Oranjeriata</a>
            <a href="https://atlasagro.eu/" target="_blank" rel="noopener" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>AtlasAgro</a>
            <a href="/admin" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 12 }}>Admin</a>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>© 2025-2026 Denny Angelow · Всички права запазени</div>
        </div>
      </footer>

      {/* CART DRAWER */}
      {cartVisible && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div onClick={() => setCartVisible(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: 480,
            background: '#fff', animation: 'fadeDown 0.3s ease',
            display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 40px rgba(0,0,0,0.2)',
          }}>
            {/* Cart header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 20 }}>🛒 Количка</h3>
              <button onClick={() => setCartVisible(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {orderDone ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 48 }}>🎉</div>
                  <h3 style={{ color: '#16a34a', fontFamily: "'Playfair Display', serif" }}>Поръчката е приета!</h3>
                  <p style={{ color: '#374151' }}>Номер: <strong>{orderDone}</strong></p>
                  <p style={{ color: '#6b7280', fontSize: 14 }}>Ще се свържем с теб до 24 часа.</p>
                  <button onClick={() => { setCartVisible(false); setOrderDone('') }} style={{
                    background: '#16a34a', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700,
                  }}>Затвори</button>
                </div>
              ) : cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                  <p>Количката е празна</p>
                </div>
              ) : (
                <>
                  {/* Cart items */}
                  <div style={{ marginBottom: 24 }}>
                    {cart.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: 13, color: '#6b7280' }}>{item.price.toFixed(2)} лв. × {item.qty}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => setCart(p => p.map(i => i.id === item.id ? { ...i, qty: Math.max(0, i.qty - 1) } : i).filter(i => i.qty > 0))}
                            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 700 }}>−</button>
                          <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                          <button onClick={() => setCart(p => p.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))}
                            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 700 }}>+</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: '12px 0', fontSize: 14, color: '#6b7280' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Продукти:</span><span>{cartTotal.toFixed(2)} лв.</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Доставка:</span><span>{shipping === 0 ? '🎉 Безплатна' : `${shipping.toFixed(2)} лв.`}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, color: '#1a1a1a', marginTop: 8, borderTop: '2px solid #e5e7eb', paddingTop: 8 }}>
                        <span>Общо:</span><span style={{ color: '#16a34a' }}>{(cartTotal + shipping).toFixed(2)} лв.</span>
                      </div>
                    </div>
                  </div>

                  {/* Order form */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>📦 Данни за доставка</div>
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
                        value={(orderForm as any)[field.key]}
                        onChange={e => setOrderForm(f => ({ ...f, [field.key]: e.target.value }))}
                        style={{
                          padding: '11px 14px', borderRadius: 10, border: '1px solid #e5e7eb',
                          fontSize: 14, outline: 'none', color: '#1a1a1a',
                        }}
                      />
                    ))}
                    <textarea
                      placeholder="Бележки към поръчката"
                      value={orderForm.notes}
                      onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                    />
                    <select
                      value={orderForm.payment}
                      onChange={e => setOrderForm(f => ({ ...f, payment: e.target.value }))}
                      style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, background: '#fff' }}
                    >
                      <option value="cod">Наложен платеж</option>
                      <option value="bank">Банков превод</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {!orderDone && cart.length > 0 && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={submitOrder}
                  disabled={orderLoading || !orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 12, border: 'none',
                    background: (!orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city) ? '#d1d5db' : '#16a34a',
                    color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {orderLoading ? 'Изпращане...' : `Поръчай — ${(cartTotal + shipping).toFixed(2)} лв.`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
