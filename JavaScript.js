/* ============================================================
   bungkusin.store — Single-file app
   Firebase Modular SDK · Vanilla JS ES6+
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase, ref, set, push, onValue, get, update, remove, query,
  orderByChild, equalTo, serverTimestamp, runTransaction, child
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHr0eemIkfHNFDUkSaFDklp_c1OgmSnl8",
  authDomain: "mybro-9ba5f.firebaseapp.com",
  databaseURL: "https://mybro-9ba5f-default-rtdb.firebaseio.com/",
  projectId: "mybro-9ba5f"
};
const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);
const auth = getAuth(fbApp);

/* ============================================================
   UTILS
   ============================================================ */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
const rupiah = n => "Rp" + (Number(n)||0).toLocaleString("id-ID");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate = ts => { if(!ts) return "-"; return new Date(ts).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}); };
const fmtDateTime = ts => { if(!ts) return "-"; return new Date(ts).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); };
const timeAgo = ts => {
  if(!ts) return "";
  const s = Math.floor((Date.now()-new Date(ts).getTime())/1000);
  if(s<60) return "baru saja";
  if(s<3600) return Math.floor(s/60)+" mnt lalu";
  if(s<86400) return Math.floor(s/3600)+" jam lalu";
  if(s<604800) return Math.floor(s/86400)+" hari lalu";
  return fmtDate(ts);
};
const uidGen = len => { const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s=""; for(let i=0;i<len;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; };
const orderIdGen = () => { const d=new Date(); return `BKS-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${uidGen(6)}`; };
const icon = (n, cls="ic") => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

const store = {
  get(k, def=null){ try{ const v=localStorage.getItem("bks_"+k); return v?JSON.parse(v):def; }catch{ return def; } },
  set(k, v){ try{ localStorage.setItem("bks_"+k, JSON.stringify(v)); }catch{} },
  del(k){ try{ localStorage.removeItem("bks_"+k); }catch{} }
};

const toast = (msg, type="info") => {
  const root = $("#toasts"); if(!root) return;
  const el = document.createElement("div");
  el.className = "toast " + type;
  const ic = type==="ok"?"check":type==="err"?"x":"info";
  el.innerHTML = `<svg class="ic"><use href="#i-${ic}"/></svg><span>${esc(msg)}</span>`;
  root.appendChild(el);
  setTimeout(()=>{ el.classList.add("out"); setTimeout(()=>el.remove(),250); }, 2700);
};

const openModal = ({title, body, footer, size=""}) => {
  const root = $("#modalRoot");
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(title||"")}</h3>
        <button class="icon-btn" data-close aria-label="Tutup"><svg class="ic"><use href="#i-x"/></svg></button>
      </div>
      <div class="modal-body">${body||""}</div>
      ${footer?`<div class="modal-foot">${footer}</div>`:""}
    </div>`;
  root.appendChild(back);
  const close = () => back.remove();
  back.querySelector("[data-close]").onclick = close;
  back.addEventListener("click", e => { if(e.target===back) close(); });
  return { el: back, close };
};

const confirmDialog = (title, msg) => new Promise(res => {
  const m = openModal({
    title, body:`<p class="muted">${esc(msg)}</p>`,
    footer:`<button class="btn btn-outline btn-sm" data-c>Batal</button>
            <button class="btn btn-danger btn-sm" data-ok>Ya, Lanjutkan</button>`
  });
  m.el.querySelector("[data-c]").onclick = () => { m.close(); res(false); };
  m.el.querySelector("[data-ok]").onclick = () => { m.close(); res(true); };
});

const statusLabel = {
  pending_payment:"Menunggu Pembayaran",
  waiting_verification:"Menunggu Verifikasi",
  paid:"Dibayar", completed:"Selesai", cancelled:"Dibatalkan"
};

const placeholderImg = (seed="") => {
  const hue = (String(seed).split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % 360;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='hsl(${hue},65%,55%)'/>
      <stop offset='1' stop-color='hsl(${(hue+50)%360},70%,40%)'/>
    </linearGradient></defs>
    <rect width='320' height='200' fill='url(%23g)'/>
    <text x='160' y='118' font-family='sans-serif' font-size='54' font-weight='900' fill='white' text-anchor='middle' opacity='0.95'>b.</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
};

const skelGrid = (n=6) => `<div class="grid">${Array.from({length:n}).map(()=>`
  <div class="card"><div class="skel skel-card"></div>
    <div class="card-body"><div class="skel skel-line" style="width:40%"></div>
    <div class="skel skel-line" style="width:90%"></div>
    <div class="skel skel-line" style="width:60%"></div></div>
  </div>`).join("")}</div>`;

const emptyState = (ic, title, desc, cta, ctaLabel) => `
  <div class="empty">
    <svg class="ic"><use href="#i-${ic}"/></svg>
    <h3>${esc(title)}</h3>
    <p>${esc(desc||"")}</p>
    ${cta?`<a class="btn btn-brand" href="${cta}">${esc(ctaLabel||"Mulai")}</a>`:""}
  </div>`;

/* ============================================================
   AUTH
   ============================================================ */
let currentUser = null;
let currentProfile = null;
const authListeners = new Set();
const emitAuth = () => authListeners.forEach(cb => cb(currentUser, currentProfile));
const getUser = () => currentUser;
const getProfile = () => currentProfile;
const isAdmin = () => currentProfile?.role === "admin";

const initAuth = () => new Promise(resolve => {
  onAuthStateChanged(auth, async user => {
    currentUser = user || null;
    if(user){
      try {
        const snap = await get(ref(db, "users/"+user.uid));
        if(snap.exists()) currentProfile = snap.val();
        else {
          currentProfile = { uid:user.uid, email:user.email, displayName:user.displayName||user.email.split("@")[0], role:"user", createdAt:Date.now() };
          await set(ref(db, "users/"+user.uid), currentProfile);
        }
      } catch(e){ currentProfile = { email:user.email, role:"user" }; }
    } else currentProfile = null;
    emitAuth();
    resolve();
  });
});

const register = async (name, email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName:name });
  await set(ref(db, "users/"+cred.user.uid), {
    uid:cred.user.uid, email, displayName:name, role:"user", createdAt:Date.now(), suspended:false
  });
  return cred.user;
};
const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
const logout = () => signOut(auth);
const resetPassword = (email) => sendPasswordResetEmail(auth, email);

const friendlyError = e => {
  const c = e?.code || "";
  if(c.includes("email-already-in-use")) return "Email sudah terdaftar";
  if(c.includes("wrong-password")||c.includes("invalid-credential")) return "Email atau password salah";
  if(c.includes("user-not-found")) return "Akun tidak ditemukan";
  if(c.includes("invalid-email")) return "Format email tidak valid";
  if(c.includes("weak-password")) return "Password terlalu lemah (min 6)";
  if(c.includes("too-many-requests")) return "Terlalu banyak percobaan. Coba lagi nanti.";
  return e.message || "Terjadi kesalahan";
};

/* ============================================================
   CART & FAVORITES
   ============================================================ */
const CART_KEY = "cart", FAV_KEY = "favorites";
const cartListeners = new Set();
const getCart = () => store.get(CART_KEY, []);
const getFavorites = () => store.get(FAV_KEY, []);
const onCartChange = cb => { cartListeners.add(cb); cb(getCart()); return ()=>cartListeners.delete(cb); };
const saveCart = c => { store.set(CART_KEY, c); cartListeners.forEach(cb=>cb(c)); updateBadges(); };
const saveFavs = f => { store.set(FAV_KEY, f); updateBadges(); };

const addToCart = (p, license="Personal") => {
  const cart = getCart();
  if(cart.find(i => i.productId === p.id)){ toast("Produk sudah ada di keranjang","err"); return false; }
  const price = Number(p.discountPrice ?? p.price) || 0;
  cart.push({
    productId:p.id, name:p.name, thumbnail:p.thumbnail,
    price, originalPrice:Number(p.price)||0, license, addedAt:Date.now()
  });
  saveCart(cart); toast("Ditambahkan ke keranjang","ok"); return true;
};
const removeFromCart = id => { saveCart(getCart().filter(i=>i.productId!==id)); toast("Dihapus dari keranjang","info"); };
const clearCart = () => saveCart([]);
const updateLicense = (id, lic) => {
  const c = getCart(); const i = c.findIndex(x=>x.productId===id);
  if(i>=0){ c[i].license = lic; saveCart(c); }
};
const cartTotals = () => {
  const c = getCart();
  return { subtotal: c.reduce((s,i)=>s+i.price,0), count:c.length };
};
const toggleFavorite = id => {
  const f = getFavorites(); const i = f.indexOf(id);
  if(i>=0){ f.splice(i,1); saveFavs(f); return false; }
  f.push(id); saveFavs(f); return true;
};
const isFavorite = id => getFavorites().includes(id);
const updateBadges = () => {
  const { count } = cartTotals();
  const f = getFavorites().length;
  [["cartBadge",count],["cartBadgeB",count],["favBadge",f]].forEach(([id,n])=>{
    const el = document.getElementById(id); if(!el) return;
    if(n>0){ el.textContent = n>99?"99+":n; el.classList.add("on"); }
    else el.classList.remove("on");
  });
};

/* ============================================================
   DATA (products, categories, settings)
   ============================================================ */
let productsCache = null;
let categoriesCache = null;
let settingsCache = null;
let notifUnsub = null;

const defaultSettings = () => ({
  storeName:"bungkusin.store",
  description:"Marketplace produk digital profesional.",
  contact:"hello@bungkusin.store",
  currency:"IDR",
  maintenance:false,
  payments:{
    qris:{enabled:true, name:"QRIS", instructions:"Scan QR code, lalu upload bukti pembayaran."},
    ewallet:{enabled:true, name:"E-Wallet", instructions:"Transfer ke nomor admin, lalu upload bukti."},
    bank:{enabled:true, name:"Bank Transfer", instructions:"Transfer ke rekening yang tertera, lalu upload bukti."}
  }
});

const getSettings = async () => {
  if(settingsCache) return settingsCache;
  try { const s = await get(ref(db,"settings")); settingsCache = s.exists() ? s.val() : defaultSettings(); }
  catch { settingsCache = defaultSettings(); }
  return settingsCache;
};

const seedCategories = () => [
  {name:"Template", icon:"grid"}, {name:"Source Code", icon:"box"},
  {name:"Script", icon:"tag"}, {name:"Website", icon:"grid"},
  {name:"Mobile App", icon:"grid"}, {name:"UI/UX", icon:"sparkles"},
  {name:"Design", icon:"sparkles"}, {name:"E-book", icon:"box"},
  {name:"Preset", icon:"tag"}, {name:"Font", icon:"tag"},
  {name:"Icon", icon:"tag"}, {name:"Game Asset", icon:"box"},
  {name:"Bot", icon:"bolt"}, {name:"Tools", icon:"settings"},
  {name:"Plugin", icon:"tag"}, {name:"Lainnya", icon:"grid"}
];

const subscribeCategories = (cb) => {
  return onValue(ref(db,"categories"), snap => {
    const data = snap.val() || {};
    let list = Object.entries(data).map(([id,v])=>({id,...v}));
    if(!list.length) list = seedCategories().map((c,i)=>({id:"cat_def_"+i, ...c}));
    categoriesCache = list;
    cb(list);
  }, err => {
    console.warn(err);
    cb(seedCategories().map((c,i)=>({id:"cat_def_"+i,...c})));
  });
};

const normalizeProduct = (id, v) => ({
  id,
  name: v.name || "Tanpa Nama",
  description: v.description || "",
  category: v.category || "Lainnya",
  price: Number(v.price)||0,
  discountPrice: v.discountPrice ? Number(v.discountPrice) : null,
  thumbnail: v.thumbnail || "",
  gallery: Array.isArray(v.gallery) ? v.gallery : [],
  tags: Array.isArray(v.tags) ? v.tags : [],
  author: v.author || "bungkusin",
  features: v.features || "",
  contents: v.contents || "",
  fileFormat: v.fileFormat || "-",
  fileSize: v.fileSize || "-",
  version: v.version || "1.0.0",
  compatibility: v.compatibility || "-",
  license: v.license || "Personal",
  demoUrl: v.demoUrl || "",
  fileUrl: v.fileUrl || "",
  fileName: v.fileName || "",
  downloadLimit: v.downloadLimit ?? 0,
  useLicenseKey: !!v.useLicenseKey,
  status: v.status || "active",
  sold: Number(v.sold)||0,
  ratingSum: Number(v.ratingSum)||0,
  ratingCount: Number(v.ratingCount)||0,
  createdAt: v.createdAt || Date.now(),
  updatedAt: v.updatedAt || v.createdAt || Date.now(),
  changelog: v.changelog || ""
});

const subscribeProducts = (cb, opts={}) => {
  return onValue(ref(db,"products"), snap => {
    const data = snap.val() || {};
    let list = Object.entries(data).map(([id,v])=>normalizeProduct(id,v)).filter(p => p.status !== "disabled");
    if(opts.category) list = list.filter(p => p.category === opts.category);
    list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    productsCache = list;
    cb(list);
  }, err => { console.warn(err); productsCache = []; cb([]); });
};

const getProduct = async (id) => {
  if(productsCache){
    const local = productsCache.find(p => p.id === id);
    if(local) return local;
  }
  try { const s = await get(ref(db,"products/"+id)); return s.exists() ? normalizeProduct(id, s.val()) : null; }
  catch { return null; }
};

const searchProducts = (list, q) => {
  if(!q) return list;
  const t = q.toLowerCase().trim();
  return list.filter(p =>
    (p.name||"").toLowerCase().includes(t) ||
    (p.category||"").toLowerCase().includes(t) ||
    (p.description||"").toLowerCase().includes(t) ||
    (p.author||"").toLowerCase().includes(t) ||
    (p.tags||[]).some(x => String(x).toLowerCase().includes(t))
  );
};

/* ============================================================
   PRODUCT CARD
   ============================================================ */
const productCard = (p) => {
  const price = p.discountPrice ?? p.price;
  const hasDisc = p.discountPrice && p.price > p.discountPrice;
  const off = hasDisc ? Math.round((1 - p.discountPrice/p.price)*100) : 0;
  const rating = p.ratingCount ? (p.ratingSum/p.ratingCount).toFixed(1) : "0.0";
  const isFree = price === 0;
  const fav = isFavorite(p.id);
  const isNew = (Date.now() - p.createdAt) < 7*86400000;
  const badge = hasDisc ? `<span class="card-badge">-${off}%</span>`
              : isFree ? `<span class="card-badge free">Gratis</span>`
              : isNew ? `<span class="card-badge new">Baru</span>` : "";
  return `
  <article class="card" data-product="${esc(p.id)}">
    <div class="card-thumb">
      <img src="${esc(p.thumbnail||placeholderImg(p.name))}" alt="${esc(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='${placeholderImg(p.name)}'"/>
      ${badge}
      <button class="card-fav ${fav?'active':''}" data-fav="${esc(p.id)}" aria-label="Favorit">
        <svg class="ic"><use href="#i-heart"/></svg>
      </button>
    </div>
    <div class="card-body">
      <div class="card-cat">${esc(p.category)}</div>
      <h3 class="card-title">${esc(p.name)}</h3>
      <div class="card-meta">
        <span class="star"><svg class="ic"><use href="#i-star"/></svg>${rating}</span>
        <span>${p.sold||0} terjual</span>
      </div>
      <div class="card-price">
        ${isFree?`<span class="free">Gratis</span>`:
          `<span class="now">${rupiah(price)}</span>${hasDisc?`<span class="old">${rupiah(p.price)}</span>`:""}`}
      </div>
    </div>
  </article>`;
};

const bindCardActions = (root=document) => {
  $$("[data-product]", root).forEach(card => {
    if(card.dataset.bound) return;
    card.dataset.bound = "1";
    const id = card.dataset.product;
    card.addEventListener("click", e => {
      if(e.target.closest("[data-fav]")) return;
      location.hash = "#/product/" + id;
    });
    const favBtn = card.querySelector("[data-fav]");
    if(favBtn) favBtn.onclick = e => {
      e.stopPropagation();
      const on = toggleFavorite(id);
      favBtn.classList.toggle("active", on);
      toast(on?"Ditambahkan ke favorit":"Dihapus dari favorit","ok");
    };
  });
};

/* ============================================================
   VIEWS
   ============================================================ */
const views = {};

/* ---------- HOME ---------- */
views.home = (el) => {
  el.innerHTML = `
    <section class="hero">
      <div class="hero-tag">${icon("sparkles")} Marketplace Produk Digital</div>
      <h1>Temukan Produk Digital <span class="g">Favoritmu</span></h1>
      <p>Template, script, tools, asset, dan berbagai produk digital dalam satu tempat. Instan, aman, dan profesional.</p>
      <div class="hero-actions">
        <a href="#/explore" class="btn btn-primary">${icon("grid")} Jelajahi Produk</a>
        <a href="#/promo" class="btn btn-ghost">${icon("fire")} Lihat Promo</a>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><b id="hs-prod">0</b><span>Produk</span></div>
        <div class="hero-stat"><b id="hs-cat">0</b><span>Kategori</span></div>
        <div class="hero-stat"><b>Instan</b><span>Pengiriman</span></div>
      </div>
    </section>
    <section class="section" id="home-cat"></section>
    <section class="section" id="home-pop"></section>
    <section class="section" id="home-new"></section>
    <section class="section" id="home-promo"></section>`;

  subscribeCategories(cats => {
    const host = $("#home-cat"); if(!host) return;
    $("#hs-cat").textContent = cats.length;
    host.innerHTML = `
      <div class="section-head"><h2>${icon("grid")} Kategori</h2><a href="#/categories">Semua ${icon("chev")}</a></div>
      <div class="cat-grid">
        ${cats.slice(0,6).map(c=>`
          <a class="cat-card" href="#/explore?cat=${encodeURIComponent(c.name)}">
            <div class="cat-icon">${icon(c.icon||"grid")}</div>
            <div class="cat-name">${esc(c.name)}</div>
          </a>`).join("")}
      </div>`;
  });

  const un = subscribeProducts(products => {
    if(!$("#home-pop")) return;
    $("#hs-prod").textContent = products.length + "+";
    const pop = [...products].sort((a,b)=>(b.sold||0)-(a.sold||0)).slice(0,10);
    const nw  = [...products].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,10);
    const pr  = products.filter(p => p.discountPrice && p.discountPrice < p.price).slice(0,10);

    $("#home-pop").innerHTML = `
      <div class="section-head"><h2>${icon("fire")} Produk Populer</h2><a href="#/explore">Lihat semua ${icon("chev")}</a></div>
      ${pop.length ? `<div class="grid">${pop.map(productCard).join("")}</div>` : emptyState("box","Belum ada produk","Produk akan muncul di sini.")}`;

    $("#home-new").innerHTML = `
      <div class="section-head"><h2>${icon("clock")} Produk Terbaru</h2><a href="#/explore">Lihat semua ${icon("chev")}</a></div>
      ${nw.length ? `<div class="grid">${nw.map(productCard).join("")}</div>` : emptyState("box","Belum ada produk baru","")}`;

    $("#home-promo").innerHTML = pr.length ? `
      <div class="section-head"><h2>${icon("tag")} Promo Digital</h2><a href="#/promo">Semua ${icon("chev")}</a></div>
      <div class="grid">${pr.map(productCard).join("")}</div>` : "";

    bindCardActions(el);
  });
  return () => un();
};

/* ---------- EXPLORE ---------- */
views.explore = (el, params={}) => {
  const state = { cat: params.cat || "", sort:"new", q:"" };
  el.innerHTML = `
    <div class="section-head"><h2>${icon("grid")} Explore</h2></div>
    <div class="chips mb-16" id="exp-chips"></div>
    <div class="chips mb-16">
      <button class="chip active" data-sort="new">Terbaru</button>
      <button class="chip" data-sort="populer">Populer</button>
      <button class="chip" data-sort="rating">Rating</button>
      <button class="chip" data-sort="murah">Termurah</button>
      <button class="chip" data-sort="mahal">Termahal</button>
    </div>
    <div id="exp-host">${skelGrid(8)}</div>`;

  let all = [];
  const render = () => {
    let list = [...all];
    if(state.cat) list = list.filter(p=>p.category===state.cat);
    if(state.q) list = searchProducts(list, state.q);
    if(state.sort==="populer") list.sort((a,b)=>(b.sold||0)-(a.sold||0));
    else if(state.sort==="rating") list.sort((a,b)=>{
      const ra = a.ratingCount ? a.ratingSum/a.ratingCount : 0;
      const rb = b.ratingCount ? b.ratingSum/b.ratingCount : 0;
      return rb - ra;
    });
    else if(state.sort==="murah") list.sort((a,b)=>(a.discountPrice??a.price)-(b.discountPrice??b.price));
    else if(state.sort==="mahal") list.sort((a,b)=>(b.discountPrice??b.price)-(a.discountPrice??a.price));
    else list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

    const host = $("#exp-host"); if(!host) return;
    host.innerHTML = list.length
      ? `<div class="grid">${list.map(productCard).join("")}</div>`
      : emptyState("search","Tidak ada produk", state.cat?`Tidak ada produk di kategori ${state.cat}.`:"Coba ubah filter.");
    bindCardActions(el);
  };

  subscribeCategories(cats => {
    const host = $("#exp-chips"); if(!host) return;
    host.innerHTML = `<button class="chip ${!state.cat?'active':''}" data-cat="">Semua</button>` +
      cats.map(c=>`<button class="chip ${state.cat===c.name?'active':''}" data-cat="${esc(c.name)}">${esc(c.name)}</button>`).join("");
    host.onclick = e => {
      const b = e.target.closest("[data-cat]"); if(!b) return;
      state.cat = b.dataset.cat;
      $$("#exp-chips .chip").forEach(x => x.classList.toggle("active", x===b));
      render();
    };
  });

  $$(".chips .chip[data-sort]", el).forEach(b => b.onclick = () => {
    $$(".chips .chip[data-sort]", el).forEach(x => x.classList.toggle("active", x===b));
    state.sort = b.dataset.sort;
    render();
  });

  const un = subscribeProducts(list => { all = list; render(); });
  return () => un();
};

/* ---------- CATEGORIES ---------- */
views.categories = (el) => {
  el.innerHTML = `<div class="section-head"><h2>${icon("tag")} Semua Kategori</h2></div><div id="cat-host">${skelGrid(4)}</div>`;
  let products = [];
  let cats = [];
  const render = () => {
    const host = $("#cat-host"); if(!host) return;
    host.innerHTML = `<div class="cat-grid">${cats.map(c => {
      const count = products.filter(p => p.category === c.name).length;
      return `<a class="cat-card" href="#/explore?cat=${encodeURIComponent(c.name)}">
        <div class="cat-icon">${icon(c.icon||"grid")}</div>
        <div class="cat-name">${esc(c.name)}</div>
        <div class="cat-count">${count} produk</div>
      </a>`;
    }).join("")}</div>`;
  };
  subscribeCategories(list => { cats = list; render(); });
  const un = subscribeProducts(list => { products = list; render(); });
  return () => un();
};

/* ---------- PROMO ---------- */
views.promo = (el) => {
  el.innerHTML = `<div class="section-head"><h2>${icon("fire")} Promo Digital</h2></div><div id="pr-host">${skelGrid(8)}</div>`;
  const un = subscribeProducts(list => {
    const promo = list.filter(p => p.discountPrice && p.discountPrice < p.price);
    const host = $("#pr-host"); if(!host) return;
    host.innerHTML = promo.length
      ? `<div class="grid">${promo.map(productCard).join("")}</div>`
      : emptyState("tag","Belum ada promo","Promo akan muncul di sini.");
    bindCardActions(el);
  });
  return () => un();
};

/* ---------- PRODUCT DETAIL ---------- */
views.product = (el, params) => {
  el.innerHTML = `<div class="page-loader"><div class="spinner"></div></div>`;
  (async () => {
    const p = await getProduct(params.id);
    if(!p){ el.innerHTML = emptyState("box","Produk tidak ditemukan","Produk mungkin sudah dihapus.","#/explore","Kembali"); return; }
    const price = p.discountPrice ?? p.price;
    const hasDisc = p.discountPrice && p.price > p.discountPrice;
    const rating = p.ratingCount ? (p.ratingSum/p.ratingCount).toFixed(1) : "0.0";
    const gallery = p.gallery?.length ? p.gallery : [p.thumbnail||placeholderImg(p.name)];
    const isFree = price === 0;
    const fav = isFavorite(p.id);

    el.innerHTML = `
      <div class="pd">
        <div class="pd-gallery">
          <div class="pd-main-img"><img id="pd-main" src="${esc(gallery[0])}" alt="${esc(p.name)}" onerror="this.onerror=null;this.src='${placeholderImg(p.name)}'"/></div>
          ${gallery.length>1?`<div class="pd-thumbs" id="pd-thumbs">${gallery.map((g,i)=>`<img src="${esc(g)}" data-i="${i}" class="${i===0?'active':''}" alt="" onerror="this.onerror=null;this.src='${placeholderImg(p.name+i)}'"/>`).join("")}</div>`:""}
        </div>
        <div class="pd-info">
          <span class="cat-tag">${icon("tag")} ${esc(p.category)}</span>
          <h1>${esc(p.name)}</h1>
          <div class="pd-stats">
            <span class="star">${icon("star")} ${rating} (${p.ratingCount||0} ulasan)</span>
            <span>${icon("bolt")} ${p.sold||0} terjual</span>
            <span>${icon("box")} ${esc(p.fileFormat)}</span>
          </div>
          <div class="pd-price">
            ${isFree?`<span class="now">Gratis</span>`:`
              <span class="now">${rupiah(price)}</span>
              ${hasDisc?`<span class="old">${rupiah(p.price)}</span><span class="off">-${Math.round((1-p.discountPrice/p.price)*100)}%</span>`:""}`}
          </div>
          <div class="pd-actions">
            ${isFree
              ? `<button class="btn btn-brand" id="pd-get">${icon("download")} Download Gratis</button>`
              : `<button class="btn btn-brand" id="pd-buy">${icon("bolt")} Beli Sekarang</button>
                 <button class="btn btn-outline" id="pd-cart">${icon("cart")} Keranjang</button>`}
            <button class="btn btn-outline" id="pd-fav">${icon("heart")} ${fav?"Tersimpan":"Favorit"}</button>
          </div>
          <div class="pd-specs">
            <h3>${icon("info")} Spesifikasi</h3>
            <div class="spec-row"><span class="k">Versi</span><span class="v">${esc(p.version)}</span></div>
            <div class="spec-row"><span class="k">Format File</span><span class="v">${esc(p.fileFormat)}</span></div>
            <div class="spec-row"><span class="k">Ukuran</span><span class="v">${esc(p.fileSize)}</span></div>
            <div class="spec-row"><span class="k">Lisensi</span><span class="v">${esc(p.license)}</span></div>
            <div class="spec-row"><span class="k">Kompatibilitas</span><span class="v">${esc(p.compatibility)}</span></div>
            <div class="spec-row"><span class="k">Update Terakhir</span><span class="v">${fmtDate(p.updatedAt)}</span></div>
            <div class="spec-row"><span class="k">Pembuat</span><span class="v">${esc(p.author)}</span></div>
          </div>
          ${p.demoUrl?`<a class="btn btn-outline btn-block mb-16" href="${esc(p.demoUrl)}" target="_blank" rel="noopener">${icon("info")} Lihat Demo</a>`:""}
          <div class="tabs" id="pd-tabs">
            <button class="active" data-tab="desc">Deskripsi</button>
            <button data-tab="feat">Fitur</button>
            <button data-tab="cont">Isi</button>
            <button data-tab="chlog">Changelog</button>
            <button data-tab="rev">Ulasan (${p.ratingCount||0})</button>
          </div>
          <div class="tab-panel" id="pd-tab-body"></div>
          <div id="pd-related" class="mt-16"></div>
        </div>
      </div>`;

    const thumbs = $("#pd-thumbs");
    if(thumbs) thumbs.onclick = e => {
      const img = e.target.closest("img[data-i]"); if(!img) return;
      $("#pd-main").src = gallery[+img.dataset.i];
      $$("#pd-thumbs img").forEach(x => x.classList.toggle("active", x===img));
    };

    const tabContent = {
      desc: `<p>${esc(p.description).replace(/\n/g,"<br>")}</p>`,
      feat: p.features ? `<h4>Fitur Utama</h4><ul>${String(p.features).split("\n").filter(Boolean).map(f=>`<li>${esc(f)}</li>`).join("")}</ul>` : "<p class='muted'>Belum ada info fitur.</p>",
      cont: p.contents ? `<h4>Isi Produk</h4><ul>${String(p.contents).split("\n").filter(Boolean).map(f=>`<li>${esc(f)}</li>`).join("")}</ul>` : "<p class='muted'>Belum ada info isi.</p>",
      chlog: p.changelog ? `<pre>${esc(p.changelog)}</pre>` : "<p class='muted'>Belum ada changelog.</p>",
      rev: `<div id="pd-rev-host"><div class="page-loader"><div class="spinner"></div></div></div>`
    };
    const renderTab = k => {
      $("#pd-tab-body").innerHTML = tabContent[k];
      if(k==="rev") loadReviews(p.id);
    };
    renderTab("desc");
    $("#pd-tabs").onclick = e => {
      const b = e.target.closest("button[data-tab]"); if(!b) return;
      $$("#pd-tabs button").forEach(x => x.classList.toggle("active", x===b));
      renderTab(b.dataset.tab);
    };

    $("#pd-fav").onclick = () => {
      const on = toggleFavorite(p.id);
      toast(on?"Ditambahkan ke favorit":"Dihapus dari favorit","ok");
      $("#pd-fav").innerHTML = `${icon("heart")} ${on?"Tersimpan":"Favorit"}`;
    };

    const guardLogin = () => {
      if(!getUser()){ toast("Silakan login terlebih dahulu","err"); location.hash = "#/login"; return false; }
      return true;
    };
    $("#pd-buy")?.addEventListener("click", () => {
      if(!guardLogin()) return;
      if(!getCart().find(i=>i.productId===p.id)) addToCart(p, p.license);
      location.hash = "#/checkout";
    });
    $("#pd-cart")?.addEventListener("click", () => addToCart(p, p.license));
    $("#pd-get")?.addEventListener("click", async () => {
      if(!guardLogin()) return;
      try { await claimFreeProduct(p); location.hash = "#/downloads"; }
      catch(e){ console.error(e); toast("Gagal memproses produk gratis","err"); }
    });

    const related = (productsCache||[]).filter(x => x.category === p.category && x.id !== p.id).slice(0,8);
    if(related.length){
      $("#pd-related").innerHTML = `
        <div class="section-head"><h2 style="font-size:16px">${icon("grid")} Produk Terkait</h2></div>
        <div class="grid">${related.map(productCard).join("")}</div>`;
      bindCardActions(el);
    }
  })();
};

const loadReviews = async (productId) => {
  const host = $("#pd-rev-host"); if(!host) return;
  try {
    const snap = await get(ref(db, `reviews/${productId}`));
    const list = snap.exists() ? Object.values(snap.val()) : [];
    list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(!list.length){ host.innerHTML = `<p class="muted">Belum ada ulasan untuk produk ini.</p>`; return; }
    host.innerHTML = list.map(r => `
      <div class="list-item" style="margin-bottom:10px">
        <div class="row sb">
          <b>${esc(r.userName||"Pengguna")}</b>
          <span class="muted" style="display:inline-flex;align-items:center;gap:3px">
            <svg class="ic" style="width:12px;height:12px;color:var(--warning);fill:var(--warning)"><use href="#i-star"/></svg>${r.rating}/5
          </span>
        </div>
        <p class="muted" style="margin-top:8px">${esc(r.comment||"")}</p>
        <div class="muted" style="font-size:11px;margin-top:8px">${fmtDate(r.createdAt)}</div>
      </div>`).join("");
  } catch { host.innerHTML = `<p class="muted">Gagal memuat ulasan.</p>`; }
};

const claimFreeProduct = async (p) => {
  const user = getUser();
  const orderId = orderIdGen();
  const order = {
    orderId, userId:user.uid, userEmail:user.email, userName:getProfile()?.displayName||user.email,
    items:[{productId:p.id, name:p.name, price:0, license:p.license, thumbnail:p.thumbnail||""}],
    subtotal:0, discount:0, total:0, coupon:null,
    paymentMethod:"free", paymentStatus:"paid", orderStatus:"completed",
    createdAt:Date.now(), updatedAt:Date.now()
  };
  await set(ref(db,"orders/"+orderId), order);
  await grantEntitlements(order);
  toast("Produk gratis ditambahkan ke Download Saya","ok");
};

/* ---------- CART ---------- */
views.cart = (el) => {
  const render = () => {
    const cart = getCart();
    if(!cart.length){
      el.innerHTML = `<div class="section-head"><h2>${icon("cart")} Keranjang</h2></div>${emptyState("cart","Keranjangmu masih kosong","Yuk cari produk digital favoritmu.","#/explore","Jelajahi Produk")}`;
      return;
    }
    const { subtotal } = cartTotals();
    el.innerHTML = `
      <div class="section-head"><h2>${icon("cart")} Keranjang (${cart.length})</h2></div>
      <div class="cart-layout">
        <div class="cart-list">
          ${cart.map(i=>`
            <div class="cart-item" data-id="${esc(i.productId)}">
              <img src="${esc(i.thumbnail||placeholderImg(i.name))}" onerror="this.onerror=null;this.src='${placeholderImg(i.name)}'" alt=""/>
              <div>
                <div class="title">${esc(i.name)}</div>
                <div class="meta">Lisensi:
                  <select class="select" style="padding:5px 28px 5px 10px;font-size:12px;width:auto;display:inline-block;margin-left:6px" data-lic>
                    ${["Personal","Commercial","Extended","Developer","Lifetime"].map(l=>`<option ${l===i.license?'selected':''}>${l}</option>`).join("")}
                  </select>
                </div>
                <div class="price">${rupiah(i.price)}${i.originalPrice>i.price?` <span class="muted" style="text-decoration:line-through;font-size:12px">${rupiah(i.originalPrice)}</span>`:""}</div>
              </div>
              <button class="rm" data-rm aria-label="Hapus">${icon("trash")}</button>
            </div>`).join("")}
        </div>
        <aside class="summary">
          <h3>${icon("check")} Ringkasan</h3>
          <div class="sum-row"><span>Subtotal</span><span>${rupiah(subtotal)}</span></div>
          <div class="sum-row total"><span>Total</span><span>${rupiah(subtotal)}</span></div>
          <a href="#/checkout" class="btn btn-brand btn-block mt-16">${icon("bolt")} Checkout</a>
        </aside>
      </div>`;
    $$("[data-id]", el).forEach(row => {
      const id = row.dataset.id;
      row.querySelector("[data-rm]").onclick = () => { removeFromCart(id); render(); };
      row.querySelector("[data-lic]").onchange = e => updateLicense(id, e.target.value);
    });
  };
  render();
  return onCartChange(() => render());
};

/* ---------- CHECKOUT ---------- */
views.checkout = (el) => {
  if(!getUser()){ location.hash = "#/login"; return; }
  const cart = getCart();
  if(!cart.length){ el.innerHTML = emptyState("cart","Keranjang kosong","Tambahkan produk terlebih dahulu.","#/explore","Jelajahi"); return; }

  let appliedCoupon = store.get("checkoutCoupon", null);
  let paymentMethod = "qris";

  el.innerHTML = `
    <div class="section-head"><h2>${icon("bolt")} Checkout</h2></div>
    <div class="cart-layout">
      <div>
        <div class="summary mb-16">
          <h3>${icon("box")} Review Pesanan</h3>
          ${cart.map(i=>`
            <div class="row sb" style="padding:10px 0;border-bottom:1px dashed var(--border)">
              <div>
                <div style="font-weight:700;font-size:13.5px">${esc(i.name)}</div>
                <div class="muted" style="font-size:12px">Lisensi: ${esc(i.license)}</div>
              </div>
              <div style="font-weight:800">${rupiah(i.price)}</div>
            </div>`).join("")}
        </div>
        <div class="summary mb-16">
          <h3>${icon("ticket")} Kupon</h3>
          <div class="row">
            <input class="input" id="cp-input" placeholder="Masukkan kode kupon" value="${esc(appliedCoupon?.code||"")}">
            <button class="btn btn-outline" id="cp-apply" style="flex-shrink:0">Pakai</button>
          </div>
          <div id="cp-msg" class="muted mt-8"></div>
        </div>
        <div class="summary">
          <h3>${icon("shield")} Metode Pembayaran</h3>
          <label class="checkbox"><input type="radio" name="pm" value="qris" checked> <span><b>QRIS</b><br><span class="muted" style="font-size:12px">Scan & upload bukti</span></span></label>
          <label class="checkbox"><input type="radio" name="pm" value="ewallet"> <span><b>E-Wallet</b><br><span class="muted" style="font-size:12px">Transfer ke nomor admin</span></span></label>
          <label class="checkbox"><input type="radio" name="pm" value="bank"> <span><b>Bank Transfer</b><br><span class="muted" style="font-size:12px">Transfer ke rekening</span></span></label>
          <p class="muted mt-16" style="font-size:12px;line-height:1.6">Setelah menekan Buat Pesanan, Anda akan diarahkan untuk upload bukti transfer. Admin akan memverifikasi sebelum produk dibuka.</p>
        </div>
      </div>
      <aside class="summary">
        <h3>${icon("chart")} Total</h3>
        <div class="sum-row"><span>Subtotal</span><span id="co-sub">${rupiah(cartTotals().subtotal)}</span></div>
        <div class="sum-row"><span>Diskon</span><span id="co-disc">-${rupiah(appliedCoupon?.computed||0)}</span></div>
        <div class="sum-row total"><span>Total</span><span id="co-total">${rupiah(cartTotals().subtotal - (appliedCoupon?.computed||0))}</span></div>
        <button class="btn btn-brand btn-block mt-16" id="co-place">${icon("check")} Buat Pesanan</button>
      </aside>
    </div>`;

  const refresh = () => {
    const { subtotal } = cartTotals();
    const d = appliedCoupon?.computed || 0;
    $("#co-sub").textContent = rupiah(subtotal);
    $("#co-disc").textContent = "-" + rupiah(d);
    $("#co-total").textContent = rupiah(Math.max(0, subtotal - d));
  };

  $("#cp-apply").onclick = async () => {
    const code = $("#cp-input").value.trim().toUpperCase();
    const msg = $("#cp-msg");
    if(!code){ msg.textContent = "Masukkan kode kupon."; return; }
    const res = await validateCoupon(code);
    if(!res.ok){ appliedCoupon = null; store.del("checkoutCoupon"); msg.innerHTML = `<span style="color:var(--danger)">${esc(res.reason)}</span>`; refresh(); return; }
    const { subtotal } = cartTotals();
    const c = res.coupon;
    let disc = c.discountType === "percentage" ? Math.floor(subtotal * (c.discountValue/100)) : Number(c.discountValue)||0;
    if(c.maximumDiscount) disc = Math.min(disc, Number(c.maximumDiscount));
    disc = Math.min(disc, subtotal);
    appliedCoupon = { code, computed: disc, id: c.id, ...c };
    store.set("checkoutCoupon", appliedCoupon);
    msg.innerHTML = `<span style="color:var(--success)">Kupon diterapkan: hemat ${rupiah(disc)}</span>`;
    refresh();
  };

  $$("input[name=pm]", el).forEach(r => r.onchange = () => { paymentMethod = r.value; });

  $("#co-place").onclick = async () => {
    const btn = $("#co-place"); btn.disabled = true; btn.textContent = "Memproses…";
    try {
      const user = getUser();
      const items = []; let subtotal = 0;
      for(const i of cart){
        const fresh = await getProduct(i.productId);
        if(!fresh || fresh.status === "disabled"){ toast(`Produk ${i.name} tidak tersedia`,"err"); continue; }
        const price = Number(fresh.discountPrice ?? fresh.price) || 0;
        items.push({ productId:fresh.id, name:fresh.name, price, license:i.license||fresh.license, thumbnail:fresh.thumbnail||"" });
        subtotal += price;
      }
      if(!items.length){ toast("Tidak ada produk valid","err"); btn.disabled=false; btn.textContent="Buat Pesanan"; return; }
      let discount = 0;
      if(appliedCoupon){
        const chk = await validateCoupon(appliedCoupon.code);
        if(chk.ok){
          const c = chk.coupon;
          discount = c.discountType === "percentage" ? Math.floor(subtotal * (c.discountValue/100)) : Number(c.discountValue)||0;
          if(c.maximumDiscount) discount = Math.min(discount, Number(c.maximumDiscount));
          discount = Math.min(discount, subtotal);
        }
      }
      const total = Math.max(0, subtotal - discount);
      const orderId = orderIdGen();
      const order = {
        orderId, userId:user.uid, userEmail:user.email, userName:getProfile()?.displayName||user.email,
        items, subtotal, discount, total,
        coupon: appliedCoupon?.code || null,
        paymentMethod, paymentStatus:"pending", orderStatus:"pending_payment",
        createdAt:Date.now(), updatedAt:Date.now()
      };
      await set(ref(db,"orders/"+orderId), order);
      if(appliedCoupon?.id){
        try { await runTransaction(ref(db, `coupons/${appliedCoupon.id}/usedCount`), c => (Number(c)||0)+1); } catch {}
      }
      clearCart(); store.del("checkoutCoupon");
      toast("Pesanan dibuat","ok");
      location.hash = "#/payment/" + orderId;
    } catch(e){ console.error(e); toast("Gagal membuat pesanan","err"); btn.disabled=false; btn.textContent="Buat Pesanan"; }
  };

  refresh();
};

const validateCoupon = async (code) => {
  try {
    const snap = await get(ref(db,"coupons"));
    if(!snap.exists()) return { ok:false, reason:"Kupon tidak ditemukan." };
    const list = Object.entries(snap.val()).map(([id,v])=>({id,...v}));
    const c = list.find(x => (x.code||"").toUpperCase() === code);
    if(!c) return { ok:false, reason:"Kode kupon tidak valid." };
    if(c.active === false) return { ok:false, reason:"Kupon tidak aktif." };
    const now = Date.now();
    if(c.startDate && now < c.startDate) return { ok:false, reason:"Kupon belum berlaku." };
    if(c.endDate && now > c.endDate) return { ok:false, reason:"Kupon telah kedaluwarsa." };
    if(c.usageLimit && (c.usedCount||0) >= c.usageLimit) return { ok:false, reason:"Kuota kupon habis." };
    const { subtotal } = cartTotals();
    if(c.minimumPurchase && subtotal < c.minimumPurchase) return { ok:false, reason:`Minimum belanja ${rupiah(c.minimumPurchase)}.` };
    return { ok:true, coupon:c };
  } catch { return { ok:false, reason:"Gagal validasi kupon." }; }
};

/* ---------- PAYMENT ---------- */
views.payment = (el, params) => {
  if(!getUser()){ location.hash = "#/login"; return; }
  el.innerHTML = `<div class="page-loader"><div class="spinner"></div></div>`;
  (async () => {
    const snap = await get(ref(db,"orders/"+params.id));
    if(!snap.exists()){ el.innerHTML = emptyState("box","Order tidak ditemukan","","#/orders","Kembali"); return; }
    const o = snap.val();
    if(o.userId !== getUser().uid && !isAdmin()){ el.innerHTML = emptyState("shield","Akses ditolak","","#/orders","Kembali"); return; }
    const settings = await getSettings();
    const method = settings.payments?.[o.paymentMethod] || { name:o.paymentMethod, instructions:"Ikuti instruksi dari admin." };

    el.innerHTML = `
      <div class="section-head"><h2>${icon("bolt")} Pembayaran</h2></div>
      <div class="summary mb-16">
        <div class="row sb mb-8"><span class="muted">Order ID</span><b class="mono">${esc(o.orderId)}</b></div>
        <div class="row sb mb-8"><span class="muted">Metode</span><b>${esc(method.name)}</b></div>
        <div class="row sb mb-8"><span class="muted">Status</span><span class="status ${o.orderStatus}">${statusLabel[o.orderStatus]||o.orderStatus}</span></div>
        <div class="row sb"><span class="muted">Total</span><b style="font-size:20px;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent">${rupiah(o.total)}</b></div>
      </div>
      <div class="summary mb-16">
        <h3>${icon("info")} Instruksi</h3>
        <p class="muted">${esc(method.instructions||"Silakan lakukan pembayaran lalu upload bukti.")}</p>
        ${method.accountNumber?`<p class="mono mt-16" style="font-size:17px;font-weight:800">${esc(method.accountNumber)}</p>`:""}
      </div>
      ${o.orderStatus === "pending_payment" ? `
      <div class="summary">
        <h3>${icon("upload")} Upload Bukti</h3>
        <input type="file" id="pf" class="input" accept="image/*">
        <p class="muted mt-8" style="font-size:12px">JPG/PNG. Maks 1 MB.</p>
        <button class="btn btn-brand btn-block mt-16" id="pf-send">${icon("upload")} Kirim Bukti</button>
      </div>` : `
      <div class="summary">
        <h3>${icon("check")} Status</h3>
        <p class="muted">Bukti pembayaran Anda sudah terkirim. Menunggu verifikasi admin.</p>
        <a href="#/orders" class="btn btn-outline btn-block mt-16">Lihat Order</a>
      </div>`}`;

    $("#pf-send")?.addEventListener("click", () => {
      const f = $("#pf").files[0];
      if(!f){ toast("Pilih file bukti","err"); return; }
      if(f.size > 1024*1024){ toast("Ukuran file maks 1MB","err"); return; }
      const r = new FileReader();
      r.onload = async () => {
        try {
          await update(ref(db,"orders/"+o.orderId), {
            paymentProof:r.result, paymentStatus:"waiting",
            orderStatus:"waiting_verification", updatedAt:Date.now()
          });
          await push(ref(db,"notifications/_admin"), {
            title:"Bukti Pembayaran Baru", message:`Order ${o.orderId} siap diverifikasi`,
            type:"payment_proof", orderId:o.orderId, createdAt:Date.now(), read:false
          });
          toast("Bukti terkirim. Menunggu verifikasi.","ok");
          location.hash = "#/orders";
        } catch(e){ console.error(e); toast("Gagal mengirim bukti","err"); }
      };
      r.readAsDataURL(f);
    });
  })();
};

/* ---------- ORDERS ---------- */
views.orders = (el) => {
  const user = getUser();
  if(!user){ location.hash = "#/login"; return; }
  el.innerHTML = `<div class="section-head"><h2>${icon("box")} Riwayat Order</h2></div><div id="ord-host"><div class="page-loader"><div class="spinner"></div></div></div>`;
  const un = onValue(ref(db,"orders"), snap => {
    const data = snap.val() || {};
    const orders = Object.values(data).filter(o => o.userId === user.uid).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const host = $("#ord-host"); if(!host) return;
    if(!orders.length){ host.innerHTML = emptyState("box","Belum ada pembelian","Yuk mulai belanja produk digital.","#/explore","Jelajahi"); return; }
    host.innerHTML = orders.map(o=>`
      <div class="list-item">
        <div class="list-item-head">
          <div>
            <div class="oid">${esc(o.orderId)}</div>
            <div style="font-weight:800;margin-top:6px;font-size:16px">${rupiah(o.total)}</div>
            <div class="muted" style="font-size:12px;margin-top:4px">${fmtDateTime(o.createdAt)}</div>
          </div>
          <span class="status ${o.orderStatus}">${statusLabel[o.orderStatus]||o.orderStatus}</span>
        </div>
        <div class="muted" style="font-size:12.5px;margin-bottom:12px">${o.items?.length||0} item · ${esc(o.paymentMethod||"-")}</div>
        <div class="row wrap" style="gap:8px">
          ${o.orderStatus==="pending_payment"?`<a class="btn btn-brand btn-sm" href="#/payment/${esc(o.orderId)}">${icon("bolt")} Bayar</a>`:""}
          ${o.orderStatus==="completed"?`<a class="btn btn-outline btn-sm" href="#/downloads">${icon("download")} Download</a>`:""}
          <button class="btn btn-outline btn-sm" data-det="${esc(o.orderId)}">${icon("info")} Detail</button>
        </div>
      </div>`).join("");
    $$("[data-det]", el).forEach(b => b.onclick = () => showOrderDetail(b.dataset.det, orders));
  });
  return () => un();
};

const showOrderDetail = (id, orders) => {
  const o = orders.find(x => x.orderId === id); if(!o) return;
  const body = `
    <div class="row sb mb-8"><span class="muted">Order ID</span><b class="mono">${esc(o.orderId)}</b></div>
    <div class="row sb mb-8"><span class="muted">Tanggal</span><b>${fmtDateTime(o.createdAt)}</b></div>
    <div class="row sb mb-8"><span class="muted">Status</span><span class="status ${o.orderStatus}">${statusLabel[o.orderStatus]||o.orderStatus}</span></div>
    <div class="row sb mb-8"><span class="muted">Metode</span><b>${esc(o.paymentMethod)}</b></div>
    <div class="row sb mb-8"><span class="muted">Subtotal</span><b>${rupiah(o.subtotal)}</b></div>
    <div class="row sb mb-8"><span class="muted">Diskon</span><b>-${rupiah(o.discount)}</b></div>
    <div class="row sb mb-8"><span class="muted">Total</span><b style="color:var(--primary)">${rupiah(o.total)}</b></div>
    <h4 style="margin-top:16px;font-size:14px;font-weight:800">Item</h4>
    ${(o.items||[]).map(i=>`<div class="row sb" style="padding:8px 0;border-bottom:1px dashed var(--border)"><span>${esc(i.name)}</span><b>${rupiah(i.price)}</b></div>`).join("")}`;
  openModal({ title:"Detail Order", body });
};

/* ---------- DOWNLOADS ---------- */
views.downloads = (el) => {
  const user = getUser();
  if(!user){ location.hash = "#/login"; return; }
  el.innerHTML = `<div class="section-head"><h2>${icon("download")} Download Saya</h2></div><div id="dl-host"><div class="page-loader"><div class="spinner"></div></div></div>`;
  const un = onValue(ref(db,"orders"), async snap => {
    const data = snap.val() || {};
    const paid = Object.values(data).filter(o => o.userId === user.uid && ["paid","completed"].includes(o.orderStatus));
    const items = [];
    paid.forEach(o => (o.items||[]).forEach(i => items.push({ ...i, orderId:o.orderId, purchasedAt:o.createdAt })));
    const host = $("#dl-host"); if(!host) return;
    if(!items.length){ host.innerHTML = emptyState("download","Belum ada produk yang bisa didownload","Selesaikan pembelian terlebih dahulu.","#/explore","Jelajahi"); return; }
    const dlSnap = await get(ref(db, "downloadLogs/"+user.uid));
    const logs = dlSnap.exists() ? Object.values(dlSnap.val()) : [];
    const counts = {};
    logs.forEach(l => { counts[l.productId] = (counts[l.productId]||0)+1; });
    host.innerHTML = items.map(i => {
      const cnt = counts[i.productId]||0;
      return `
      <div class="list-item" data-dl="${esc(i.productId)}" data-ord="${esc(i.orderId)}">
        <div class="list-item-head">
          <div>
            <div style="font-weight:800;font-size:14.5px">${esc(i.name)}</div>
            <div class="muted" style="font-size:12px;margin-top:4px">Dibeli ${fmtDate(i.purchasedAt)}</div>
          </div>
          <span class="status paid">Purchased</span>
        </div>
        <div class="muted" style="font-size:12px;margin-bottom:12px">Downloads: ${cnt}${Number(i.downloadLimit)>0?` / ${i.downloadLimit}`:" / ∞"}</div>
        <button class="btn btn-brand btn-sm" data-dlbtn>${icon("download")} Download</button>
      </div>`;
    }).join("") + `
      <div class="section-head mt-16"><h2 style="font-size:16px">${icon("clock")} Riwayat Download</h2></div>
      ${logs.length ? logs.sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,20).map(l=>`
        <div class="list-item" style="padding:11px 15px">
          <div class="row sb">
            <span style="font-weight:600;font-size:13.5px">${esc(l.productName||l.productId)}</span>
            <span class="muted" style="font-size:12px">${fmtDateTime(l.at)}</span>
          </div>
        </div>`).join("") : `<p class="muted">Belum ada riwayat download.</p>`}`;

    $$("[data-dl]", host).forEach(card => {
      card.querySelector("[data-dlbtn]").onclick = () => handleDownload(card.dataset.dl, card.dataset.ord);
    });
  });
  return () => un();
};

const handleDownload = async (productId, orderId) => {
  const user = getUser();
  try {
    const product = await getProduct(productId);
    if(!product){ toast("Produk tidak tersedia","err"); return; }
    const logSnap = await get(ref(db, `downloadLogs/${user.uid}`));
    const logs = logSnap.exists() ? Object.values(logSnap.val()) : [];
    const used = logs.filter(l => l.productId === productId).length;
    if(Number(product.downloadLimit) > 0 && used >= Number(product.downloadLimit)){
      toast("Batas download tercapai","err"); return;
    }
    if(!product.fileUrl){ toast("File belum tersedia. Hubungi admin.","err"); return; }
    await push(ref(db, `downloadLogs/${user.uid}`), {
      productId, productName:product.name, orderId,
      at: Date.now(), fileName: product.fileName || ""
    });
    const a = document.createElement("a");
    a.href = product.fileUrl; a.target = "_blank"; a.rel = "noopener";
    a.download = product.fileName || "";
    document.body.appendChild(a); a.click(); a.remove();
    toast("Download dimulai","ok");
    setTimeout(() => { const h = location.hash; location.hash = ""; location.hash = h; }, 400);
  } catch(e){ console.error(e); toast("Gagal memproses download","err"); }
};

/* ---------- LICENSES ---------- */
views.licenses = (el) => {
  const user = getUser();
  if(!user){ location.hash = "#/login"; return; }
  el.innerHTML = `<div class="section-head"><h2>${icon("key")} Lisensi Saya</h2></div><div id="lic-host"><div class="page-loader"><div class="spinner"></div></div></div>`;
  const un = onValue(ref(db, "licenses/"+user.uid), snap => {
    const data = snap.val() || {};
    const list = Object.values(data).sort((a,b)=>(b.assignedAt||0)-(a.assignedAt||0));
    const host = $("#lic-host"); if(!host) return;
    if(!list.length){ host.innerHTML = emptyState("key","Belum ada lisensi","Beli produk yang menggunakan license key untuk melihat di sini."); return; }
    host.innerHTML = list.map(l => `
      <div class="list-item">
        <div class="list-item-head">
          <div>
            <div style="font-weight:800">${esc(l.productName)}</div>
            <div class="muted" style="font-size:12px;margin-top:4px">${fmtDate(l.assignedAt)}</div>
          </div>
          <span class="status paid">${esc(l.status||"Assigned")}</span>
        </div>
        <div class="row" style="gap:8px">
          <code class="mono" style="flex:1;padding:10px 14px;background:var(--surface-2);border-radius:10px;font-size:13px;overflow:hidden;text-overflow:ellipsis;border:1px solid var(--border)">${esc(l.key)}</code>
          <button class="btn btn-outline btn-sm" data-copy="${esc(l.key)}">${icon("copy")}</button>
        </div>
      </div>`).join("");
    $$("[data-copy]", host).forEach(b => b.onclick = () => {
      navigator.clipboard?.writeText(b.dataset.copy).then(()=>toast("Kode disalin","ok"));
    });
  });
  return () => un();
};

/* ---------- FAVORITES ---------- */
views.favorites = (el) => {
  el.innerHTML = `<div class="section-head"><h2>${icon("heart")} Favorit</h2></div><div id="fav-host">${skelGrid(4)}</div>`;
  const un = subscribeProducts(products => {
    const ids = getFavorites();
    const list = products.filter(p => ids.includes(p.id));
    const host = $("#fav-host"); if(!host) return;
    host.innerHTML = list.length ? `<div class="grid">${list.map(productCard).join("")}</div>` : emptyState("heart","Belum ada favorit","Simpan produk favoritmu.","#/explore","Jelajahi");
    bindCardActions(el);
  });
  return () => un();
};

/* ---------- PROFILE ---------- */
views.profile = (el) => {
  const user = getUser(); const prof = getProfile();
  if(!user){ location.hash = "#/login"; return; }
  const initial = (prof?.displayName || user.email || "U").charAt(0).toUpperCase();
  el.innerHTML = `
    <div class="profile-head">
      <div class="avatar">${esc(initial)}</div>
      <div class="info">
        <h2>${esc(prof?.displayName || "Pengguna")}</h2>
        <p>${esc(user.email)}</p>
        ${prof?.role === "admin" ? `<span style="margin-top:6px;font-size:10.5px;background:var(--grad);padding:3px 9px;border-radius:6px;display:inline-block;font-weight:800;letter-spacing:.04em;color:#fff">ADMIN</span>`:""}
      </div>
    </div>
    <div class="menu-list">
      <a href="#/orders">${icon("box")} Riwayat Pembelian</a>
      <a href="#/downloads">${icon("download")} Download Saya</a>
      <a href="#/licenses">${icon("key")} Lisensi Saya</a>
      <a href="#/favorites">${icon("heart")} Favorit</a>
      <a href="#/notifications">${icon("bell")} Notifikasi</a>
    </div>
    <div class="menu-list">
      <button data-theme-toggle>${icon("moon")} Ubah Tema</button>
      <a href="#/help">${icon("info")} Bantuan</a>
      <a href="#/terms">${icon("shield")} Syarat & Ketentuan</a>
      <a href="#/privacy">${icon("shield")} Kebijakan Privasi</a>
      <a href="#/admin" class="admin-only" hidden>${icon("shield")} Admin Dashboard</a>
    </div>
    <button class="btn btn-danger btn-block" id="logout-btn">${icon("logout")} Keluar</button>`;
  $("#logout-btn").onclick = async () => {
    if(!await confirmDialog("Keluar?","Anda yakin ingin keluar dari akun?")) return;
    await logout(); toast("Berhasil keluar","info"); location.hash = "#/";
  };
};

/* ---------- NOTIFICATIONS ---------- */
views.notifications = (el) => {
  const user = getUser();
  if(!user){ location.hash = "#/login"; return; }
  el.innerHTML = `<div class="section-head"><h2>${icon("bell")} Notifikasi</h2></div><div id="nt-host"><div class="page-loader"><div class="spinner"></div></div></div>`;
  const un = onValue(ref(db, "notifications/"+user.uid), snap => {
    const data = snap.val() || {};
    const list = Object.values(data).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const host = $("#nt-host"); if(!host) return;
    if(!list.length){ host.innerHTML = emptyState("bell","Tidak ada notifikasi","Notifikasi pesanan akan muncul di sini."); return; }
    host.innerHTML = list.map(n=>`
      <div class="list-item">
        <div class="row sb">
          <b style="font-size:13.5px">${esc(n.title||"Notifikasi")}</b>
          <span class="muted" style="font-size:11.5px">${timeAgo(n.createdAt)}</span>
        </div>
        <p class="muted mt-8" style="font-size:13px">${esc(n.message||"")}</p>
      </div>`).join("");
  });
  return () => un();
};

/* ---------- AUTH PAGES ---------- */
views.login = (el) => {
  if(getUser()){ location.hash = "#/"; return; }
  el.innerHTML = `
    <div class="auth-wrap">
      <h1>Masuk</h1>
      <p class="sub">Selamat datang kembali di bungkusin.store</p>
      <div class="form-group"><label>Email</label><input class="input" type="email" id="l-em" placeholder="nama@email.com" autocomplete="email"></div>
      <div class="form-group"><label>Password</label><input class="input" type="password" id="l-pw" placeholder="••••••••" autocomplete="current-password"></div>
      <button class="btn btn-brand btn-block" id="l-btn">${icon("bolt")} Masuk</button>
      <div class="auth-switch"><a href="#/forgot">Lupa password?</a></div>
      <div class="auth-switch">Belum punya akun? <a href="#/register">Daftar</a></div>
    </div>`;
  $("#l-btn").onclick = async () => {
    const btn = $("#l-btn"); btn.disabled = true; btn.textContent = "Memproses…";
    try { await login($("#l-em").value.trim(), $("#l-pw").value); toast("Login berhasil","ok"); location.hash = "#/"; }
    catch(e){ console.error(e); toast(friendlyError(e),"err"); }
    finally { btn.disabled = false; btn.innerHTML = `${icon("bolt")} Masuk`; }
  };
};

views.register = (el) => {
  if(getUser()){ location.hash = "#/"; return; }
  el.innerHTML = `
    <div class="auth-wrap">
      <h1>Daftar</h1>
      <p class="sub">Buat akun bungkusin.store</p>
      <div class="form-group"><label>Nama</label><input class="input" id="r-name" placeholder="Nama lengkap" autocomplete="name"></div>
      <div class="form-group"><label>Email</label><input class="input" type="email" id="r-em" placeholder="nama@email.com" autocomplete="email"></div>
      <div class="form-group"><label>Password</label><input class="input" type="password" id="r-pw" placeholder="Min 6 karakter" autocomplete="new-password"></div>
      <button class="btn btn-brand btn-block" id="r-btn">${icon("sparkles")} Daftar</button>
      <div class="auth-switch">Sudah punya akun? <a href="#/login">Masuk</a></div>
    </div>`;
  $("#r-btn").onclick = async () => {
    const name = $("#r-name").value.trim(), email = $("#r-em").value.trim(), pw = $("#r-pw").value;
    if(!name || !email || pw.length < 6){ toast("Isi semua field. Password min 6 karakter.","err"); return; }
    const btn = $("#r-btn"); btn.disabled = true; btn.textContent = "Memproses…";
    try { await register(name, email, pw); toast("Akun berhasil dibuat","ok"); location.hash = "#/"; }
    catch(e){ console.error(e); toast(friendlyError(e),"err"); }
    finally { btn.disabled = false; btn.innerHTML = `${icon("sparkles")} Daftar`; }
  };
};

views.forgot = (el) => {
  el.innerHTML = `
    <div class="auth-wrap">
      <h1>Lupa Password</h1>
      <p class="sub">Masukkan email untuk reset password</p>
      <div class="form-group"><label>Email</label><input class="input" type="email" id="f-em" placeholder="nama@email.com"></div>
      <button class="btn btn-brand btn-block" id="f-btn">Kirim Link Reset</button>
      <div class="auth-switch"><a href="#/login">Kembali ke Login</a></div>
    </div>`;
  $("#f-btn").onclick = async () => {
    const em = $("#f-em").value.trim();
    if(!em){ toast("Masukkan email","err"); return; }
    try { await resetPassword(em); toast("Link reset dikirim ke email","ok"); location.hash = "#/login"; }
    catch(e){ toast(friendlyError(e),"err"); }
  };
};

/* ---------- STATIC ---------- */
views.help = (el) => {
  el.innerHTML = `
    <div class="section-head"><h2>${icon("info")} Bantuan</h2></div>
    <div class="summary mb-16"><h3>Cara Membeli</h3>
      <p class="muted mt-8" style="line-height:1.75">1. Cari produk di Explore.<br>2. Buka detail produk → Beli Sekarang / Keranjang.<br>3. Checkout → pilih metode pembayaran.<br>4. Upload bukti transfer.<br>5. Tunggu verifikasi admin.<br>6. Produk bisa didownload di Download Saya.</p></div>
    <div class="summary mb-16"><h3>Cara Download</h3>
      <p class="muted mt-8" style="line-height:1.75">Setelah pembayaran diverifikasi, buka menu Download Saya dan klik tombol Download.</p></div>
    <div class="summary mb-16"><h3>Refund</h3>
      <p class="muted mt-8" style="line-height:1.75">Produk digital bersifat non-refundable kecuali ada masalah teknis yang tidak bisa kami selesaikan.</p></div>
    <div class="summary"><h3>Kontak</h3>
      <p class="muted mt-8">Email: hello@bungkusin.store</p></div>`;
};
views.terms = (el) => {
  el.innerHTML = `<div class="section-head"><h2>${icon("shield")} Syarat & Ketentuan</h2></div>
    <div class="summary"><p class="muted" style="line-height:1.8">Dengan menggunakan bungkusin.store, Anda setuju untuk tidak menyebarluaskan produk digital yang dibeli tanpa izin, tidak melakukan refund ilegal, dan mematuhi seluruh peraturan yang berlaku. Semua produk dilisensikan sesuai ketentuan masing-masing pembuat.</p></div>`;
};
views.privacy = (el) => {
  el.innerHTML = `<div class="section-head"><h2>${icon("shield")} Kebijakan Privasi</h2></div>
    <div class="summary"><p class="muted" style="line-height:1.8">Kami menghormati privasi Anda. Data yang kami kumpulkan hanya digunakan untuk keperluan transaksi dan layanan. Kami tidak menjual data pengguna kepada pihak ketiga.</p></div>`;
};
views.maintenance = (el) => {
  el.innerHTML = `<div class="empty"><svg class="ic" style="width:60px;height:60px"><use href="#i-settings"/></svg>
    <h3>Dalam Pemeliharaan</h3><p>Toko sedang dalam pemeliharaan. Silakan kembali lagi nanti.</p></div>`;
};
views.notfound = (el) => {
  el.innerHTML = emptyState("search","Halaman tidak ditemukan","Cek kembali URL.","#/","Ke Home");
};

/* ============================================================
   ADMIN
   ============================================================ */
const logAdmin = async (action, target, extra={}) => {
  try { await push(ref(db,"adminLogs"), { adminId:getUser()?.uid, action, target, ...extra, at:Date.now() }); } catch {}
};

views.admin = (el, params={}) => {
  if(!isAdmin()){
    el.innerHTML = emptyState("shield","Akses Ditolak","Anda tidak memiliki akses ke halaman ini.","#/","Kembali");
    return;
  }
  const sub = params.sub || "dashboard";
  el.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-side">
        <a href="#/admin" data-a="dashboard">${icon("chart")} Dashboard</a>
        <a href="#/admin/products" data-a="products">${icon("box")} Produk</a>
        <a href="#/admin/orders" data-a="orders">${icon("cart")} Order</a>
        <a href="#/admin/users" data-a="users">${icon("user")} Pengguna</a>
        <a href="#/admin/coupons" data-a="coupons">${icon("ticket")} Kupon</a>
        <a href="#/admin/categories" data-a="categories">${icon("grid")} Kategori</a>
        <a href="#/admin/settings" data-a="settings">${icon("settings")} Pengaturan</a>
      </aside>
      <section class="admin-content" id="admin-content"></section>
    </div>`;
  el.querySelector(`[data-a="${sub}"]`)?.classList.add("active");
  const content = $("#admin-content");
  const routes = {
    dashboard: adminDashboard, products: adminProducts, orders: adminOrders,
    users: adminUsers, coupons: adminCoupons, categories: adminCategories,
    settings: adminSettings
  };
  (routes[sub] || adminDashboard)(content);
};

