'use client'
// app/page.tsx — v4 — всичко от базата данни

import { useState, useEffect } from 'react'

interface AffProd { id:string;name:string;subtitle:string;description:string;bullets:string[];image_url:string;affiliate_url:string;partner:string;slug:string;emoji:string;active:boolean;sort_order:number }
interface CatLink { id:string;label:string;href:string;emoji:string;partner:string|null;slug:string;active:boolean }
interface OwnProd { id:string;slug:string;name:string;description:string;price:number;compare_price:number;unit:string;stock:number;image_url:string;active:boolean;sort_order:number }

const CDN='https://d1yei2z3i6k35z.cloudfront.net/4263526/'

const FB_AFF:AffProd[]=[
  {id:'1',name:'Кристалон Зелен 18-18-18',subtitle:'⭐ Един от най-използваните торове от фермерите',description:'Водоразтворимият NPK тор с микроелементи — стимулира бърз растеж, силна коренова система и по-голям добив.',bullets:['100% водоразтворим','Съдържа микроелементи','За листно торене и фертигация','Увеличава добива и качеството'],image_url:CDN+'69b0fc97106ef_zelen-kristalon-230x400.webp',affiliate_url:'https://agroapteki.com/torove/npk-npk-torove/kristalon-zelen-specialen-18-18-18-kompleksen-tor/?tracking=6809eceee15ad',partner:'agroapteki',slug:'kristalon',emoji:'💎',active:true,sort_order:1},
  {id:'2',name:'Калитех',subtitle:'⭐ Предпазва доматите от върхово гниене',description:'Мощен калциев биостимулатор. Доставя лесно усвоим калций и предотвратява върхово гниене при доматите и пипера.',bullets:['Предпазва от върхово гниене','Подобрява качеството на плодовете','Увеличава добива','Устойчивост към суша и стрес','За листно пръскане и капково напояване'],image_url:CDN+'69b1000d9fb83_kaliteh-224x400.webp',affiliate_url:'https://agroapteki.com/torove/biostimulatori/kaliteh/?tracking=6809eceee15ad',partner:'agroapteki',slug:'kaliteh',emoji:'🛡️',active:true,sort_order:2},
  {id:'3',name:'Амалгерол',subtitle:'⭐ Легендарният стимулатор за всяка култура',description:'100% природен продукт от алпийски билки и морски водорасли. Щит срещу стреса при градушки, суша и студ.',bullets:['Мощен анти-стрес ефект','Ускорява разграждането на остатъци','Подобрява приема на азот','100% биоразградим','Естествен прилепител за препарати'],image_url:CDN+'69b11176b1758_amalgerol-300x400.webp',affiliate_url:'https://agroapteki.com/torove/techni-torove/amalgerol-za-uskoryavane-rasteja-na-kulturite/?tracking=6809eceee15ad',partner:'agroapteki',slug:'amalgerol',emoji:'🌿',active:true,sort_order:3},
  {id:'4',name:'Синейс 480 СК',subtitle:'⭐ Мощна био-защита срещу трипс и миниращ молец',description:'Революционен биологичен инсектицид на основата на спинозад. Спира трипса, колорадския бръмбар и Tuta absoluta само за часове. Карантинен срок само 3 дни!',bullets:['Ефективен срещу Калифорнийски трипс','Безмилостен към Tuta absoluta','Карантинен срок 3–7 дни','Устойчив на отмиване','За биологично земеделие'],image_url:CDN+'69b4f5319cf6f1.51072214_sineis-20-237x400.webp',affiliate_url:'https://agroapteki.com/preparati/insekticidi/sineis-480-sk/?tracking=6809eceee15ad',partner:'agroapteki',slug:'sineis',emoji:'🐛',active:true,sort_order:4},
  {id:'5',name:'Ридомил Голд Р ВГ',subtitle:'⭐ Стопира маната само за 48 часа',description:'Легендарен фунгицид — предпазва и лекува вече възникнала зараза. Прониква в растението за 30 минути, защитава дори новия прираст.',bullets:['Спира болестта до 2 дни след зараза','Комбинирано системно и контактно действие','Не се отмива от дъжд','Защитава новия прираст','Лесна разтворимост'],image_url:CDN+'69b4f6e3264510.81149458_ridomil-gold-300x400.webp',affiliate_url:'https://agroapteki.com/preparati/fungicidi/ridomil-gold/?tracking=6809eceee15ad',partner:'agroapteki',slug:'ridomil',emoji:'🍄',active:true,sort_order:5},
  {id:'6',name:'Турбо Рут',subtitle:'⭐ Мощно вкореняване и 100% прихващане',description:'Тайното оръжие при засаждане. Стимулира растежа на фините бели корени с хуминови киселини и желязо. Експлозивен ранен старт.',bullets:['Бързо вкореняване на разсада','Подобрява структурата около корена','Готови аминокиселини','Увеличава приема на микроелементи','Устойчивост към стрес'],image_url:CDN+'69b4fd32592803.63113743_turbo-rot-224x400.webp',affiliate_url:'https://agroapteki.com/torove/biostimulatori/turbo-rut/?tracking=6809eceee15ad',partner:'agroapteki',slug:'turbo-root',emoji:'🌱',active:true,sort_order:6},
  {id:'7',name:'Израелски Найлон GINEGAR',subtitle:'⭐ Световен стандарт за оранжерии',description:'Премиум оранжерийни фолиа от GINEGAR Israel. Многослойна технология — по-дълъг живот, по-стабилни свойства и по-малко проблеми.',bullets:['Многослойна технология до 9 слоя','UV защита и анти-капков ефект','Контрол на температурата','Стабилен добив сезон след сезон','Дългосрочна инвестиция'],image_url:CDN+'6940e17e0d4a3_pe-film-supflor-ginegar.jpg',affiliate_url:'https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar',partner:'oranjeriata',slug:'ginegar',emoji:'🏕️',active:true,sort_order:7},
  {id:'8',name:'Агрил — Израелски Агротекстил',subtitle:'⭐ Надеждна защита от слана и студ',description:'Висококачествен тъкан агротекстил от GINEGAR Israel. Защитава разсади и деликатни култури от слана, студ и вятър.',bullets:['Защита от слана и студ','Пропуска въздух и вода','Лек и лесен за работа','За разсади и деликатни култури','Дълготраен материал'],image_url:CDN+'694242e9c1baa_ginegar-logo-mk-group.600x600.png',affiliate_url:'https://oranjeriata.com/products/aksesoari-za-otglejdane-na-rasteniya/netukan-tekstil---agril',partner:'oranjeriata',slug:'agril',emoji:'🧵',active:true,sort_order:8},
]
const FB_LINKS:CatLink[]=[
  {id:'1',label:'🌱 Торове и Био Стимулатори',href:'https://agroapteki.com/torove/?tracking=6809eceee15ad',emoji:'🌱',partner:'agroapteki',slug:'torove',active:true},
  {id:'2',label:'💧 Изграждане на Поливни Системи',href:'https://agroapteki.com/polivni-sistemi/?tracking=6809eceee15ad',emoji:'💧',partner:'agroapteki',slug:'polivni',active:true},
  {id:'3',label:'🛡️ Защита от Болести и Вредители',href:'https://agroapteki.com/preparati/?tracking=6809eceee15ad',emoji:'🛡️',partner:'agroapteki',slug:'preparati',active:true},
  {id:'4',label:'🌳 Биологично Земеделие',href:'#',emoji:'🌳',partner:null,slug:'bio',active:true},
  {id:'5',label:'🌾 Качествени Семена за Вкусна Реколта',href:'https://agroapteki.com/semena/?tracking=6809eceee15ad',emoji:'🌾',partner:'agroapteki',slug:'semena',active:true},
  {id:'6',label:'🏕️ Израелски Найлон за Оранжерия',href:'https://oranjeriata.com/products/aksesoari-za-otglejdane-na-rasteniya/netukan-tekstil---agril',emoji:'🏕️',partner:'oranjeriata',slug:'najlon',active:true},
]
const FB_OWN:OwnProd[]=[
  {id:'1',slug:'atlas-terra',name:'Atlas Terra',description:'Органичен подобрител за почвата. Богат на хуминови киселини и органично вещество. Трансформира структурата, задържа влага, отключва блокираните микроелементи.',price:28.90,compare_price:35.00,unit:'кг',stock:999,image_url:CDN+'69b106e276e0e_Jan-2025-ATLAS-TERRA-AMINONITRO.jpg',active:true,sort_order:1},
  {id:'2',slug:'atlas-terra-amino',name:'Atlas Terra AMINO',description:'Аминокиселини за експлозивен растеж. Действа моментално при жега, студ и пресаждане. Предизвиква бърз и обилен цъфтеж. Видими резултати само след 48 часа.',price:32.90,compare_price:39.00,unit:'л',stock:999,image_url:CDN+'69b106e276e0e_Jan-2025-ATLAS-TERRA-AMINONITRO.jpg',active:true,sort_order:2},
]

