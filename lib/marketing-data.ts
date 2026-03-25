// lib/marketing-data.ts — централни данни за маркетинг страницата

export const CDN = 'https://d1yei2z3i6k35z.cloudfront.net/4263526'
export const AFF = '?tracking=6809eceee15ad'

// ── Категорийни линкове ─────────────────────────────────────
export const AFFILIATE_CATEGORIES = [
  { icon: '🌱', label: 'Торове и Био Стимулатори',       link: `https://agroapteki.com/torove/${AFF}`,         color: '#16a34a' },
  { icon: '💧', label: 'Поливни Системи',                link: `https://agroapteki.com/polivni-sistemi/${AFF}`, color: '#0ea5e9' },
  { icon: '🛡️', label: 'Защита от Болести',              link: `https://agroapteki.com/preparati/${AFF}`,       color: '#dc2626' },
  { icon: '🌳', label: 'Биологично Земеделие',            link: '#',                                             color: '#65a30d' },
  { icon: '🌾', label: 'Качествени Семена',               link: `https://agroapteki.com/semena/${AFF}`,          color: '#d97706' },
  { icon: '🏕️', label: 'Найлон за Оранжерия',            link: 'https://oranjeriata.com/products/aksesoari-za-otglejdane-na-rasteniya/netukan-tekstil---agril', color: '#7c3aed' },
]

// ── Афилиейт продукти (карти) ───────────────────────────────
export const PRODUCTS = [
  {
    id: 'kristalon',
    name: 'Кристалон Зелен 18-18-18',
    badge: 'Най-използван',
    subtitle: 'NPK тор с микроелементи',
    desc: 'Водоразтворим NPK тор — стимулира бърз растеж, силна коренова система и по-голям добив.',
    features: ['100% водоразтворим', 'Съдържа микроелементи', 'За листно торене и фертигация', 'Увеличава добива и качеството'],
    img: `${CDN}/69b0fc97106ef_zelen-kristalon-230x400.webp`,
    link: `https://agroapteki.com/torove/npk-npk-torove/kristalon-zelen-specialen-18-18-18-kompleksen-tor/${AFF}`,
    partner: 'agroapteki',
    color: '#16a34a',
    tag: '⭐ Фермерски фаворит',
  },
  {
    id: 'kaliteh',
    name: 'Калитех',
    badge: 'Анти-гниене',
    subtitle: 'Калциев биостимулатор',
    desc: 'Мощен калциев биостимулатор — доставя лесно усвоим калций и предотвратява върхово гниене.',
    features: ['Предпазва от върхово гниене', 'По-здрави и твърди плодове', 'Увеличава добива', 'Устойчивост към суша'],
    img: `${CDN}/69b1000d9fb83_kaliteh-224x400.webp`,
    link: `https://agroapteki.com/torove/biostimulatori/kaliteh/${AFF}`,
    partner: 'agroapteki',
    color: '#0369a1',
    tag: '🛡️ Защита на плода',
  },
  {
    id: 'amalgerol',
    name: 'Амалгерол',
    badge: 'Легендарен',
    subtitle: 'Биостимулатор за имунитет',
    desc: '100% природен продукт от алпийски билки и морски водорасли — щит срещу стреса.',
    features: ['Мощен анти-стрес ефект', 'Ускорява разграждането', 'Подобрява приема на азот', '100% биоразградим'],
    img: `${CDN}/69b11176b1758_amalgerol-300x400.webp`,
    link: `https://agroapteki.com/torove/techni-torove/amalgerol-za-uskoryavane-rasteja-na-kulturite/${AFF}`,
    partner: 'agroapteki',
    color: '#059669',
    tag: '🌿 100% Природен',
  },
  {
    id: 'sineis',
    name: 'Синейс 480 СК',
    badge: 'Биo защита',
    subtitle: 'Инсектицид на основата на спинозад',
    desc: 'Революционен биологичен инсектицид. Спира трипса, Tuta absoluta и колорадския бръмбар за часове.',
    features: ['Ефективен срещу трипс', 'Безмилостен към Tuta absoluta', 'Карантинен срок само 3 дни', 'Устойчив на отмиване'],
    img: `${CDN}/69b4f5319cf6f1.51072214_sineis-20-237x400.webp`,
    link: `https://agroapteki.com/preparati/insekticidi/sineis-480-sk/${AFF}`,
    partner: 'agroapteki',
    color: '#dc2626',
    tag: '🐛 Спира вредителите',
  },
  {
    id: 'ridomil',
    name: 'Ридомил Голд Р ВГ',
    badge: 'Срещу мана',
    subtitle: 'Системен фунгицид',
    desc: 'Легендарен фунгицид — предпазва и лекува вече възникнала зараза. Прониква за 30 минути.',
    features: ['Лечебно действие в 48ч', 'Не се отмива от дъжд', 'Защита на новия прираст', 'Лесна разтворимост'],
    img: `${CDN}/69b4f6e3264510.81149458_ridomil-gold-300x400.webp`,
    link: `https://agroapteki.com/preparati/fungicidi/ridomil-gold/${AFF}`,
    partner: 'agroapteki',
    color: '#7c3aed',
    tag: '🍄 Стопира маната',
  },
  {
    id: 'turbo-root',
    name: 'Турбо Рут',
    badge: 'За вкореняване',
    subtitle: 'Биостимулатор на корените',
    desc: 'Тайното оръжие при засаждане. Стимулира растежа на фините корени с хуминови киселини.',
    features: ['Бързо вкореняване', 'Подобрява почвата около корена', 'Готови аминокиселини', 'Устойчивост към стрес'],
    img: `${CDN}/69b4fd32592803.63113743_turbo-rot-224x400.webp`,
    link: `https://agroapteki.com/torove/biostimulatori/turbo-rut/${AFF}`,
    partner: 'agroapteki',
    color: '#92400e',
    tag: '🌱 100% прихващане',
  },
]