const adminDashboard = async (el) => {
  el.innerHTML = `<div class="stat-grid" id="stats"></div><div class="chart-wrap"><h3>Revenue 7 Hari Terakhir</h3><div class="bar-chart" id="chart"></div></div>`;
  const [oS, pS, uS, dS] = await Promise.all([
    get(ref(db,"orders")), get(ref(db,"products")),
    get(ref(db,"users")), get(ref(db,"downloadLogs"))
  ]);
  const orders = oS.exists() ? Object.values(oS.val()) : [];
  const products = pS.exists() ? Object.values(pS.val()) : [];
  const users = uS.exists() ? Object.values(uS.val()) : [];
  const downloads = dS.exists() ? Object.values(dS.val()).flatMap(x=>Object.values(x)) : [];
  const paid = orders.filter(o => ["paid","completed"].includes(o.orderStatus));
  const revenue = paid.reduce((s,o) => s + (Number(o.total)||0), 0);
  const pending = orders.filter(o => o.orderStatus === "waiting_verification").length;

  $("#stats").innerHTML = `
    <div class="stat"><svg class="ic"><use href="#i-chart"/></svg><div class="lbl">Revenue</div><div class="val">${rupiah(revenue)}</div></div>
    <div class="stat"><svg class="ic"><use href="#i-cart"/></svg><div class="lbl">Orders</div><div class="val">${orders.length}</div></div>
    <div class="stat"><svg class="ic"><use href="#i-box"/></svg><div class="lbl">Produk</div><div class="val">${products.length}</div></div>
    <div class="stat"><svg class="ic"><use href="#i-user"/></svg><div class="lbl">Pengguna</div><div class="val">${users.length}</div></div>
    <div class="stat"><svg class="ic"><use href="#i-download"/></svg><div class="lbl">Downloads</div><div class="val">${downloads.length}</div></div>
    <div class="stat"><svg class="ic"><use href="#i-clock"/></svg><div class="lbl">Pending</div><div class="val">${pending}</div></div>`;

  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
    days.push({ label:d.toLocaleDateString("id-ID",{weekday:"short"}), start:d.getTime(), end:d.getTime()+86400000, total:0 });
  }
  paid.forEach(o => { const day = days.find(d => o.createdAt >= d.start && o.createdAt < d.end); if(day) day.total += Number(o.total)||0; });
  const max = Math.max(1, ...days.map(d=>d.total));
  $("#chart").innerHTML = days.map(d => `
    <div class="bar" style="height:${Math.max(8,(d.total/max)*100)}%" title="${rupiah(d.total)}">
      <div class="bar-label">${esc(d.label)}</div>
    </div>`).join("");
};

