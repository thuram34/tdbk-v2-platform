import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bell,
  Boxes, Check, ChevronDown, CircleDollarSign, ClipboardList, Clock3,
  LayoutDashboard, Menu, Package, Plus, Search, Settings, ShieldCheck,
  ShoppingCart, Smartphone, Trash2, TrendingUp, Truck, X,
} from "lucide-react";

type Product = {
  id: string; sku: string; name: string; category: string; barcode: string;
  priceMinor: number; costMinor: number; stock: number; reorderLevel: number;
  batch: string; expiry: string; status: "active" | "quarantined";
};
type Sale = { id: string; receipt: string; createdAt: string; totalMinor: number; items: number; method: "Cash"; };
type CartLine = { productId: string; quantity: number };

const seedProducts: Product[] = [
  { id: "p-001", sku: "MED-0001", name: "Paracetamol 500 mg", category: "Pain relief", barcode: "616110000001", priceMinor: 500, costMinor: 300, stock: 180, reorderLevel: 40, batch: "PCM-2604", expiry: "2027-08-31", status: "active" },
  { id: "p-002", sku: "MED-0002", name: "Oral rehydration salts", category: "Rehydration", barcode: "616110000002", priceMinor: 1500, costMinor: 950, stock: 48, reorderLevel: 20, batch: "ORS-2602", expiry: "2027-04-30", status: "active" },
  { id: "p-003", sku: "MED-0003", name: "Vitamin C 100 mg", category: "Vitamins", barcode: "616110000003", priceMinor: 1000, costMinor: 650, stock: 12, reorderLevel: 25, batch: "VTC-2512", expiry: "2026-12-31", status: "active" },
  { id: "p-004", sku: "SUP-0001", name: "Digital thermometer", category: "Medical supplies", barcode: "616110000004", priceMinor: 45000, costMinor: 32000, stock: 8, reorderLevel: 5, batch: "THM-2601", expiry: "2030-01-01", status: "active" },
  { id: "p-005", sku: "MED-0004", name: "Cetirizine 10 mg", category: "Allergy", barcode: "616110000005", priceMinor: 1200, costMinor: 700, stock: 0, reorderLevel: 15, batch: "CTZ-2601", expiry: "2027-03-31", status: "active" },
];
const money = (minor: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(minor / 100);
const dateLabel = (date: string) => new Date(date).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
function readStore<T,>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => readStore("chemist-pro.products", seedProducts));
  const [sales, setSales] = useState<Sale[]>(() => readStore("chemist-pro.sales", []));
  const [cart, setCart] = useState<CartLine[]>([]);
  const [page, setPage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [cartSearch, setCartSearch] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", sku: "", category: "General", price: "", cost: "", stock: "", reorderLevel: "10", batch: "", expiry: "" });

  useEffect(() => { localStorage.setItem("chemist-pro.products", JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem("chemist-pro.sales", JSON.stringify(sales)); }, [sales]);

  const today = new Date().toDateString();
  const todaySales = sales.filter(s => new Date(s.createdAt).toDateString() === today);
  const revenue = todaySales.reduce((sum, s) => sum + s.totalMinor, 0);
  const lowStock = products.filter(p => p.stock <= p.reorderLevel);
  const nearExpiry = products.filter(p => {
    const days = (new Date(p.expiry).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 120 && p.status === "active";
  });
  const filteredProducts = useMemo(() => products.filter(p => [p.name, p.sku, p.category, p.barcode].some(v => v.toLowerCase().includes(search.toLowerCase()))), [products, search]);
  const filteredCartProducts = products.filter(p => p.status === "active" && p.stock > 0 && [p.name, p.sku, p.barcode].some(v => v.toLowerCase().includes(cartSearch.toLowerCase())));
  const cartTotal = cart.reduce((sum, line) => sum + (products.find(p => p.id === line.productId)?.priceMinor ?? 0) * line.quantity, 0);
  const cartUnits = cart.reduce((sum, line) => sum + line.quantity, 0);

  function addToCart(product: Product) {
    if (product.status !== "active" || product.stock < 1) { setNotice("This product is not available for sale."); return; }
    setCart(prev => {
      const line = prev.find(l => l.productId === product.id);
      if (line && line.quantity >= product.stock) { setNotice("Quantity exceeds the stock shown on this device."); return prev; }
      return line ? prev.map(l => l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l) : [...prev, { productId: product.id, quantity: 1 }];
    });
    setNotice("");
  }
  function setQuantity(productId: string, quantity: number) {
    const product = products.find(p => p.id === productId);
    if (!product || quantity > product.stock) { setNotice("Quantity exceeds available demo stock."); return; }
    setCart(prev => quantity <= 0 ? prev.filter(l => l.productId !== productId) : prev.map(l => l.productId === productId ? { ...l, quantity } : l));
  }
  function checkout() {
    if (!cart.length) return;
    const badLine = cart.find(l => !products.some(p => p.id === l.productId && p.status === "active" && p.stock >= l.quantity));
    if (badLine) { setNotice("Stock changed. Review the cart before retrying."); return; }
    const total = cart.reduce((sum, l) => sum + (products.find(p => p.id === l.productId)?.priceMinor ?? 0) * l.quantity, 0);
    const sale: Sale = { id: crypto.randomUUID(), receipt: "DEMO-" + String(sales.length + 1).padStart(5, "0"), createdAt: new Date().toISOString(), totalMinor: total, items: cartUnits, method: "Cash" };
    setProducts(prev => prev.map(p => { const line = cart.find(l => l.productId === p.id); return line ? { ...p, stock: p.stock - line.quantity } : p; }));
    setSales(prev => [sale, ...prev]);
    setCart([]);
    setNotice("Demo sale saved locally. No real payment was collected.");
  }
  function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Math.round(Number(newProduct.price) * 100);
    const cost = Math.round(Number(newProduct.cost) * 100);
    const stock = Number(newProduct.stock);
    const reorder = Number(newProduct.reorderLevel);
    if (!newProduct.name.trim() || !newProduct.sku.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(cost) || cost < 0 || !Number.isInteger(stock) || stock < 0 || !Number.isInteger(reorder) || reorder < 0 || !newProduct.expiry) {
      setNotice("Enter valid product details, price, stock, and expiry date."); return;
    }
    if (products.some(p => p.sku.toLowerCase() === newProduct.sku.trim().toLowerCase())) { setNotice("That SKU already exists."); return; }
    const product: Product = { id: crypto.randomUUID(), sku: newProduct.sku.trim(), name: newProduct.name.trim(), category: newProduct.category.trim() || "General", barcode: "", priceMinor: price, costMinor: cost, stock, reorderLevel: reorder, batch: newProduct.batch.trim() || "UNRECORDED", expiry: newProduct.expiry, status: "active" };
    setProducts(prev => [product, ...prev]); setShowProductForm(false);
    setNewProduct({ name: "", sku: "", category: "General", price: "", cost: "", stock: "", reorderLevel: "10", batch: "", expiry: "" });
    setNotice("Product added to this browser's demo catalogue.");
  }

  const nav = [
    { label: "Dashboard", icon: LayoutDashboard },
    { label: "Point of Sale", icon: ShoppingCart },
    { label: "Products & Stock", icon: Boxes },
    { label: "Sales History", icon: ClipboardList },
    { label: "Suppliers", icon: Truck },
    { label: "Reports", icon: BarChart3 },
    { label: "Settings", icon: Settings },
  ];
  const changePage = (next: string) => { setPage(next); setMobileNav(false); setSearch(""); setNotice(""); };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Activity size={23}/></div><div><strong>TDBK <span>CHEMIST</span></strong><small>PRO · RETAIL OPERATIONS</small></div><button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <button className="workspace-switch"><div className="store-avatar">C</div><div className="workspace-text"><strong>My Chemist</strong><small>Standalone workspace</small></div><ChevronDown size={16}/></button>
      <div className="nav-label">OPERATIONS</div>
      <nav>{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => changePage(label)}><Icon size={18}/><span>{label}</span>{label === "Products & Stock" && lowStock.length > 0 && <em>{lowStock.length}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="connection-pill"><span className="connection-dot"/><span>Local demo mode</span></div><div className="user-card"><div className="user-avatar">O</div><div><strong>Store Owner</strong><small>Demo administrator</small></div><ChevronDown size={15}/></div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={21}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div></div><div className="topbar-actions"><div className="status-chip"><span/> Development prototype</div><button className="icon-button notification-button" aria-label="Notifications"><Bell size={19}/>{lowStock.length > 0 && <i/>}</button><div className="top-avatar">O</div></div></header>
      <div className="page-content">
        <div className="prototype-warning"><AlertTriangle size={17}/><span><strong>Prototype only.</strong> Data stays in this browser. Firebase sync, verified payments and production security are not connected.</span></div>
        {notice && <div className="toast" role="status"><Check size={17}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16}/></button></div>}

        {page === "Dashboard" && <>
          <div className="page-heading"><div><div className="eyebrow">STORE OVERVIEW</div><h1>Good day, Store Owner <span>✳</span></h1><p>Here’s the current snapshot of your chemist operations.</p></div><div className="date-display"><Clock3 size={16}/>{new Date().toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div></div>
          <div className="stat-grid">
            <StatCard title="Sales today" value={money(revenue)} detail={`${todaySales.length} completed demo sales`} icon={<CircleDollarSign/>} trend="Today's total" />
            <StatCard title="Items in catalogue" value={String(products.length)} detail={`${products.reduce((n,p)=>n+p.stock,0).toLocaleString()} units on hand`} icon={<Package/>} trend="Catalogue" />
            <StatCard title="Low stock alerts" value={String(lowStock.length)} detail="At or below reorder level" icon={<Boxes/>} alert={lowStock.length > 0} trend="Needs review" />
            <StatCard title="Near expiry" value={String(nearExpiry.length)} detail="Within the next 120 days" icon={<Clock3/>} alert={nearExpiry.length > 0} trend="Batch watch" />
          </div>
          <div className="dashboard-grid"><section className="panel sales-panel"><div className="panel-heading"><div><h2>Sales activity</h2><p>Recent demo transactions</p></div><button className="text-action" onClick={() => changePage("Sales History")}>View history <ArrowUpRight size={15}/></button></div>
            {sales.length ? <div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Time</th><th>Items</th><th>Payment</th><th className="align-right">Total</th></tr></thead><tbody>{sales.slice(0,5).map(s=><tr key={s.id}><td><strong>{s.receipt}</strong></td><td>{new Date(s.createdAt).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit"})}</td><td>{s.items}</td><td><span className="payment-badge">{s.method}</span></td><td className="align-right amount">{money(s.totalMinor)}</td></tr>)}</tbody></table></div> : <EmptyState icon={<TrendingUp/>} title="No sales recorded yet" text="Start a demo checkout to see activity here." action="Open point of sale" onClick={() => changePage("Point of Sale")}/>}
          </section><section className="panel alerts-panel"><div className="panel-heading"><div><h2>Attention required</h2><p>Stock that needs a review</p></div><AlertTriangle size={19} className="muted-icon"/></div>
            {lowStock.length ? <div className="alert-list">{lowStock.slice(0,5).map(p=><div className="alert-row" key={p.id}><div className="alert-product-icon"><Package size={17}/></div><div className="alert-product"><strong>{p.name}</strong><small>{p.sku}</small></div><div className={`stock-number ${p.stock === 0 ? "out" : ""}`}>{p.stock}<small>left</small></div></div>)}</div> : <EmptyState icon={<Check/>} title="Stock levels look good" text="No products are below their reorder level."/>}
            <button className="outline-action full-width" onClick={() => changePage("Products & Stock")}>Review inventory <ArrowDownRight size={16}/></button>
          </section></div>
          <section className="panel quick-actions"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks for your store</p></div></div><div className="quick-grid"><QuickAction icon={<ShoppingCart/>} title="New sale" text="Open the point of sale" onClick={() => changePage("Point of Sale")}/><QuickAction icon={<Plus/>} title="Add product" text="Create a catalogue entry" onClick={() => { setPage("Products & Stock"); setShowProductForm(true); }}/><QuickAction icon={<Boxes/>} title="Check stock" text="Review stock and expiry" onClick={() => changePage("Products & Stock")}/><QuickAction icon={<BarChart3/>} title="Sales report" text="Review demo transactions" onClick={() => changePage("Reports")}/></div></section>
        </>}

        {page === "Products & Stock" && <><div className="page-heading"><div><div className="eyebrow">CATALOGUE & INVENTORY</div><h1>Products & Stock</h1><p>Manage product details and monitor demo stock levels.</p></div><button className="primary-button" onClick={() => setShowProductForm(true)}><Plus size={17}/> Add product</button></div>
          <div className="mini-stats"><span><Package size={16}/>{products.length} products</span><span><AlertTriangle size={16}/>{lowStock.length} low stock</span><span><Clock3 size={16}/>{nearExpiry.length} near expiry</span></div>
          <div className="panel"><div className="table-toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, SKU, category or barcode..."/></div><span className="result-count">{filteredProducts.length} results</span></div><div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU / Batch</th><th>Expiry</th><th>Stock</th><th>Cost</th><th>Sell price</th><th>Status</th></tr></thead><tbody>{filteredProducts.map(p=><tr key={p.id}><td><div className="product-cell"><div className="product-thumb"><Package size={18}/></div><div><strong>{p.name}</strong><small>{p.category}</small></div></div></td><td><strong>{p.sku}</strong><small className="cell-sub">{p.batch}</small></td><td>{dateLabel(p.expiry)}</td><td><span className={`stock-tag ${p.stock <= p.reorderLevel ? "stock-low" : "stock-ok"}`}>{p.stock} units</span></td><td>{money(p.costMinor)}</td><td className="amount">{money(p.priceMinor)}</td><td><span className={`status-badge ${p.stock === 0 ? "status-danger" : p.stock <= p.reorderLevel ? "status-warning" : "status-success"}`}>{p.stock === 0 ? "Out of stock" : p.stock <= p.reorderLevel ? "Reorder" : "In stock"}</span></td></tr>)}</tbody></table>{!filteredProducts.length && <EmptyState icon={<Search/>} title="No products found" text="Try a different search term."/ >}</div></div>
          {showProductForm && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowProductForm(false);}}><form className="modal" onSubmit={saveProduct}><div className="modal-heading"><div><h2>Add product</h2><p>Add a demo catalogue entry. Batch receipt workflows are not yet implemented.</p></div><button type="button" className="icon-button" onClick={()=>setShowProductForm(false)} aria-label="Close"><X size={19}/></button></div><div className="form-grid"><label className="span-two">Product name<input required value={newProduct.name} onChange={e=>setNewProduct({...newProduct,name:e.target.value})} placeholder="e.g. Product name"/></label><label>SKU<input required value={newProduct.sku} onChange={e=>setNewProduct({...newProduct,sku:e.target.value})} placeholder="MED-0006"/></label><label>Category<input value={newProduct.category} onChange={e=>setNewProduct({...newProduct,category:e.target.value})}/></label><label>Selling price (KES)<input required type="number" min="0" step="0.01" value={newProduct.price} onChange={e=>setNewProduct({...newProduct,price:e.target.value})}/></label><label>Unit cost (KES)<input required type="number" min="0" step="0.01" value={newProduct.cost} onChange={e=>setNewProduct({...newProduct,cost:e.target.value})}/></label><label>Opening units<input required type="number" min="0" step="1" value={newProduct.stock} onChange={e=>setNewProduct({...newProduct,stock:e.target.value})}/></label><label>Reorder level<input required type="number" min="0" step="1" value={newProduct.reorderLevel} onChange={e=>setNewProduct({...newProduct,reorderLevel:e.target.value})}/></label><label>Batch number<input value={newProduct.batch} onChange={e=>setNewProduct({...newProduct,batch:e.target.value})} placeholder="Batch reference"/></label><label>Expiry date<input required type="date" value={newProduct.expiry} onChange={e=>setNewProduct({...newProduct,expiry:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>setShowProductForm(false)}>Cancel</button><button type="submit" className="primary-button"><Check size={16}/> Save demo product</button></div></form></div>}
        </>}

        {page === "Point of Sale" && <><div className="page-heading"><div><div className="eyebrow">CHECKOUT WORKSPACE</div><h1>Point of Sale</h1><p>Search the demo catalogue and build a cash checkout.</p></div><div className="pos-mode"><Smartphone size={16}/> Local demo checkout</div></div><div className="pos-layout"><section className="panel pos-catalogue"><div className="search-box pos-search"><Search size={18}/><input autoFocus value={cartSearch} onChange={e=>setCartSearch(e.target.value)} placeholder="Search products or scan barcode..."/></div><div className="pos-product-grid">{filteredCartProducts.map(p=><button className="pos-product" key={p.id} onClick={()=>addToCart(p)}><div className="pos-product-top"><div className="product-thumb large"><Package size={21}/></div><span className="pos-stock">{p.stock} left</span></div><strong>{p.name}</strong><small>{p.sku}</small><div className="pos-product-bottom"><b>{money(p.priceMinor)}</b><span className="add-product"><Plus size={16}/></span></div></button>)}</div>{!filteredCartProducts.length && <EmptyState icon={<Search/>} title="No available products" text="Search another item or add stock in Products & Stock."/>}</section><section className="panel cart-panel"><div className="cart-heading"><div><h2>Current sale</h2><p>{cartUnits} unit{cartUnits===1?"":"s"} in cart</p></div><button className="icon-button" onClick={()=>setCart([])} aria-label="Clear cart"><Trash2 size={17}/></button></div><div className="cart-lines">{cart.map(line=>{const p=products.find(x=>x.id===line.productId);if(!p)return null;return <div className="cart-line" key={line.productId}><div className="cart-line-main"><strong>{p.name}</strong><small>{money(p.priceMinor)} each</small></div><div className="quantity-control"><button onClick={()=>setQuantity(p.id,line.quantity-1)} aria-label="Decrease quantity">−</button><span>{line.quantity}</span><button onClick={()=>setQuantity(p.id,line.quantity+1)} aria-label="Increase quantity">+</button></div><strong className="line-total">{money(p.priceMinor*line.quantity)}</strong></div>;})}{!cart.length && <div className="empty-cart"><div><ShoppingCart size={25}/></div><strong>Your cart is empty</strong><span>Select a product to begin a sale.</span></div>}</div><div className="cart-summary"><div><span>Subtotal</span><strong>{money(cartTotal)}</strong></div><div><span>Discount</span><strong>{money(0)}</strong></div><div><span>Tax</span><strong>Configure before production</strong></div><div className="cart-grand-total"><span>Total</span><strong>{money(cartTotal)}</strong></div><div className="demo-payment-note"><AlertTriangle size={15}/> Demo cash only. No payment is collected.</div><button className="primary-button checkout-button" disabled={!cart.length} onClick={checkout}><Check size={18}/> Complete demo sale <span>{money(cartTotal)}</span></button></div></section></div></>}

        {page === "Sales History" && <><div className="page-heading"><div><div className="eyebrow">TRANSACTION REGISTER</div><h1>Sales History</h1><p>Browse locally saved demo transactions.</p></div><button className="outline-action" onClick={() => changePage("Point of Sale")}><ShoppingCart size={16}/> New sale</button></div><section className="panel"><div className="panel-heading"><div><h2>Transactions</h2><p>{sales.length} demo sales recorded</p></div></div><div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date & time</th><th>Items</th><th>Payment</th><th className="align-right">Total</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td><strong>{s.receipt}</strong></td><td>{new Date(s.createdAt).toLocaleString("en-KE")}</td><td>{s.items}</td><td><span className="payment-badge">{s.method} · Demo</span></td><td className="align-right amount">{money(s.totalMinor)}</td></tr>)}</tbody></table>{!sales.length && <EmptyState icon={<ClipboardList/>} title="No transactions yet" text="Complete a demo sale from the POS to populate this list." action="Open POS" onClick={() => changePage("Point of Sale")}/>}</div></section></>}

        {page === "Suppliers" && <PlaceholderPage title="Suppliers" eyebrow="PROCUREMENT" text="Supplier records, purchase orders, goods-received notes and payable tracking are planned for the next implementation stage." icon={<Truck/>} action="Continue to inventory" onClick={() => changePage("Products & Stock")}/>}
        {page === "Reports" && <><div className="page-heading"><div><div className="eyebrow">BUSINESS INTELLIGENCE</div><h1>Reports</h1><p>Summary from the demo records saved in this browser.</p></div></div><div className="stat-grid"><StatCard title="Recorded sales" value={String(sales.length)} detail="All demo transactions" icon={<ClipboardList/>}/><StatCard title="Sales value" value={money(sales.reduce((s,x)=>s+x.totalMinor,0))} detail="Not independently reconciled" icon={<CircleDollarSign/>}/><StatCard title="Estimated stock cost" value={money(products.reduce((s,p)=>s+p.stock*p.costMinor,0))} detail="Based on demo unit costs" icon={<Boxes/>}/><StatCard title="Potential gross margin" value={money(products.reduce((s,p)=>s+p.stock*(p.priceMinor-p.costMinor),0))} detail="Stock at listed prices, not realized profit" icon={<TrendingUp/>}/></div><section className="panel report-note"><ShieldCheck size={21}/><div><strong>Reports are illustrative</strong><p>These figures are derived from local demo data. They are not audited financial statements, tax calculations or reconciled cash reports.</p></div></section></>}
        {page === "Settings" && <PlaceholderPage title="Settings" eyebrow="WORKSPACE CONFIGURATION" text="Business identity, tax configuration, receipt numbering, user access, backup/export and integration credentials will be added in the secured configuration stage." icon={<Settings/>} action="Back to dashboard" onClick={() => changePage("Dashboard")}/>}
        <footer className="page-footer"><span>© {new Date().getFullYear()} TDBK Chemist Pro</span><span><ShieldCheck size={14}/> Development build · Not for live pharmacy operations</span></footer>
      </div>
    </main>
  </div>;
}

function StatCard({title,value,detail,icon,alert=false,trend}:{title:string;value:string;detail:string;icon:React.ReactNode;alert?:boolean;trend?:string}) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className={`stat-icon ${alert?"stat-icon-alert":""}`}>{icon}</div></div><div className="stat-value">{value}</div><div className="stat-bottom"><span>{detail}</span><span className={`stat-trend ${alert?"trend-alert":""}`}>{alert?<AlertTriangle size={13}/>:<ArrowUpRight size={13}/>} {trend}</span></div></div>;
}
function EmptyState({icon,title,text,action,onClick}:{icon:React.ReactNode;title:string;text:string;action?:string;onClick?:()=>void}) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{text}</p>{action&&onClick&&<button className="text-action" onClick={onClick}>{action} <ArrowUpRight size={15}/></button>}</div>;
}
function QuickAction({icon,title,text,onClick}:{icon:React.ReactNode;title:string;text:string;onClick:()=>void}) {
  return <button className="quick-action" onClick={onClick}><div className="quick-icon">{icon}</div><div><strong>{title}</strong><span>{text}</span></div><ArrowUpRight className="quick-arrow" size={16}/></button>;
}
function PlaceholderPage({title,eyebrow,text,icon,action,onClick}:{title:string;eyebrow:string;text:string;icon:React.ReactNode;action:string;onClick:()=>void}) {
  return <><div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div></div><section className="panel coming-soon"><div className="coming-icon">{icon}</div><span className="coming-badge">Planned module</span><h2>{title} workspace</h2><p>{text}</p><button className="primary-button" onClick={onClick}>{action} <ArrowUpRight size={16}/></button></section></>;
}