export default function HomePage() {
  const [aff,setAff]=useState<AffProd[]>(FB_AFF)
  const [links,setLinks]=useState<CatLink[]>(FB_LINKS)
  const [own,setOwn]=useState<OwnProd[]>(FB_OWN)
  const [form,setForm]=useState({name:'',email:'',phone:''})
  const [sent,setSent]=useState(false)
  const [ldg,setLdg]=useState(false)
  const [cart,setCart]=useState<{id:string;name:string;price:number;qty:number;img:string}[]>([])
  const [cartOpen,setCartOpen]=useState(false)
  const [oForm,setOForm]=useState({customer_name:'',customer_phone:'',customer_email:'',customer_address:'',customer_city:'',customer_notes:'',payment_method:'cod'})
  const [done,setDone]=useState('')
  const [oLdg,setOLdg]=useState(false)
  const [scrolled,setScrolled]=useState(false)

  useEffect(()=>{
    Promise.all([
      fetch('/api/affiliate-products').then(r=>r.json()).catch(()=>null),
      fetch('/api/category-links').then(r=>r.json()).catch(()=>null),
      fetch('/api/own-products').then(r=>r.json()).catch(()=>null),
    ]).then(([a,c,o])=>{
      if(a?.products?.length)setAff(a.products)
      if(c?.links?.length)setLinks(c.links)
      if(o?.products?.length)setOwn(o.products)
    })
    const s=()=>setScrolled(window.scrollY>60)
    window.addEventListener('scroll',s)
    return()=>window.removeEventListener('scroll',s)
  },[])

  const addToCart=(p:OwnProd)=>setCart(prev=>{
    const ex=prev.find(c=>c.id===p.id)
    if(ex)return prev.map(c=>c.id===p.id?{...c,qty:c.qty+1}:c)
    return[...prev,{id:p.id,name:p.name,price:p.price,qty:1,img:p.image_url}]
  })
  const chgQty=(id:string,d:number)=>setCart(prev=>prev.map(c=>c.id===id?{...c,qty:Math.max(1,c.qty+d)}:c))
  const rmCart=(id:string)=>setCart(prev=>prev.filter(c=>c.id!==id))
  const qty=cart.reduce((s,c)=>s+c.qty,0)
  const sub=cart.reduce((s,c)=>s+c.price*c.qty,0)
  const ship=sub>=60?0:5.99
  const tot=sub+ship
  const track=(partner:string,slug:string)=>fetch('/api/analytics/affiliate-click',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({partner,product_slug:slug})}).catch(()=>{})
  const handleLead=async(e:React.FormEvent)=>{e.preventDefault();setLdg(true);await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,source:'naruchnik'})}).catch(()=>{});setSent(true);setLdg(false)}
  const handleOrder=async(e:React.FormEvent)=>{e.preventDefault();if(!cart.length)return;setOLdg(true);const items=cart.map(c=>({product_name:c.name,quantity:c.qty,unit_price:c.price,total_price:c.price*c.qty}));const res=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...oForm,items,subtotal:sub,shipping:ship,total:tot})}).catch(()=>null);const data=await res?.json().catch(()=>null);if(data?.order_number){setDone(data.order_number);setCart([]);setCartOpen(false)};setOLdg(false)}

  return(
    <div style={{fontFamily:"'Sora',system-ui,sans-serif",color:'#111',margin:0}}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:62px;transition:background .3s,box-shadow .3s}