const adminProducts = (el) => {
  el.innerHTML = `
    <div class="row sb mb-16"><h3 style="font-size:16px;font-weight:800">Kelola Produk</h3>
      <button class="btn btn-brand btn-sm" id="np">${icon("plus")} Produk Baru</button></div>
    <div class="table-wrap"><table id="pt"><thead><tr><th>Nama</th><th>Kategori</th><th>Harga</th><th>File</th><th>Status</th><th></th></tr></thead><tbody><tr><td colspan="6" class="muted">Memuat…</td></tr></tbody></table></div>`;
  const un = onValue(ref(db,"products"), snap => {
    const list = Object.entries(snap.val()||{}).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const tb = $("#pt tbody"); if(!tb) return;
    if(!list.length){ tb.innerHTML = `<tr><td colspan="6" class="muted">Belum ada produk.</td></tr>`; return; }
    tb.innerHTML = list.map(p=>`
      <tr>
        <td><b>${esc(p.name)}</b><div class="muted" style="font-size:11px">v${esc(p.version||"1.0.0")}</div></td>
        <td>${esc(p.category||"-")}</td>
        <td>${rupiah(p.discountPrice ?? p.price)}</td>
        <td>${p.fileUrl ? `<span class="status paid">OK</span>` : `<span class="status cancelled">Kosong</span>`}</td>
        <td><span class="status ${p.status==="disabled"?"cancelled":"paid"}">${esc(p.status||"active")}</span></td>
        <td class="row" style="gap:6px">
          <button class="btn btn-outline btn-sm" data-ed="${esc(p.id)}">${icon("edit")}</button>
          <button class="btn btn-outline btn-sm" data-dl="${esc(p.id)}">${icon("trash")}</button>
        </td>
      </tr>`).join("");
    $$("[data-ed]", tb).forEach(b => b.onclick = () => productForm(b.dataset.ed, list.find(x=>x.id===b.dataset.ed)));
    $$("[data-dl]", tb).forEach(b => b.onclick = async () => {
      if(!await confirmDialog("Hapus produk?","Produk akan dihapus permanen.")) return;
      await remove(ref(db,"products/"+b.dataset.dl));
      await logAdmin("DELETE_PRODUCT", b.dataset.dl);
      toast("Produk dihapus","ok");
    });
  });
  window.__adminProductsUnsub = un;
  $("#np").onclick = () => productForm(null);
};