// ── Atlas Terra (собствени продукти за продажба) ────────────
export const ATLAS_PRODUCTS = [
  {
    id: 'atlas-terra',
    name: 'Atlas Terra',
    subtitle: 'Органичен подобрител на почвата',
    badge: 'Фундамент за здрава почва',
    emoji: '🌱',
    img: `${CDN}/69b106e276e0e_Jan-2025-ATLAS-TERRA-AMINONITRO.jpg`,
    desc: 'Богат на хуминови киселини и органично вещество — трансформира почвата, задържа влага и отключва блокираните хранителни вещества.',
    features: [
      'Възстановява естественото плодородие',
      'Подобрява структурата на тежки почви',
      'Задържа влагата по-дълго',
      'Отключва блокираните микроелементи',
      '100% органичен — безопасен за почвата',
    ],
    price: 28.90,
    comparePrice: 35.00,
    unit: 'кг',
    priceLabel: '28.90 лв.',
  },
  {
    id: 'atlas-terra-amino',
    name: 'Atlas Terra AMINO',
    subtitle: 'Аминокиселини за експлозивен растеж',
    badge: 'Видими резултати за 48ч',
    emoji: '⚡',
    img: `${CDN}/69b106e276e0e_Jan-2025-ATLAS-TERRA-AMINONITRO.jpg`,
    desc: '"Бързата храна" за доматите, краставиците и зеленчуците. Действа моментално при жега, студ и след пресаждане.',
    features: [
      'Висока концентрация свободни аминокиселини',
      'Предизвиква бърз и обилен цъфтеж',
      'Мощен анти-стрес ефект',
      'За листно пръскане и капково поливане',
      'Видими резултати само след 48 часа',
    ],
    price: 32.90,
    comparePrice: 39.00,
    unit: 'л',
    priceLabel: '32.90 лв.',
  },
]

// ── Отзиви ─────────────────────────────────────────────────
export const TESTIMONIALS = [
  { name: 'Иван Петров', location: 'Пловдив', stars: 5, avatar: '👨‍🌾', text: 'Използвам Atlas Terra вече втора година. Разликата е видима — почвата е по-рохкава, доматите — по-едри и вкусни. Силно препоръчвам!' },
  { name: 'Мария Стоянова', location: 'Стара Загора', stars: 5, avatar: '👩‍🌾', text: 'Калитех спаси реколтата ми! Имах проблем с върхово гниене и след два пръскания проблемът изчезна. Благодаря на Дени за препоръката.' },
  { name: 'Георги Николов', location: 'Видин', stars: 5, avatar: '🧑‍🌾', text: 'Наръчникът е истинско съкровище. Следвам съветите и тази година имам рекордна реколта. Амалгерол е задължителен в моята оранжерия.' },
  { name: 'Елена Димитрова', location: 'Бургас', stars: 5, avatar: '👩‍🌾', text: 'Синейс се справи с трипса за броени дни. Краткият карантинен срок е огромен плюс — домати за семейството без страх.' },
  { name: 'Петър Иванов', location: 'Русе', stars: 5, avatar: '👨‍🌾', text: 'Турбо Рут при засаждането е магия. 100% прихващане на разсадите тази пролет. Вече не мога да си представя без него.' },
  { name: 'Надя Христова', location: 'Варна', stars: 5, avatar: '👩‍🌾', text: 'Ginegar фолиото издържа вече 3 сезона без промяна. Инвестицията се изплати многократно. Препоръчвам на всеки с оранжерия.' },
]