.nav.sc{background:rgba(7,16,9,.96);backdrop-filter:blur(14px);box-shadow:0 2px 24px rgba(0,0,0,.35)}
.nlogo{color:#fff;font-size:16px;font-weight:800;text-decoration:none;display:flex;align-items:center;gap:8px;letter-spacing:-.02em}
.nlinks{display:flex;gap:2px}
.na{color:rgba(255,255,255,.75);text-decoration:none;font-size:13.5px;font-weight:500;padding:6px 12px;border-radius:8px;transition:all .2s}
.na:hover{color:#fff;background:rgba(255,255,255,.1)}
.ncart{background:#2d6a4f;color:#fff;border:none;border-radius:10px;padding:8px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:7px;transition:background .2s}
.ncart:hover{background:#40916c}
.cbadge{background:#4ade80;color:#052e16;width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}
@media(max-width:640px){.nlinks{display:none}}
.hero{background:linear-gradient(150deg,#040a06 0%,#0a1f13 25%,#0d2b1d 50%,#1b4332 72%,#2d6a4f 88%,#40916c 100%);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:110px 20px 90px;text-align:center;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 65% 45% at 62% 32%,rgba(74,222,128,.065) 0%,transparent 65%);pointer-events:none}
.hav{width:86px;height:86px;border-radius:50%;border:3px solid rgba(74,222,128,.35);object-fit:cover;margin-bottom:16px;box-shadow:0 0 0 6px rgba(74,222,128,.07)}
.hhandle{color:rgba(255,255,255,.4);font-size:13px;margin-bottom:16px;letter-spacing:.04em}
.htag{display:inline-flex;align-items:center;gap:8px;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.22);color:#4ade80;border-radius:99px;padding:6px 18px;font-size:13px;font-weight:600;margin-bottom:22px}
.hh1{color:#fff;font-size:clamp(28px,6vw,60px);font-weight:800;line-height:1.08;margin-bottom:18px;letter-spacing:-.035em}
.hh1 em{color:#4ade80;font-style:normal}
.hsub{color:rgba(255,255,255,.65);font-size:clamp(15px,2.2vw,19px);line-height:1.7;margin-bottom:14px;max-width:540px}
.hwarn{color:rgba(255,213,79,.82);font-size:14.5px;font-style:italic;margin-bottom:36px;max-width:460px;line-height:1.55}
.btnH{background:linear-gradient(135deg,#4ade80,#22c55e);color:#052e16;padding:17px 38px;border-radius:14px;text-decoration:none;font-weight:800;font-size:17px;display:inline-flex;align-items:center;gap:10px;box-shadow:0 8px 32px rgba(74,222,128,.28);transition:all .25s;border:none;cursor:pointer;font-family:inherit}
.btnH:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(74,222,128,.38)}
.scue{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.28);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:5px;animation:bob 2s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(7px)}}
.qsec{background:#fff;padding:26px 20px;border-bottom:1.5px solid #eee}
.qgrid{max-width:940px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(182px,1fr));gap:10px}
.qa{display:flex;align-items:center;gap:9px;background:#f8fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:13px 16px;text-decoration:none;color:#1a2e20;font-weight:600;font-size:13.5px;transition:all .2s}
.qa:hover{background:#f0fdf4;border-color:#86efac;transform:translateY(-1px);box-shadow:0 4px 12px rgba(45,106,79,.07)}
.lsec{background:linear-gradient(135deg,#f0fdf4,#dcfce7);padding:80px 20px}
.lcard{max-width:500px;margin:0 auto;background:#fff;border-radius:24px;padding:40px;box-shadow:0 8px 48px rgba(45,106,79,.12);border:1px solid #bbf7d0}
.lic{font-size:52px;text-align:center;margin-bottom:14px}
.lh2{font-size:26px;font-weight:800;text-align:center;letter-spacing:-.03em;margin-bottom:8px}
.lp{color:#6b7280;text-align:center;font-size:15px;line-height:1.65;margin-bottom:26px}
.fld{display:flex;flex-direction:column;gap:10px}
input,textarea,select{width:100%;padding:13px 16px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:inherit;font-size:15px;transition:border-color .2s;outline:none;color:#111;background:#fafafa}
input:focus,textarea:focus,select:focus{border-color:#2d6a4f;background:#fff}
.priv{font-size:12px;color:#9ca3af;text-align:center;margin-top:2px}
.okc{background:#f0fdf4;border:2px solid #86efac;border-radius:16px;padding:36px;text-align:center}
.psec{padding:80px 20px;max-width:980px;margin:0 auto}
.shd{text-align:center;margin-bottom:40px}
.sh2{font-size:clamp(24px,4vw,40px);font-weight:800;letter-spacing:-.03em}
.sp{color:#6b7280;font-size:16px;margin-top:8px}
.pgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}
.pcard{background:#fff;border:1.5px solid #e5e7eb;border-radius:22px;overflow:hidden;transition:all .25s}
.pcard:hover{box-shadow:0 10px 48px rgba(45,106,79,.15);border-color:#86efac;transform:translateY(-4px)}
.pimg{width:100%;height:230px;object-fit:cover;background:#f0fdf4}
.pbody{padding:24px}
.pbadge{display:inline-flex;align-items:center;gap:5px;background:#f0fdf4;color:#166534;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;margin-bottom:12px}
.pname{font-size:20px;font-weight:800;letter-spacing:-.02em;margin-bottom:5px}
.pdesc{color:#6b7280;font-size:13.5px;line-height:1.6;margin-bottom:18px}
.pprice{display:flex;align-items:baseline;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.pbig{font-size:30px;font-weight:800;color:#0d2b1d}
.pold{font-size:16px;color:#9ca3af;text-decoration:line-through}
.punit{font-size:13px;color:#9ca3af}
.poff{background:#fef3c7;color:#92400e;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:800}
.btnadd{background:#1b4332;color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;width:100%;display:flex;align-items:center;justify-content:center;gap:8px}
.btnadd:hover{background:#2d6a4f}
.combo{background:linear-gradient(135deg,#040a06,#0d2b1d);border-radius:22px;padding:44px 36px;text-align:center;max-width:720px;margin:56px auto 0;border:1px solid rgba(74,222,128,.16)}
.combo h3{color:#fff;font-size:24px;font-weight:800;margin-bottom:10px}
.combo p{color:rgba(255,255,255,.58);font-size:15px;margin-bottom:26px;line-height:1.65}
.combo em{color:#4ade80;font-style:normal;font-weight:700}
.btnC{background:linear-gradient(135deg,#4ade80,#22c55e);color:#052e16;padding:15px 34px;border-radius:12px;text-decoration:none;font-weight:800;font-size:16px;display:inline-flex;align-items:center;gap:9px;transition:all .25s;box-shadow:0 6px 24px rgba(74,222,128,.22)}
.btnC:hover{transform:translateY(-2px);box-shadow:0 10px 36px rgba(74,222,128,.32)}
.asec{background:#f8fafb;padding:80px 20px}
.ains{max-width:980px;margin:0 auto}
.agrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:22px;margin-top:40px}
.acard{background:#fff;border:1.5px solid #e5e7eb;border-radius:22px;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:all .25s;position:relative}
.acard:hover{box-shadow:0 10px 48px rgba(0,0,0,.1);border-color:#2d6a4f;transform:translateY(-4px)}
.acard::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#0d2b1d,#40916c)}
.aimg{width:100%;height:200px;object-fit:cover;background:#f0fdf4}
.aph{width:100%;height:200px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);display:flex;align-items:center;justify-content:center;font-size:72px}
.abody{padding:22px;flex:1;display:flex;flex-direction:column}
.abadge{font-size:12px;color:#6b7280;font-style:italic;margin-bottom:7px}
.aname{font-size:17px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px}
.adesc{font-size:13.5px;color:#6b7280;line-height:1.6;margin-bottom:14px}
.abuls{list-style:none;padding:0;flex:1;display:flex;flex-direction:column;gap:5px;margin-bottom:18px}
.abuls li{font-size:13px;color:#374151;display:flex;gap:7px}
.abuls li::before{content:'✔';color:#2d6a4f;font-weight:700;flex-shrink:0}
.acta{display:flex;align-items:center;justify-content:center;gap:7px;background:#0d2b1d;color:#fff;border-radius:10px;padding:12px;font-size:14px;font-weight:700;transition:background .2s}
.acta:hover{background:#1b4332}
.partnersec{background:#040a06;padding:40px 20px}
.plabel{color:rgba(255,255,255,.3);text-align:center;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px}
.prow{max-width:640px;margin:0 auto;display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.pa{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:rgba(255,255,255,.65);text-decoration:none;border-radius:12px;padding:11px 20px;font-size:13.5px;font-weight:600;transition:all .2s}
.pa:hover{background:rgba(255,255,255,.09);border-color:rgba(74,222,128,.3);color:#fff}
.footer{background:#020604;color:rgba(255,255,255,.25);padding:28px 20px;text-align:center;font-size:13px}
.footer a{color:rgba(255,255,255,.12);text-decoration:none}
.footer p+p{margin-top:6px}
.ovl{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;backdrop-filter:blur(5px)}
.cslide{position:fixed;right:0;top:0;bottom:0;width:100%;max-width:460px;background:#fff;z-index:201;display:flex;flex-direction:column;box-shadow:-12px 0 48px rgba(0,0,0,.22)}
.chd{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #f0f0f0;position:sticky;top:0;background:#fff;z-index:1}
.chd h3{font-size:18px;font-weight:800}
.clsbtn{background:#f4f4f4;border:none;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:19px;display:flex;align-items:center;justify-content:center}
.cbd{flex:1;overflow-y:auto;padding:14px 24px}
.crow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f5f5f5}
.cthumb{width:52px;height:52px;border-radius:10px;object-fit:cover;background:#f0fdf4;flex-shrink:0}
.cinfo{flex:1;min-width:0}
.ciname{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ciprice{font-size:12px;color:#6b7280;margin-top:2px}
.qc{display:flex;align-items:center;gap:7px}
.qb{background:#f4f4f4;border:none;border-radius:7px;width:28px;height:28px;cursor:pointer;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;transition:background .15s}
.qb:hover{background:#e5e7eb}
.qn{font-size:14px;font-weight:700;min-width:22px;text-align:center}
.rmb{background:none;border:none;cursor:pointer;color:#ef4444;font-size:18px;padding:4px;flex-shrink:0}
.cft{padding:18px 24px;border-top:1px solid #f0f0f0;background:#fafafa}
.cl{display:flex;justify-content:space-between;font-size:14px;color:#6b7280;margin-bottom:5px}
.cl.hint{color:#2d6a4f;font-size:12px}
.ctot{display:flex;justify-content:space-between;font-size:21px;font-weight:800;color:#0d2b1d;padding-top:10px;border-top:2px solid #e5e7eb;margin-top:4px}
.oform{background:#f8fafb;border-radius:14px;padding:20px;margin-top:14px}
.oform h4{font-size:14.5px;font-weight:800;margin-bottom:14px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:400px){.g2{grid-template-columns:1fr}}
.btnO{background:linear-gradient(135deg,#4ade80,#22c55e);color:#052e16;border:none;border-radius:12px;padding:15px;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;margin-top:4px}
.btnO:disabled{opacity:.6;cursor:default}
.fcart{position:fixed;bottom:24px;right:24px;z-index:150;background:linear-gradient(135deg,#1b4332,#2d6a4f);color:#fff;border:none;border-radius:18px;padding:14px 22px;fontWeight:800,fontSize:16,fontFamily:"'Sora',sans-serif";cursor:pointer;box-shadow:0 8px 32px rgba(45,106,79,.42);display:flex;align-items:center;gap:10px;transition:all .25s}
.fcart:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(45,106,79,.52)}
      `}</style>

      {/* NAV */}
      <nav className={`nav${scrolled?' sc':''}`}>
        <a href="#" className="nlogo">🍅 Denny Angelow</a>
        <div className="nlinks">
          <a href="#naruchnik" className="na">📗 Наръчник</a>
          <a href="#products" className="na">🛒 Продукти</a>
          <a href="#affiliate" className="na">🌿 Препоръки</a>
        </div>
        {cart.length>0&&<button className="ncart" onClick={()=>setCartOpen(true)}>🛒 Количка<span className="cbadge">{qty}</span></button>}
      </nav>

      {/* HERO */}
      <section className="hero">
        <img className="hav" src="https://d1yei2z3i6k35z.cloudfront.net/4263526/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg" alt="Denny Angelow"/>
        <p className="hhandle">@iammyoungmoney</p>
        <div className="htag">🍅 За градинари и фермери</div>
        <h1 className="hh1">Искаш <em>едри, здрави</em><br/>и сочни домати?</h1>
        <p className="hsub">Без болести, без гниене и без загубена реколта. С правилната грижа и нужните продукти можеш да отгледаш <strong style={{color:'#fff'}}>здрави и продуктивни растения</strong>, без излишни усилия.</p>
        <p className="hwarn">⚠️ Не рискувай да изхвърлиш продукцията си,<br/>само защото нямаш нужната информация навреме.</p>
        <a href="#naruchnik" className="btnH">📗 Изтегли наръчника БЕЗПЛАТНО</a>
        <div className="scue"><span>Виж повече</span><span>↓</span></div>
      </section>

      {/* QUICK LINKS */}
      <div className="qsec">
        <div className="qgrid">
          {links.filter(l=>l.active).map(l=>(
            <a key={l.id} className="qa" href={l.href} target={l.href!=='#'?'_blank':undefined} rel="noreferrer"
              onClick={()=>l.partner&&track(l.partner,l.slug)}>{l.label}</a>
          ))}
        </div>
      </div>

      {/* LEAD FORM */}
      <section id="naruchnik" className="lsec">
        <div className="lcard">
          <div className="lic">📗</div>
          <h2 className="lh2">Безплатен Наръчник</h2>
          <p className="lp">„Тайните на Едрите и Вкусни Домати" — всичко от което се нуждаеш, за да защитиш и подхраниш своите растения. PDF директно на имейла ти.</p>
          {sent?(
            <div className="okc">
              <div style={{fontSize:52,marginBottom:12}}>✅</div>
              <h3 style={{fontSize:22,fontWeight:800,marginBottom:8}}>Изпратен!</h3>
              <p style={{color:'#6b7280'}}>Провери имейла си — наръчникът е на път!</p>
            </div>
          ):(
            <form onSubmit={handleLead} className="fld">
              <input placeholder="Твоето име" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
              <input type="email" placeholder="Имейл адрес *" required value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/>
              <input placeholder="Телефон (по желание)" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/>
              <button type="submit" className="btnH" style={{justifyContent:'center',border:'none'}} disabled={ldg}>{ldg?'Изпращане...':'📗 Изпрати ми наръчника безплатно'}</button>
              <p className="priv">🔒 Без спам. Само полезно агро съдържание.</p>
            </form>
          )}
        </div>
      </section>

      {/* OWN PRODUCTS */}
      <section id="products" className="psec">
        <div className="shd">
          <h2 className="sh2">Продукти Atlas Terra</h2>
          <p className="sp">Директна поръчка с наложен платеж · Безплатна доставка над 60 лв.</p>
        </div>
        <div className="pgrid">
          {own.filter(p=>p.active).map(p=>(
            <div key={p.id} className="pcard">
              {p.image_url?<img className="pimg" src={p.image_url} alt={p.name} loading="lazy"/>:<div className="pimg" style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:72}}>🌱</div>}
              <div className="pbody">
                <div className="pbadge">⭐ Atlas Terra</div>
                <h3 className="pname">{p.name}</h3>
                <p className="pdesc">{p.description}</p>
                <div className="pprice">
                  <span className="pbig">{Number(p.price).toFixed(2)} лв.</span>
                  {p.compare_price&&<span className="pold">{Number(p.compare_price).toFixed(2)} лв.</span>}
                  <span className="punit">/ {p.unit}</span>
                  {p.compare_price&&<span className="poff">-{Math.round((1-p.price/p.compare_price)*100)}%</span>}
                </div>
                <button className="btnadd" onClick={()=>{addToCart(p);setCartOpen(true)}}>🛒 Добави в количката</button>
              </div>
            </div>
          ))}
        </div>
        <div className="combo">
          <h3>Комбинирай двата продукта</h3>
          <p>Не избирайте между здрава почва и бърз растеж. Комбинирайте Atlas Terra и Atlas Terra AMINO за <em>професионални резултати</em> още тази седмица!</p>
          <a href="https://atlasagro.eu/" target="_blank" rel="noreferrer" className="btnC" onClick={()=>track('atlasagro','combo')}>🛒 КУПИ от Производителя →</a>
        </div>
      </section>

      {/* AFFILIATE PRODUCTS */}
      <section id="affiliate" className="asec">
        <div className="ains">
          <div className="shd">
            <h2 className="sh2">Препоръчани продукти</h2>
            <p className="sp">Проверени продукти от доверени доставчици</p>
          </div>
          <div className="agrid">
            {aff.filter(p=>p.active).map(p=>(
              <a key={p.id} href={p.affiliate_url} target="_blank" rel="noreferrer" className="acard" onClick={()=>track(p.partner,p.slug)}>
                {p.image_url?<img className="aimg" src={p.image_url} alt={p.name} loading="lazy"/>:<div className="aph">{p.emoji}</div>}
                <div className="abody">
                  <p className="abadge">{p.subtitle}</p>
                  <h3 className="aname">{p.name}</h3>
                  <p className="adesc">{p.description}</p>
                  <ul className="abuls">{(p.bullets||[]).map((b,i)=><li key={i}>{b}</li>)}</ul>
                  <span className="acta">ПРОЧЕТИ ПОВЕЧЕ →</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      <div className="partnersec">
        <p className="plabel">Нашите партньори</p>
        <div className="prow">
          {[{l:'🌿 AgroApteki.bg',h:'https://agroapteki.com/?tracking=6809eceee15ad',p:'agroapteki',s:'main'},{l:'🏡 Oranjeriata.bg',h:'https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar',p:'oranjeriata',s:'main'},{l:'🌱 AtlasAgro.eu',h:'https://atlasagro.eu/',p:'atlasagro',s:'main'}].map(x=>(
            <a key={x.s} className="pa" href={x.h} target="_blank" rel="noreferrer" onClick={()=>track(x.p,x.s)}>{x.l} →</a>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} Denny Angelow · dennyangelow.com</p>
        <p><a href="/admin">admin</a></p>
      </footer>

      {/* CART SIDEBAR */}
      {cartOpen&&(
        <>
          <div className="ovl" onClick={()=>setCartOpen(false)}/>
          <div className="cslide">
            <div className="chd">
              <h3>🛒 Количка ({qty} бр.)</h3>
              <button className="clsbtn" onClick={()=>setCartOpen(false)}>✕</button>
            </div>
            <div className="cbd">
              {cart.length===0?<p style={{color:'#9ca3af',textAlign:'center',paddingTop:48,fontSize:15}}>Количката е празна</p>:
                cart.map(c=>(
                  <div key={c.id} className="crow">
                    {c.img?<img className="cthumb" src={c.img} alt={c.name}/>:<div className="cthumb" style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>🌱</div>}
                    <div className="cinfo"><div className="ciname">{c.name}</div><div className="ciprice">{c.price.toFixed(2)} лв. / бр.</div></div>
                    <div className="qc">
                      <button className="qb" onClick={()=>chgQty(c.id,-1)}>−</button>
                      <span className="qn">{c.qty}</span>
                      <button className="qb" onClick={()=>chgQty(c.id,1)}>+</button>
                    </div>
                    <span style={{fontWeight:800,minWidth:70,textAlign:'right',fontSize:14}}>{(c.price*c.qty).toFixed(2)} лв.</span>
                    <button className="rmb" onClick={()=>rmCart(c.id)}>✕</button>
                  </div>
                ))
              }
            </div>
            {cart.length>0&&(
              <div className="cft">
                <div className="cl"><span>Продукти</span><span>{sub.toFixed(2)} лв.</span></div>
                <div className="cl"><span>Доставка</span><span>{ship===0?'🎁 Безплатна':`${ship.toFixed(2)} лв.`}</span></div>
                {ship>0&&<div className="cl hint"><span>Добави още за безплатна доставка</span><span>+{(60-sub).toFixed(2)} лв.</span></div>}
                <div className="ctot"><span>Общо</span><span>{tot.toFixed(2)} лв.</span></div>
                {done?(
                  <div className="okc" style={{marginTop:14}}>
                    <div style={{fontSize:40,marginBottom:8}}>✅</div>
                    <h4 style={{fontSize:17,fontWeight:800,marginBottom:4}}>Поръчка {done}</h4>
                    <p style={{color:'#6b7280',fontSize:13}}>Ще се свържем с теб скоро!</p>
                  </div>
                ):(
                  <form onSubmit={handleOrder} className="oform">
                    <h4>📦 Данни за доставка</h4>
                    <div style={{display:'flex',flexDirection:'column',gap:9}}>
                      <div className="g2">
                        <input placeholder="Имe *" required value={oForm.customer_name} onChange={e=>setOForm(p=>({...p,customer_name:e.target.value}))}/>
                        <input placeholder="Телефон *" required value={oForm.customer_phone} onChange={e=>setOForm(p=>({...p,customer_phone:e.target.value}))}/>
                      </div>
                      <input placeholder="Имейл (по желание)" type="email" value={oForm.customer_email} onChange={e=>setOForm(p=>({...p,customer_email:e.target.value}))}/>
                      <input placeholder="Адрес *" required value={oForm.customer_address} onChange={e=>setOForm(p=>({...p,customer_address:e.target.value}))}/>
                      <input placeholder="Град *" required value={oForm.customer_city} onChange={e=>setOForm(p=>({...p,customer_city:e.target.value}))}/>
                      <textarea placeholder="Бележка" rows={2} value={oForm.customer_notes} onChange={e=>setOForm(p=>({...p,customer_notes:e.target.value}))} style={{resize:'vertical'}}/>
                      <select value={oForm.payment_method} onChange={e=>setOForm(p=>({...p,payment_method:e.target.value}))}>
                        <option value="cod">💵 Наложен платеж</option>
                        <option value="bank">🏦 Банков превод</option>
                      </select>
                      <button type="submit" className="btnO" disabled={oLdg}>{oLdg?'Изпращане...':`✓ Поръчай · ${tot.toFixed(2)} лв.`}</button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {cart.length>0&&!cartOpen&&<button className="fcart" onClick={()=>setCartOpen(true)}>🛒 {qty} · {tot.toFixed(2)} лв.</button>}
    </div>
  )
}