const productForm = (id, p=null) => {
  p = p || {};
  const isNew = !id;
  const m = openModal({
    title: isNew ? "Produk Baru" : "Edit Produk",
    size:"lg",
    body:`
      <div class="form-group"><label>Nama Produk</label><input class="input" id="f-name" value="${esc(p.name||"")}"></div>
      <div class="form-group"><label>Deskripsi</label><textarea class="textarea" id="f-desc">${esc(p.description||"")}</textarea></div>
      <div class="row wrap" style="gap:12px">
        <div class="form-group" style="flex:1;min-width:160px"><label>Kategori</label><input class="input" id="f-cat" value="${esc(p.category||"")}"></div>
        <div class="form-group" style="flex:1;min-width:160px"><label>Harga (0=gratis)</label><input class="input" type="number" id="f-price" value="${p.price??0}"></div>
      </div>
      <div class="row wrap" style="gap:12px">
        <div class="form-group" style="flex:1;min-width:160px"><label>Harga Diskon</label><input class="input" type="number" id="f-disc" value="${p.discountPrice??""}"></div>
        <div class="form-group" style="flex:1;min-width:160px"><label>Lisensi</label>
          <select class="select" id="f-lic">${["Personal","Commercial","Extended","Developer","Lifetime"].map(l=>`<option ${l===p.license?'selected':''}>${l}</option>`).join("")}</select>
        </div>
      </div>
      <div class="form-group"><label>Thumbnail URL</label><input class="input" id="f-thumb" value="${esc(p.thumbnail||"")}" placeholder="https://…"></div>
      <div class="form-group"><label>Gallery (satu per baris)</label><textarea class="textarea" id="f-gal">${esc((p.gallery||[]).join("\n"))}</textarea></div>
      <div class="row wrap" style="gap:12px">
        <div class="form-group" style="flex:1;min-width:120px"><label>Format</label><input class="input" id="f-format" value="${esc(p.fileFormat||"")}" placeholder="ZIP"></div>
        <div class="form-group" style="flex:1;min-width:120px"><label>Ukuran</label><input class="input" id="f-size" value="${esc(p.fileSize||"")}" placeholder="24 MB"></div>
        <div class="form-group" style="flex:1;min-width:120px"><label>Versi</label><input class="input" id="f-ver" value="${esc(p.version||"1.0.0")}"></div>
      </div>
      <div class="form-group"><label>Kompatibilitas</label><input class="input" id="f-comp" value="${esc(p.compatibility||"")}"></div>
      <div class="form-group"><label>Fitur (satu per baris)</label><textarea class="textarea" id="f-feat">${esc(p.features||"")}</textarea></div>
      <div class="form-group"><label>Isi Produk (satu per baris)</label><textarea class="textarea" id="f-cont">${esc(p.contents||"")}</textarea></div>
      <div class="form-group"><label>Changelog</label><textarea class="textarea" id="f-chlog">${esc(p.changelog||"")}</textarea></div>
      <div class="row wrap" style="gap:12px">
        <div class="form-group" style="flex:1;min-width:200px"><label>Demo URL</label><input class="input" id="f-demo" value="${esc(p.demoUrl||"")}"></div>
        <div class="form-group" style="flex:1;min-width:200px"><label>File Download URL</label><input class="input" id="f-file" value="${esc(p.fileUrl||"")}" placeholder="https://storage…"></div>
      </div>
      <div class="row wrap" style="gap:12px">
        <div class="form-group" style="flex:1;min-width:140px"><label>Download Limit</label><input class="input" type="number" id="f-dl" value="${p.downloadLimit??0}" placeholder="0=unlimited"></div>
        <div class="form-group" style="flex:1;min-width:140px"><label>Status</label>
          <select class="select" id="f-status">
            <option value="active" ${p.status!=="disabled"?'selected':''}>Active</option>
            <option value="disabled" ${p.status==="disabled"?'selected':''}>Disabled</option>
          </select>
        </div>
      </div>
      <label class="checkbox"><input type="checkbox" id="f-usekey" ${p.useLicenseKey?'checked':''}> Gunakan license key</label>
    `,
    footer:`<button class="btn btn-outline" data-c>Batal</button><button class="btn btn-brand" data-s>Simpan</button>`
  });
  m.el.querySelector("[data-c]").onclick = m.close;
  m.el.querySelector("[data-s]").onclick = async () => {
    const v = s => m.el.querySelector(s).value.trim();
    const data = {
      name: v("#f-name"), description: v("#f-desc"), category: v("#f-cat"),
      price: Number(v("#f-price"))||0,
      discountPrice: v("#f-disc") ? Number(v("#f-disc")) : null,
      license: v("#f-lic"), thumbnail: v("#f-thumb"),
      gallery: v("#f-gal").split("\n").map(s=>s.trim()).filter(Boolean),
      fileFormat: v("#f-format"), fileSize: v("#f-size"), version: v("#f-ver"),
      compatibility: v("#f-comp"), features: v("#f-feat"), contents: v("#f-cont"),
      changelog: v("#f-chlog"), demoUrl: v("#f-demo"), fileUrl: v("#f-file"),
      downloadLimit: Number(v("#f-dl"))||0, status: v("#f-status"),
      useLicenseKey: m.el.querySelector("#f-usekey").checked,
      updatedAt: Date.now()
    };
    if(!data.name){ toast("Nama wajib diisi","err"); return; }
    try {
      if(isNew){
        data.createdAt = Date.now(); data.sold = 0; data.ratingSum = 0; data.ratingCount = 0;
        data.author = getProfile()?.displayName || "bungkusin";
        const r = push(ref(db,"products"));
        await set(r, data);
        await logAdmin("CREATE_PRODUCT", r.key);
      } else {
        await update(ref(db,"products/"+id), data);
        await logAdmin("UPDATE_PRODUCT", id);
      }
      toast("Produk disimpan","ok");
      m.close();
    } catch(e){ console.error(e); toast("Gagal menyimpan","err"); }
  };
};

const adminOrders = (el) => {
  el.innerHTML = `
    <div class="row sb mb-16 wrap"><h3 style="font-size:16px;font-weight:800">Kelola Order</h3>
      <div class="chips" style="margin:0">
        <button class="chip active" data-st="">Semua</button>
        <button class="chip" data-st="waiting_verification">Menunggu</button>
        <button class="chip" data-st="pending_payment">Belum Bayar</button>
        <button class="chip" data-st="completed">Selesai</button>
      </div>
    </div>
    <div class="table-wrap"><table id="ot"><thead><tr><th>Order ID</th><th>User</th><th>Total</th><th>Status</th><th>Tanggal</th><th></th></tr></thead><tbody></tbody></table></div>`;
  let all = [];
  const render = (filter="") => {
    const list = filter ? all.filter(o => o.orderStatus === filter) : all;
    const tb = $("#ot tbody"); if(!tb) return;
    tb.innerHTML = list.length ? list.map(o=>`
      <tr>
        <td class="mono">${esc(o.orderId)}</td>
        <td>${esc(o.userEmail||"-")}</td>
        <td>${rupiah(o.total)}</td>
        <td><span class="status ${o.orderStatus}">${esc(o.orderStatus)}</span></td>
        <td>${fmtDate(o.createdAt)}</td>
        <td><button class="btn btn-outline btn-sm" data-op="${esc(o.orderId)}">${icon("chev")}</button></td>
      </tr>`).join("") : `<tr><td colspan="6" class="muted">Tidak ada order.</td></tr>`;
    $$("[data-op]", tb).forEach(b => b.onclick = () => orderDetail(b.dataset.op));
  };
  $$(".chips .chip", el).forEach(b => b.onclick = () => {
    $$(".chips .chip", el).forEach(x => x.classList.toggle("active", x===b));
    render(b.dataset.st);
  });
  const un = onValue(ref(db,"orders"), snap => {
    all = Object.values(snap.val()||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    render();
  });
  window.__adminOrdersUnsub = un;
};

const orderDetail = async (orderId) => {
  const snap = await get(ref(db,"orders/"+orderId));
  if(!snap.exists()){ toast("Order tidak ditemukan","err"); return; }
  const o = snap.val();
  const m = openModal({
    title:"Order " + orderId, size:"lg",
    body:`
      <div class="row sb mb-8"><span class="muted">User</span><b>${esc(o.userEmail||"-")}</b></div>
      <div class="row sb mb-8"><span class="muted">Total</span><b>${rupiah(o.total)}</b></div>
      <div class="row sb mb-8"><span class="muted">Metode</span><b>${esc(o.paymentMethod)}</b></div>
      <div class="row sb mb-8"><span class="muted">Status</span><span class="status ${o.orderStatus}">${esc(o.orderStatus)}</span></div>
      <h4 style="margin:14px 0 8px;font-size:14px;font-weight:800">Item</h4>
      ${(o.items||[]).map(i=>`<div class="row sb" style="padding:8px 0;border-bottom:1px dashed var(--border)"><span>${esc(i.name)}</span><b>${rupiah(i.price)}</b></div>`).join("")}
      ${o.paymentProof?`<h4 style="margin:16px 0 8px;font-size:14px;font-weight:800">Bukti Pembayaran</h4><img src="${esc(o.paymentProof)}" alt="Bukti" style="max-width:100%;border-radius:12px;border:1px solid var(--border)">`:""}`,
    footer:`
      <button class="btn btn-danger btn-sm" data-r>${icon("x")} Tolak</button>
      <button class="btn btn-brand btn-sm" data-v>${icon("check")} Verifikasi & Selesaikan</button>`
  });
  m.el.querySelector("[data-v]").onclick = async () => {
    try {
      await update(ref(db,"orders/"+orderId), {
        orderStatus:"completed", paymentStatus:"paid", updatedAt:Date.now()
      });
      await grantEntitlements(o);
      await logAdmin("VERIFY_PAYMENT", orderId);
      toast("Order diverifikasi & selesai","ok");
      m.close();
    } catch(e){ console.error(e); toast("Gagal verifikasi","err"); }
  };
  m.el.querySelector("[data-r]").onclick = async () => {
    if(!await confirmDialog("Tolak order?","Order akan dibatalkan.")) return;
    await update(ref(db,"orders/"+orderId), {
      orderStatus:"cancelled", paymentStatus:"rejected", updatedAt:Date.now()
    });
    await push(ref(db, `notifications/${o.userId}`), {
      title:"Pembayaran Ditolak", message:`Pembayaran untuk order ${orderId} ditolak.`,
      type:"payment_rejected", createdAt:Date.now(), read:false
    });
    await logAdmin("REJECT_PAYMENT", orderId);
    toast("Order ditolak","info");
    m.close();
  };
};

const adminUsers = (el) => {
  el.innerHTML = `
    <div class="row sb mb-16"><h3 style="font-size:16px;font-weight:800">Pengguna</h3></div>
    <div class="table-wrap"><table id="ut"><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Order</th><th>Total</th><th></th></tr></thead><tbody><tr><td colspan="6" class="muted">Memuat…</td></tr></tbody></table></div>`;
  Promise.all([get(ref(db,"users")), get(ref(db,"orders"))]).then(([uS, oS]) => {
    const users = uS.exists() ? Object.entries(uS.val()).map(([id,v])=>({id,...v})) : [];
    const orders = oS.exists() ? Object.values(oS.val()) : [];
    const tb = $("#ut tbody");
    tb.innerHTML = users.length ? users.map(u => {
      const my = orders.filter(o => o.userId === u.id);
      const total = my.filter(o => ["paid","completed"].includes(o.orderStatus)).reduce((s,o)=>s+(Number(o.total)||0),0);
      return `
        <tr>
          <td><b>${esc(u.displayName||"-")}</b></td>
          <td>${esc(u.email||"-")}</td>
          <td><span class="status ${u.role==="admin"?"paid":""}">${esc(u.role||"user")}</span></td>
          <td>${my.length}</td>
          <td>${rupiah(total)}</td>
          <td class="row" style="gap:6px">
            <button class="btn btn-outline btn-sm" data-role="${esc(u.id)}" data-cur="${esc(u.role||"user")}">${icon("shield")}</button>
            <button class="btn btn-outline btn-sm" data-susp="${esc(u.id)}" data-s="${u.suspended?1:0}">${icon(u.suspended?"check":"x")}</button>
          </td>
        </tr>`;
    }).join("") : `<tr><td colspan="6" class="muted">Belum ada user.</td></tr>`;
    $$("[data-role]", tb).forEach(b => b.onclick = async () => {
      const nw = b.dataset.cur === "admin" ? "user" : "admin";
      if(!await confirmDialog("Ubah role?",`Ubah role user menjadi ${nw}?`)) return;
      await update(ref(db,"users/"+b.dataset.role), { role:nw });
      await logAdmin("UPDATE_USER_ROLE", b.dataset.role, { role:nw });
      toast("Role diperbarui","ok");
    });
    $$("[data-susp]", tb).forEach(b => b.onclick = async () => {
      const nw = b.dataset.s === "1" ? false : true;
      await update(ref(db,"users/"+b.dataset.susp), { suspended:nw });
      await logAdmin("UPDATE_USER_STATUS", b.dataset.susp, { suspended:nw });
      toast(nw?"User disuspend":"User diaktifkan","ok");
    });
  });
};

const adminCoupons = (el) => {
  el.innerHTML = `
    <div class="row sb mb-16"><h3 style="font-size:16px;font-weight:800">Kupon</h3>
      <button class="btn btn-brand btn-sm" id="nc">${icon("plus")} Kupon Baru</button></div>
    <div class="table-wrap"><table id="ct"><thead><tr><th>Kode</th><th>Tipe</th><th>Nilai</th><th>Kuota</th><th>Status</th><th></th></tr></thead><tbody></tbody></table></div>`;
  const un = onValue(ref(db,"coupons"), snap => {
    const list = Object.entries(snap.val()||{}).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const tb = $("#ct tbody"); if(!tb) return;
    tb.innerHTML = list.length ? list.map(c=>`
      <tr>
        <td><b class="mono">${esc(c.code)}</b></td>
        <td>${esc(c.discountType)}</td>
        <td>${c.discountType==="percentage"?c.discountValue+"%":rupiah(c.discountValue)}</td>
        <td>${c.usedCount||0}/${c.usageLimit||"∞"}</td>
        <td><span class="status ${c.active!==false?"paid":"cancelled"}">${c.active!==false?"Aktif":"Nonaktif"}</span></td>
        <td class="row" style="gap:6px">
          <button class="btn btn-outline btn-sm" data-tg="${esc(c.id)}" data-cur="${c.active!==false?1:0}">${icon(c.active!==false?"x":"check")}</button>
          <button class="btn btn-outline btn-sm" data-del="${esc(c.id)}">${icon("trash")}</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="6" class="muted">Belum ada kupon.</td></tr>`;
    $$("[data-tg]", tb).forEach(b => b.onclick = async () => {
      await update(ref(db,"coupons/"+b.dataset.tg), { active: b.dataset.cur !== "1" });
      await logAdmin("TOGGLE_COUPON", b.dataset.tg);
      toast("Status diubah","ok");
    });
    $$("[data-del]", tb).forEach(b => b.onclick = async () => {
      if(!await confirmDialog("Hapus kupon?","Aksi ini permanen.")) return;
      await remove(ref(db,"coupons/"+b.dataset.del));
      await logAdmin("DELETE_COUPON", b.dataset.del);
      toast("Kupon dihapus","ok");
    });
  });
  window.__adminCouponsUnsub = un;
  $("#nc").onclick = () => couponForm();
};

const couponForm = (id, c={}) => {
  const m = openModal({
    title: id?"Edit Kupon":"Kupon Baru",
    body:`
      <div class="form-group"><label>Kode</label><input class="input" id="c-code" value="${esc(c.code||"")}" placeholder="DISKON10"></div>
      <div class="form-group"><label>Tipe</label>
        <select class="select" id="c-type">
          <option value="percentage" ${c.discountType==="percentage"?'selected':''}>Percentage (%)</option>
          <option value="fixed" ${c.discountType==="fixed"?'selected':''}>Fixed (Rp)</option>
        </select>
      </div>
      <div class="form-group"><label>Nilai Diskon</label><input class="input" type="number" id="c-val" value="${c.discountValue??0}"></div>
      <div class="form-group"><label>Minimum Belanja</label><input class="input" type="number" id="c-min" value="${c.minimumPurchase??0}"></div>
      <div class="form-group"><label>Maksimum Diskon</label><input class="input" type="number" id="c-max" value="${c.maximumDiscount??0}"></div>
      <div class="form-group"><label>Kuota</label><input class="input" type="number" id="c-limit" value="${c.usageLimit??0}"></div>
      <div class="form-group"><label>Tanggal Mulai</label><input class="input" type="date" id="c-start" value="${c.startDate?new Date(c.startDate).toISOString().slice(0,10):""}"></div>
      <div class="form-group"><label>Tanggal Berakhir</label><input class="input" type="date" id="c-end" value="${c.endDate?new Date(c.endDate).toISOString().slice(0,10):""}"></div>
      <label class="checkbox"><input type="checkbox" id="c-active" ${c.active!==false?'checked':''}> Aktif</label>
    `,
    footer:`<button class="btn btn-outline" data-c>Batal</button><button class="btn btn-brand" data-s>Simpan</button>`
  });
  m.el.querySelector("[data-c]").onclick = m.close;
  m.el.querySelector("[data-s]").onclick = async () => {
    const v = s => m.el.querySelector(s).value.trim();
    const code = v("#c-code").toUpperCase();
    if(!code){ toast("Kode wajib","err"); return; }
    const data = {
      code,
      discountType: v("#c-type"),
      discountValue: Number(v("#c-val"))||0,
      minimumPurchase: Number(v("#c-min"))||0,
      maximumDiscount: Number(v("#c-max"))||0,
      usageLimit: Number(v("#c-limit"))||0,
      startDate: v("#c-start") ? new Date(v("#c-start")).getTime() : null,
      endDate: v("#c-end") ? new Date(v("#c-end")).getTime() + 86399999 : null,
      active: m.el.querySelector("#c-active").checked,
      usedCount: c.usedCount||0,
      createdAt: c.createdAt||Date.now()
    };
    try {
      if(id){ await update(ref(db,"coupons/"+id), data); await logAdmin("UPDATE_COUPON", id); }
      else { const r = push(ref(db,"coupons")); await set(r, data); await logAdmin("CREATE_COUPON", r.key); }
      toast("Kupon disimpan","ok");
      m.close();
    } catch(e){ console.error(e); toast("Gagal simpan","err"); }
  };
};

const adminCategories = (el) => {
  el.innerHTML = `
    <div class="row sb mb-16"><h3 style="font-size:16px;font-weight:800">Kategori</h3>
      <button class="btn btn-brand btn-sm" id="ncat">${icon("plus")} Tambah</button></div>
    <div class="table-wrap"><table id="ctab"><thead><tr><th>Nama</th><th>Icon</th><th></th></tr></thead><tbody></tbody></table></div>`;
  const un = onValue(ref(db,"categories"), snap => {
    const list = Object.entries(snap.val()||{}).map(([id,v])=>({id,...v}));
    const tb = $("#ctab tbody");
    tb.innerHTML = list.length ? list.map(c=>`
      <tr><td><b>${esc(c.name)}</b></td><td>${icon(c.icon||"grid")} ${esc(c.icon||"grid")}</td>
      <td><button class="btn btn-outline btn-sm" data-del="${esc(c.id)}">${icon("trash")}</button></td>
      </tr>`).join("") : `<tr><td colspan="3" class="muted">Belum ada kategori.</td></tr>`;
    $$("[data-del]", tb).forEach(b => b.onclick = async () => {
      if(!await confirmDialog("Hapus kategori?","")) return;
      await remove(ref(db,"categories/"+b.dataset.del));
      toast("Dihapus","ok");
    });
  });
  window.__adminCategoriesUnsub = un;
  $("#ncat").onclick = () => {
    const m = openModal({
      title:"Kategori Baru",
      body:`<div class="form-group"><label>Nama</label><input class="input" id="cat-name"></div>
            <div class="form-group"><label>Icon</label><input class="input" id="cat-icon" value="grid" placeholder="grid/tag/box/…"></div>`,
      footer:`<button class="btn btn-outline" data-c>Batal</button><button class="btn btn-brand" data-s>Simpan</button>`
    });
    m.el.querySelector("[data-c]").onclick = m.close;
    m.el.querySelector("[data-s]").onclick = async () => {
      const name = m.el.querySelector("#cat-name").value.trim();
      if(!name){ toast("Nama wajib","err"); return; }
      await push(ref(db,"categories"), { name, icon: m.el.querySelector("#cat-icon").value.trim()||"grid", createdAt:Date.now() });
      toast("Kategori dibuat","ok");
      m.close();
    };
  };
};

const adminSettings = async (el) => {
  const s = await getSettings();
  el.innerHTML = `
    <div class="row sb mb-16"><h3 style="font-size:16px;font-weight:800">Pengaturan Toko</h3></div>
    <div class="summary mb-16">
      <div class="form-group"><label>Nama Toko</label><input class="input" id="s-name" value="${esc(s.storeName||"bungkusin.store")}"></div>
      <div class="form-group"><label>Deskripsi</label><textarea class="textarea" id="s-desc">${esc(s.description||"")}</textarea></div>
      <div class="form-group"><label>Kontak Email</label><input class="input" id="s-contact" value="${esc(s.contact||"")}"></div>
      <label class="checkbox"><input type="checkbox" id="s-maint" ${s.maintenance?'checked':''}> Aktifkan Maintenance Mode</label>
    </div>
    <div class="summary mb-16">
      <h3>Metode Pembayaran</h3>
      <div class="form-group"><label>QRIS — Instruksi</label><textarea class="textarea" id="s-qris">${esc(s.payments?.qris?.instructions||"")}</textarea></div>
      <label class="checkbox"><input type="checkbox" id="s-qris-on" ${s.payments?.qris?.enabled!==false?'checked':''}> QRIS Aktif</label>
      <div class="form-group"><label>E-Wallet — Nomor</label><input class="input" id="s-ewallet-num" value="${esc(s.payments?.ewallet?.accountNumber||"")}"></div>
      <div class="form-group"><label>E-Wallet — Instruksi</label><textarea class="textarea" id="s-ewallet">${esc(s.payments?.ewallet?.instructions||"")}</textarea></div>
      <div class="form-group"><label>Bank — Nomor Rekening</label><input class="input" id="s-bank-num" value="${esc(s.payments?.bank?.accountNumber||"")}"></div>
      <div class="form-group"><label>Bank — Instruksi</label><textarea class="textarea" id="s-bank">${esc(s.payments?.bank?.instructions||"")}</textarea></div>
    </div>
    <button class="btn btn-brand btn-block" id="s-save">${icon("check")} Simpan Pengaturan</button>`;
  $("#s-save").onclick = async () => {
    const data = {
      storeName: $("#s-name").value.trim(),
      description: $("#s-desc").value.trim(),
      contact: $("#s-contact").value.trim(),
      maintenance: $("#s-maint").checked,
      currency: "IDR",
      payments: {
        qris:{ enabled:$("#s-qris-on").checked, name:"QRIS", instructions:$("#s-qris").value.trim() },
        ewallet:{ enabled:true, name:"E-Wallet", accountNumber:$("#s-ewallet-num").value.trim(), instructions:$("#s-ewallet").value.trim() },
        bank:{ enabled:true, name:"Bank Transfer", accountNumber:$("#s-bank-num").value.trim(), instructions:$("#s-bank").value.trim() }
      },
      updatedAt: Date.now()
    };
    try {
      await set(ref(db,"settings"), data);
      settingsCache = data;
      await logAdmin("UPDATE_SETTINGS", "settings");
      toast("Pengaturan disimpan","ok");
    } catch(e){ console.error(e); toast("Gagal simpan","err"); }
  };
};

/* ============================================================
   GRANT ENTITLEMENTS
   ============================================================ */
const grantEntitlements = async (order) => {
  for(const item of (order.items||[])){
    try { await runTransaction(ref(db, `products/${item.productId}/sold`), c => (Number(c)||0)+1); } catch {}
  }
  for(const item of (order.items||[])){
    const p = await getProduct(item.productId);
    if(!p?.useLicenseKey) continue;
    const snap = await get(ref(db, `licenseKeys/${item.productId}`));
    if(!snap.exists()) continue;
    const keys = Object.entries(snap.val());
    const avail = keys.find(([,v]) => v.status === "Available");
    if(!avail) continue;
    const [keyId, kd] = avail;
    await update(ref(db, `licenseKeys/${item.productId}/${keyId}`), {
      status:"Assigned", orderId:order.orderId, userId:order.userId, assignedAt:Date.now()
    });
    await set(ref(db, `licenses/${order.userId}/${keyId}`), {
      key:kd.key, productId:item.productId, productName:item.name,
      orderId:order.orderId, status:"Assigned", assignedAt:Date.now()
    });
  }
  await push(ref(db, `notifications/${order.userId}`), {
    title:"Pembelian Berhasil",
    message:`Order ${order.orderId} telah selesai. Produk siap didownload.`,
    type:"order_completed", createdAt:Date.now(), read:false
  });
};

/* ============================================================
   SEARCH OVERLAY
   ============================================================ */
const setupSearch = () => {
  const overlay = $("#searchOverlay");
  const input = $("#searchInput");
  const body = $("#searchBody");
  const trigger = $("#searchTrigger");

  const open = () => { overlay.classList.add("open"); overlay.setAttribute("aria-hidden","false"); setTimeout(()=>input.focus(),60); renderDefault(); };
  const close = () => { overlay.classList.remove("open"); overlay.setAttribute("aria-hidden","true"); input.value=""; };

  trigger?.addEventListener("click", open);
  $("#searchClose")?.addEventListener("click", close);
  overlay.addEventListener("click", e => { if(e.target===overlay) close(); });
  document.addEventListener("keydown", e => {
    if(e.key === "/" && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)){ e.preventDefault(); open(); }
    if(e.key === "Escape" && overlay.classList.contains("open")) close();
  });

  const renderDefault = () => {
    const recents = store.get("recentSearch", []);
    body.innerHTML = `
      <div class="muted" style="padding:8px 15px 4px;font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em">Rekomendasi</div>
      ${["template","script","ebook","ui kit"].map(q=>`<div class="search-suggest" data-q="${esc(q)}">${icon("search")} ${esc(q)}</div>`).join("")}
      ${recents.length ? `<div class="muted" style="padding:14px 15px 4px;font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em">Terakhir</div>
        ${recents.slice(0,6).map(r=>`<div class="search-suggest" data-q="${esc(r)}">${icon("clock")} ${esc(r)}</div>`).join("")}` : ""}`;
    bindSuggest();
  };
  const bindSuggest = () => { $$(".search-suggest", body).forEach(s => s.onclick = () => { input.value = s.dataset.q; runSearch(s.dataset.q); }); };

  const runSearch = (q) => {
    q = q.trim();
    if(!q){ renderDefault(); return; }
    const recents = store.get("recentSearch", []);
    if(!recents.includes(q)){ recents.unshift(q); store.set("recentSearch", recents.slice(0,10)); }
    const all = productsCache || [];
    const res = searchProducts(all, q).slice(0,10);
    body.innerHTML = res.length ? res.map(p=>`
      <a class="search-suggest" href="#/product/${esc(p.id)}" data-p>
        <img src="${esc(p.thumbnail||placeholderImg(p.name))}" onerror="this.onerror=null;this.src='${placeholderImg(p.name)}'" style="width:44px;height:32px;object-fit:cover;border-radius:8px" alt="">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
          <div class="muted" style="font-size:11.5px">${esc(p.category)} · ${rupiah(p.discountPrice??p.price)}</div>
        </div>
      </a>`).join("")
      : `<div class="empty" style="border:0;background:transparent;padding:32px"><svg class="ic"><use href="#i-search"/></svg><h3>Tidak ada hasil</h3><p>Coba kata kunci lain.</p></div>`;
    $$("[data-p]", body).forEach(a => a.addEventListener("click", close));
  };

  input.addEventListener("input", debounce(() => runSearch(input.value), 200));
  input.addEventListener("keydown", e => { if(e.key === "Enter") runSearch(input.value); });
};

/* ============================================================
   THEME
   ============================================================ */
const initTheme = () => {
  const saved = store.get("theme", "dark");
  document.body.dataset.theme = saved;
  updateThemeIcon();
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-theme-toggle]");
    if(!btn) return;
    const cur = document.body.dataset.theme;
    const next = cur === "dark" ? "light" : "dark";
    document.body.dataset.theme = next;
    store.set("theme", next);
    updateThemeIcon();
  });
};
const updateThemeIcon = () => {
  const isDark = document.body.dataset.theme === "dark";
  $$("[data-theme-toggle] .ic").forEach(el => {
    el.innerHTML = `<use href="#i-${isDark?'sun':'moon'}"/>`;
  });
};

/* ============================================================
   ROUTER
   ============================================================ */
let currentCleanup = null;
let lastRoute = "";

const parseHash = () => {
  const raw = location.hash.replace(/^#\/?/, "");
  const [pathRaw, queryRaw] = raw.split("?");
  const parts = pathRaw.split("/").filter(Boolean);
  const params = {};
  if(queryRaw) queryRaw.split("&").forEach(p => { const [k,v] = p.split("="); params[decodeURIComponent(k)] = decodeURIComponent(v||""); });
  return { parts, params };
};

const routes = {
  "": () => "home",
  "explore": () => "explore",
  "categories": () => "categories",
  "promo": () => "promo",
  "product": (parts) => ({ view:"product", params:{ id:parts[1] } }),
  "cart": () => "cart",
  "checkout": () => "checkout",
  "payment": (parts) => ({ view:"payment", params:{ id:parts[1] } }),
  "orders": () => "orders",
  "downloads": () => "downloads",
  "licenses": () => "licenses",
  "favorites": () => "favorites",
  "profile": () => "profile",
  "notifications": () => "notifications",
  "login": () => "login",
  "register": () => "register",
  "forgot": () => "forgot",
  "help": () => "help",
  "terms": () => "terms",
  "privacy": () => "privacy",
  "admin": (parts) => ({ view:"admin", params:{ sub:parts[1] || "dashboard" } })
};

const render = async () => {
  const app = $("#app");
  const { parts, params } = parseHash();
  const key = parts[0] || "";

  if(currentCleanup){ try { currentCleanup(); } catch {} currentCleanup = null; }
  if(notifUnsub){ try { notifUnsub(); } catch {} notifUnsub = null; }

  // Cleanup admin onValue listeners from previous route
  if(window.__adminProductsUnsub){ window.__adminProductsUnsub(); window.__adminProductsUnsub = null; }
  if(window.__adminOrdersUnsub){ window.__adminOrdersUnsub(); window.__adminOrdersUnsub = null; }
  if(window.__adminCouponsUnsub){ window.__adminCouponsUnsub(); window.__adminCouponsUnsub = null; }
  if(window.__adminCategoriesUnsub){ window.__adminCategoriesUnsub(); window.__adminCategoriesUnsub = null; }

  // Maintenance check
  try {
    const s = await getSettings();
    if(s.maintenance && !isAdmin() && key !== "login" && key !== "maintenance"){
      views.maintenance(app);
      updateActiveNav(key);
      return;
    }
  } catch {}

  const routeFn = routes[key];
  let result;
  if(!routeFn){ views.notfound(app); updateActiveNav(key); lastRoute = key; return; }
  result = routeFn(parts);

  if(typeof result === "string"){
    const view = views[result] || views.notfound;
    currentCleanup = await Promise.resolve(view(app, params));
  } else if(result && result.view){
    const view = views[result.view];
    currentCleanup = await Promise.resolve(view(app, result.params));
  } else {
    views.notfound(app);
  }

  updateActiveNav(key);
  updateAdminVisibility();
  lastRoute = key;
  window.scrollTo({ top:0, behavior:"instant" });
};

const updateActiveNav = (key) => {
  const map = { "":"home", "explore":"explore", "categories":"categories", "cart":"cart", "orders":"orders", "profile":"profile" };
  const navKey = map[key] || key;
  $$("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === navKey));
};

const updateAdminVisibility = () => {
  $$(".admin-only").forEach(el => el.hidden = !isAdmin());
};

/* ============================================================
   HEADER / DRAWER / NOTIF BADGE
   ============================================================ */
const setupHeader = () => {
  const drawer = $("#drawer");
  $("#menuBtn").onclick = () => { drawer.classList.add("open"); drawer.setAttribute("aria-hidden","false"); };
  $("#drawerClose").onclick = () => { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden","true"); };
  drawer.addEventListener("click", e => { if(e.target === drawer){ drawer.classList.remove("open"); drawer.setAttribute("aria-hidden","true"); } });
  $$(".drawer-link", drawer).forEach(a => a.addEventListener("click", () => {
    drawer.classList.remove("open"); drawer.setAttribute("aria-hidden","true");
  }));
};

const subscribeNotifBadge = () => {
  const check = () => {
    const user = getUser();
    if(notifUnsub){ try{ notifUnsub(); }catch{} notifUnsub = null; }
    if(!user){ const b = $("#notifBadge"); if(b) b.classList.remove("on"); return; }
    notifUnsub = onValue(ref(db, "notifications/"+user.uid), snap => {
      const data = snap.val() || {};
      const unread = Object.values(data).filter(n => !n.read).length;
      const b = $("#notifBadge"); if(!b) return;
      if(unread > 0){ b.textContent = unread > 99 ? "99+" : unread; b.classList.add("on"); }
      else b.classList.remove("on");
    });
  };
  authListeners.add(check);
  check();
};

/* ============================================================
   BOOTSTRAP
   ============================================================ */
const boot = async () => {
  initTheme();
  setupHeader();
  setupSearch();
  updateBadges();
  subscribeNotifBadge();

  await initAuth();

  // Update UI on auth change
  authListeners.add(() => {
    updateAdminVisibility();
    // Refresh current view when login state changes (for protected pages)
    if(["checkout","orders","downloads","licenses","profile","notifications","admin"].includes(lastRoute)){
      render();
    }
  });

  window.addEventListener("hashchange", render);
  await render();

  // Preload products + categories to warm caches (silent)
  subscribeProducts(()=>{});
  subscribeCategories(()=>{});
};

boot().catch(err => {
  console.error("Boot error", err);
  const app = $("#app");
  if(app) app.innerHTML = emptyState("info","Gagal memuat aplikasi","Periksa koneksi internet Anda.","#/","Coba Lagi");
});

/* ============================================================
   DATABASE RULES (SALIN KE FIREBASE CONSOLE)
   ============================================================
   Letakkan di: Realtime Database → Rules
   ----------------------------------------

   ============================================================ */

/* ============================================================
   CARA MEMBUAT ADMIN:
   1. Daftar akun lewat #/register
   2. Buka Firebase Console → Realtime Database → users/{UID}
   3. Ubah field "role" dari "user" menjadi "admin"
   4. Refresh aplikasi → menu Admin muncul di Profil/Drawer
   ============================================================ */
