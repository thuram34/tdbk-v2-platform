import React, { useMemo, useState } from 'react';
import {
  Laptop,
  Receipt,
  Wifi,
  Camera,
  Key,
  Cloud,
  Globe,
  Wrench,
  GraduationCap,
  Users,
  CheckCircle2,
  Headphones,
  LifeBuoy,
  Clock,
  Sparkles,
  ArrowRight,
  PhoneCall,
  Check,
  Boxes,
  Building2,
  ShoppingBag,
  Store,
  Stethoscope,
  Hotel,
  Info,
} from 'lucide-react';
import type { BusinessSector } from './PublicGateway';

interface CommercialBridgeProps {
  onSelectSector?: (sector: BusinessSector) => void;
  onBuildDigitalSpace?: (sector?: BusinessSector) => void;
}

type SaleCategory =
  | 'ALL'
  | 'HARDWARE'
  | 'NETWORKING'
  | 'SECURITY'
  | 'POS'
  | 'SOFTWARE'
  | 'DOMAINS'
  | 'PACKAGES'
  | 'RENEWALS';

type ServiceCategory =
  | 'ALL'
  | 'PRESENCE'
  | 'SYSTEMS'
  | 'PAYMENTS'
  | 'NETWORKING'
  | 'SECURITY'
  | 'CLOUD'
  | 'TRAINING'
  | 'SUPPORT'
  | 'GROWTH';

export const CommercialBridge: React.FC<CommercialBridgeProps> = ({
  onSelectSector,
  onBuildDigitalSpace,
}) => {
  // Navigation / Filter States
  const [activeSaleCategory, setActiveSaleCategory] = useState<SaleCategory>('ALL');
  const [activeServiceCategory, setActiveServiceCategory] = useState<ServiceCategory>('ALL');

  // Consultation Card Form State
  const [consultationName, setConsultationName] = useState('');
  const [consultationPhone, setConsultationPhone] = useState('');
  const [consultationSector, setConsultationSector] = useState<string>('Retail & Shops');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [consultationSuccess, setConsultationSuccess] = useState(false);
  const [quoteService, setQuoteService] = useState('SEO & Digital Growth');
  const [quoteQuantity, setQuoteQuantity] = useState(1);
  const [quoteScope, setQuoteScope] = useState('Implementation');
  const [quoteLabour, setQuoteLabour] = useState(0);
  const [quoteMaterials, setQuoteMaterials] = useState(0);

  const quoteServices = [
    { name: 'SEO & Digital Growth', unit: 'project', base: 15000 },
    { name: 'Domain & DNS Setup', unit: 'setup', base: 3500 },
    { name: 'Website Development', unit: 'project', base: 20000 },
    { name: 'Windows Installation', unit: 'device', base: 2500 },
    { name: 'Software / Office Installation', unit: 'device', base: 1500 },
    { name: 'CCTV Installation', unit: 'project', base: 15000 },
    { name: 'Network Installation', unit: 'project', base: 12000 },
    { name: 'Digital Signage Installation', unit: 'project', base: 10000 },
    { name: 'Smart Classroom Setup', unit: 'classroom', base: 25000 },
    { name: 'Managed IT Support', unit: 'month', base: 5000 },
  ];

  const selectedQuoteService = quoteServices.find((s) => s.name === quoteService) ?? quoteServices[0];
  const quoteSubtotal = useMemo(
    () => selectedQuoteService.base * Math.max(1, quoteQuantity) + Math.max(0, quoteLabour) + Math.max(0, quoteMaterials),
    [selectedQuoteService.base, quoteQuantity, quoteLabour, quoteMaterials]
  );
  const quoteVat = quoteSubtotal * 0.16;
  const quoteTotal = quoteSubtotal + quoteVat;

  const handleConsultationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultationPhone.trim()) {
      alert('Please provide your phone or M-Pesa contact number.');
      return;
    }
    setConsultationSuccess(true);
  };

  return (
    <div className="space-y-24">
      {/* =========================================================================
          1. THE COMMERCIAL COMPASS: GET IT → SET IT UP → RUN YOUR BUSINESS → KEEP IT WORKING
         ========================================================================= */}
      <section id="commercial-compass" className="scroll-mt-24">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-800 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
            <span>The TDBK Commercial Bridge</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-neutral-950 tracking-tight mb-4">
            Your complete journey to a connected Kenyan business.
          </h2>
          <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-2xl mx-auto">
            From procuring certified hardware to professional on-site setup, your custom DBK workspace,
            and dedicated ongoing support across all 47 counties.
          </p>
        </div>

        {/* 4-Step Compass Journey Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Step 1: Get It */}
          <div className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-xs flex flex-col justify-between relative group hover:border-neutral-300 transition">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-600">
                  Step 01
                </span>
                <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-800">
                  TDBK Sale
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-neutral-900 text-white flex items-center justify-center mb-5 shadow-xs">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-950 mb-1.5">GET IT</h3>
              <p className="text-xs font-semibold text-neutral-600 mb-3 uppercase tracking-wider">
                "Buy the technology."
              </p>
              <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                Commercial touchscreen tills, barcode scanners, receipt printers, high-grade laptops, Wi-Fi 6 gear,
                and authentic software licenses.
              </p>
            </div>
            <a
              href="#sale-catalog"
              className="pt-3 border-t border-neutral-100 text-xs font-bold text-neutral-900 flex items-center justify-between group-hover:text-neutral-950"
            >
              <span>Explore Equipment</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </a>
          </div>

          {/* Step 2: Set It Up */}
          <div className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-xs flex flex-col justify-between relative group hover:border-neutral-300 transition">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-600">
                  Step 02
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">
                  TDBK Services
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-5 shadow-xs">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-950 mb-1.5">SET IT UP</h3>
              <p className="text-xs font-semibold text-emerald-700 mb-3 uppercase tracking-wider">
                "Get it installed & configured."
              </p>
              <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                Nationwide on-site technician deployment, networking, staff onboarding, Lipa Na M-Pesa activation,
                and eTIMS tax fiscalization.
              </p>
            </div>
            <a
              href="#services-catalog"
              className="pt-3 border-t border-neutral-100 text-xs font-bold text-neutral-900 flex items-center justify-between group-hover:text-emerald-700"
            >
              <span>View Services</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </a>
          </div>

          {/* Step 3: Run Your Business */}
          <div className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-xs flex flex-col justify-between relative group hover:border-neutral-300 transition">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-600">
                  Step 03
                </span>
                <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-[11px] font-bold text-white">
                  Your DBK
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-neutral-950 text-white flex items-center justify-center mb-5 shadow-xs">
                <LayoutGridIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-950 mb-1.5">RUN YOUR BUSINESS</h3>
              <p className="text-xs font-semibold text-neutral-600 mb-3 uppercase tracking-wider">
                "Run it from your digital space."
              </p>
              <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                Unify cashiers, inventory records, student CBC evaluations, patient logs, or guest reservations into
                one responsive workspace.
              </p>
            </div>
            <button
              onClick={() => onBuildDigitalSpace && onBuildDigitalSpace()}
              className="pt-3 border-t border-neutral-100 text-xs font-bold text-neutral-900 flex items-center justify-between group-hover:text-neutral-950 text-left cursor-pointer"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </button>
          </div>

          {/* Step 4: Keep It Working */}
          <div className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-xs flex flex-col justify-between relative group hover:border-neutral-300 transition">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-600">
                  Step 04
                </span>
                <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-800">
                  Support & Renewals
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-neutral-800 text-white flex items-center justify-center mb-5 shadow-xs">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-950 mb-1.5">KEEP IT WORKING</h3>
              <p className="text-xs font-semibold text-neutral-600 mb-3 uppercase tracking-wider">
                "Keep growing."
              </p>
              <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                Dedicated local telephone/WhatsApp support, scheduled preventative checks, license renewals, and
                hardware warranty protection.
              </p>
            </div>
            <a
              href="#consultation-section"
              className="pt-3 border-t border-neutral-100 text-xs font-bold text-neutral-900 flex items-center justify-between group-hover:text-neutral-950"
            >
              <span>Talk to a Specialist</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </a>
          </div>
        </div>

        {/* Action Anchor Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#sale-catalog"
            className="px-5 py-2.5 rounded-xl bg-neutral-950 text-white text-xs font-semibold hover:bg-neutral-800 transition shadow-xs flex items-center space-x-2"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Shop Technology</span>
          </a>
          <a
            href="#services-catalog"
            className="px-5 py-2.5 rounded-xl bg-white text-neutral-800 border border-neutral-300 text-xs font-semibold hover:bg-neutral-50 transition shadow-xs flex items-center space-x-2"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Explore Services</span>
          </a>
          <button
            onClick={() => onBuildDigitalSpace && onBuildDigitalSpace()}
            className="px-5 py-2.5 rounded-xl bg-white text-neutral-800 border border-neutral-300 text-xs font-semibold hover:bg-neutral-50 transition shadow-xs flex items-center space-x-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Build My Digital Space</span>
          </button>
          <a
            href="#consultation-section"
            className="px-5 py-2.5 rounded-xl bg-white text-neutral-800 border border-neutral-300 text-xs font-semibold hover:bg-neutral-50 transition shadow-xs flex items-center space-x-2"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Talk to a Specialist</span>
          </a>
        </div>
      </section>

      {/* =========================================================================
          2. TDBK SALE — EXPANDED COMMERCIAL CATALOG
         ========================================================================= */}
      <section id="sale-catalog" className="scroll-mt-24 pt-8 border-t border-neutral-200">
        <div className="max-w-3xl mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-600 block mb-2">
            TDBK Sale
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-950 tracking-tight">
            Everything your business needs to go digital.
          </h2>
          <p className="mt-3 text-base text-neutral-600 leading-relaxed">
            Supply, procurement, and authentic licensing for Kenyan commerce. We supply certified physical business
            hardware, structured networking gear, security installations, and genuine software subscriptions.
          </p>
        </div>

        {/* Sale Category Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
          {[
            { id: 'ALL', label: 'All Catalog' },
            { id: 'HARDWARE', label: 'Business Hardware' },
            { id: 'NETWORKING', label: 'Networking & Connectivity' },
            { id: 'SECURITY', label: 'Security & Surveillance' },
            { id: 'POS', label: 'POS & Business Equipment' },
            { id: 'SOFTWARE', label: 'Software & Licences' },
            { id: 'DOMAINS', label: 'Domains & Web Presence' },
            { id: 'PACKAGES', label: 'Turnkey Packages' },
            { id: 'RENEWALS', label: 'Subscriptions & Renewals' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSaleCategory(tab.id as SaleCategory)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeSaleCategory === tab.id
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sale Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* A. Business Hardware */}
          {(activeSaleCategory === 'ALL' || activeSaleCategory === 'HARDWARE') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                  <Laptop className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Category A
                </div>
                <h3 className="text-lg font-bold text-neutral-950 mb-2">Business Hardware</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  High-performance computing workstations and purpose-built input displays configured for Kenyan work environments.
                </p>
                <ul className="space-y-2 text-xs text-neutral-700">
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Business Laptops & Desktop Workstations</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Touchscreen Cashier & Counter Terminals</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Rugged Handheld Field & Classroom Tablets</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Customer-Facing Secondary Price Displays</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Label & Barcode Thermal Printers</span>
                  </li>
                </ul>
              </div>
              <div className="pt-4 mt-6 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
                <span>Verified OEM Stock</span>
                <a href="#consultation-section" className="font-semibold text-neutral-900 hover:underline">
                  Inquire Specifications →
                </a>
              </div>
            </div>
          )}

          {/* B. Networking & Connectivity */}
          {(activeSaleCategory === 'ALL' || activeSaleCategory === 'NETWORKING') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                  <Wifi className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Category B
                </div>
                <h3 className="text-lg font-bold text-neutral-950 mb-2">Networking & Connectivity</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Dependable local network infrastructure engineered for fast transactions and seamless cloud synchronization.
                </p>
                <ul className="space-y-2 text-xs text-neutral-700">
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Dual-WAN Multi-Gigabit Commercial Routers</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>PoE Gigabit Switches (8, 16, 24 & 48 Ports)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Long-Range Wi-Fi 6 Access Points & Meshes</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Starlink Satellite Kits & High-Wind Mounts</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Multi-SIM 4G/5G Failover Modems</span>
                  </li>
                </ul>
              </div>
              <div className="pt-4 mt-6 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
                <span>Enterprise Grade</span>
                <a href="#consultation-section" className="font-semibold text-neutral-900 hover:underline">
                  Inquire Network Plan →
                </a>
              </div>
            </div>
          )}

          {/* C. Security & Surveillance */}
          {(activeSaleCategory === 'ALL' || activeSaleCategory === 'SECURITY') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Category C
                </div>
                <h3 className="text-lg font-bold text-neutral-950 mb-2">Security & Surveillance</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Commercial security monitoring, encrypted video archives, and smart access control for premises.
                </p>
                <ul className="space-y-2 text-xs text-neutral-700">
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>4K & Full HD Night-Vision IP CCTV Cameras</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Multi-Channel NVR & DVR Recording Hubs</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>High-Endurance Surveillance Storage (1TB - 12TB)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Biometric Staff Time Attendance & Access Doors</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Surveillance Network Isolators & Backup Power</span>
                  </li>
                </ul>
              </div>
              <div className="pt-4 mt-6 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
                <span>Encrypted Video</span>
                <a href="#consultation-section" className="font-semibold text-neutral-900 hover:underline">
                  Inquire CCTV Setup →
                </a>
              </div>
            </div>
          )}

          {/* D. POS & Business Equipment */}
          {(activeSaleCategory === 'ALL' || activeSaleCategory === 'POS') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Category D
                </div>
                <h3 className="text-lg font-bold text-neutral-950 mb-2">POS & Business Equipment</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Durable point-of-sale checkout gear built for fast checkout lines, stock scanning, and receipts.
                </p>
                <ul className="space-y-2 text-xs text-neutral-700">
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Turnkey POS Terminal Counter Kits</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Optical 1D / 2D QR Barcode Scanners</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Heavy-Duty Ball-Bearing Steel Cash Drawers</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Thermal Receipt Printers (80mm & 58mm Auto-Cut)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Electronic Weighing Scales with Label Printing</span>
                  </li>
                </ul>
              </div>
              <div className="pt-4 mt-6 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
                <span>Heavy Duty</span>
                <a href="#consultation-section" className="font-semibold text-neutral-900 hover:underline">
                  Inquire POS Kits →
                </a>
              </div>
            </div>
          )}

          {/* E. Software & Digital Licences */}
          {(activeSaleCategory === 'ALL' || activeSaleCategory === 'SOFTWARE') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                  <Key className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Category E
                </div>
                <h3 className="text-lg font-bold text-neutral-950 mb-2">Software & Licences</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Authentic corporate software licenses and productivity suites supplied compliant with vendor terms.
                </p>
                <ul className="space-y-2 text-xs text-neutral-700">
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Genuine Windows 11 Pro Commercial Licences</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Microsoft 365 Business Standard & Premium</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Google Workspace Enterprise & Business Plans</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Commercial Multi-Device Antivirus & Firewall</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Standard Business Accounting Software Packs</span>
                  </li>
                </ul>
              </div>
              <div className="pt-4 mt-6 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
                <span>Authentic Licences</span>
                <a href="#consultation-section" className="font-semibold text-neutral-900 hover:underline">
                  Request Volume Quote →
                </a>
              </div>
            </div>
          )}

          {/* F. Domains & Digital Presence */}
          {(activeSaleCategory === 'ALL' || activeSaleCategory === 'DOMAINS') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Category F
                </div>
                <h3 className="text-lg font-bold text-neutral-950 mb-2">Domains & Digital Presence</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Establish a credible corporate footprint with official Kenyan domain registries and high-speed web hosting.
                </p>
                <ul className="space-y-2 text-xs text-neutral-700">
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Official .co.ke, .sc.ke, .ke & Global Domain Registrations</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Enterprise SSL / TLS Security Certificates</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Ultra-Fast NVMe SSD Web Hosting Packages</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Branded Business Email Accounts (e.g. info@company.co.ke)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Clean Business Landing Page & Portal Setup</span>
                  </li>
                </ul>
              </div>
              <div className="pt-4 mt-6 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
                <span>Kenyan Domains</span>
                <a href="#consultation-section" className="font-semibold text-neutral-900 hover:underline">
                  Check Domain Availability →
                </a>
              </div>
            </div>
          )}

          {/* G. Turnkey Packages */}
          {(activeSaleCategory === 'ALL' || activeSaleCategory === 'PACKAGES') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                  <Boxes className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Category G
                </div>
                <h3 className="text-lg font-bold text-neutral-950 mb-2">Turnkey Technology Packages</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Bundled hardware, networking, and software packages optimized for specific business scales.
                </p>
                <ul className="space-y-2 text-xs text-neutral-700">
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>School Technology Kit (Admin PC + Wi-Fi + CBC)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Retail Counter POS Kit (Terminal + Scanner + Till)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Hardware Store Kit (Rugged POS + Bulk Scanner)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Clinic Technology Kit (Records Workstation + Wi-Fi)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Hospitality Kit (Front Desk + Dining POS + Starlink)</span>
                  </li>
                </ul>
              </div>
              <div className="pt-4 mt-6 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
                <span>All-in-One</span>
                <a href="#business-packages" className="font-semibold text-neutral-900 hover:underline">
                  View Detailed Packages →
                </a>
              </div>
            </div>
          )}

          {/* H. Subscriptions & Renewals */}
          {(activeSaleCategory === 'ALL' || activeSaleCategory === 'RENEWALS') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Category H
                </div>
                <h3 className="text-lg font-bold text-neutral-950 mb-2">Subscriptions & Renewals</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Hassle-free local renewal management for software, domains, hosting, and technical maintenance.
                </p>
                <ul className="space-y-2 text-xs text-neutral-700">
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Annual Microsoft 365 & Office Seat Renewals</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>KeNIC Domain Annual Retainers (.co.ke / .org.ke)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Managed Cloud Backup & Storage Renewals</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Endpoint Antivirus & Firewall Renewals</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                    <span>Quarterly & Annual Preventative Maintenance Plans</span>
                  </li>
                </ul>
              </div>
              <div className="pt-4 mt-6 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
                <span>Never Expire</span>
                <a href="#consultation-section" className="font-semibold text-neutral-900 hover:underline">
                  Manage Renewals →
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          3. TDBK SERVICES — REAL EXPANDED SERVICE CATALOG
         ========================================================================= */}
      <section id="services-catalog" className="scroll-mt-24 pt-8 border-t border-neutral-200">
        <div className="max-w-3xl mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 block mb-2">
            TDBK Services
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-950 tracking-tight">
            We make the technology work.
          </h2>
          <p className="mt-3 text-base text-neutral-600 leading-relaxed">
            Technology is only valuable when it runs smoothly in your daily workflow. TDBK provides expert technicians
            across Kenya who supply, install, configure, connect, train your staff, and support your operations.
          </p>
        </div>

        {/* Service Category Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
          {[
            { id: 'ALL', label: 'All Services' },
            { id: 'PRESENCE', label: 'Digital Presence' },
            { id: 'SYSTEMS', label: 'Business Systems' },
            { id: 'PAYMENTS', label: 'Payments & eTIMS' },
            { id: 'NETWORKING', label: 'Networking' },
            { id: 'SECURITY', label: 'Security & CCTV' },
            { id: 'CLOUD', label: 'Cloud & Software' },
            { id: 'TRAINING', label: 'Training & Setup' },
            { id: 'SUPPORT', label: 'Managed IT' },
            { id: 'GROWTH', label: 'SEO & Digital Growth' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveServiceCategory(tab.id as ServiceCategory)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeServiceCategory === tab.id
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* A. Digital Presence */}
          {(activeServiceCategory === 'ALL' || activeServiceCategory === 'PRESENCE') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Service 01
                </div>
                <h3 className="text-base font-bold text-neutral-950 mb-2">Digital Presence Setup</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Establish an authentic online identity that customers and suppliers trust.
                </p>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  <li>• Custom Corporate Websites</li>
                  <li>• Domain & DNS Configuration</li>
                  <li>• High-Security Web Hosting</li>
                  <li>• Professional Branded Email</li>
                  <li>• Google Business Profile Setup</li>
                </ul>
              </div>
              <a href="#consultation-section" className="pt-4 mt-4 border-t border-neutral-100 text-xs font-semibold text-emerald-700 hover:underline">
                Request Setup →
              </a>
            </div>
          )}

          {/* B. Business Systems */}
          {(activeServiceCategory === 'ALL' || activeServiceCategory === 'SYSTEMS') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Service 02
                </div>
                <h3 className="text-base font-bold text-neutral-950 mb-2">Business Systems Setup</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Tailored workflow engines configured around your specific industry practices.
                </p>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  <li>• Retail & Wholesale POS Deployment</li>
                  <li>• Multi-Branch Inventory Tracking</li>
                  <li>• School CBC Grading & Fee Portals</li>
                  <li>• Clinic Outpatient & Pharmacy Flow</li>
                  <li>• Hotel Front-Desk & Billing</li>
                </ul>
              </div>
              <a href="#consultation-section" className="pt-4 mt-4 border-t border-neutral-100 text-xs font-semibold text-emerald-700 hover:underline">
                Request Systems →
              </a>
            </div>
          )}

          {/* C. Payments & Compliance */}
          {(activeServiceCategory === 'ALL' || activeServiceCategory === 'PAYMENTS') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Service 03
                </div>
                <h3 className="text-base font-bold text-neutral-950 mb-2">Payments & eTIMS</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Direct financial synchronization with Kenyan mobile money and tax standards.
                </p>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  <li>• Lipa Na M-Pesa Till & Paybill Setup</li>
                  <li>• Automated Ledger Reconciliation</li>
                  <li>• KRA eTIMS Fiscalization Assistance</li>
                  <li>• Digital Invoicing & SMS Receipts</li>
                  <li>• Kenyan Banking Standard Alignment</li>
                </ul>
              </div>
              <a href="#consultation-section" className="pt-4 mt-4 border-t border-neutral-100 text-xs font-semibold text-emerald-700 hover:underline">
                Inquire Compliance →
              </a>
            </div>
          )}

          {/* D. Networking & Connectivity */}
          {(activeServiceCategory === 'ALL' || activeServiceCategory === 'NETWORKING') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <Wifi className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Service 04
                </div>
                <h3 className="text-base font-bold text-neutral-950 mb-2">Network Installation</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Professional structured cabling and reliable Wi-Fi coverage across premises.
                </p>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  <li>• Structured Cat6 & Trunking Cabling</li>
                  <li>• High-Speed Wi-Fi 6 Mesh Setup</li>
                  <li>• Starlink Satellite Dish Mounting</li>
                  <li>• Dual-ISP Failover Setup</li>
                  <li>• Multi-Store Remote VPN Links</li>
                </ul>
              </div>
              <a href="#consultation-section" className="pt-4 mt-4 border-t border-neutral-100 text-xs font-semibold text-emerald-700 hover:underline">
                Schedule Survey →
              </a>
            </div>
          )}

          {/* E. Security & Surveillance */}
          {(activeServiceCategory === 'ALL' || activeServiceCategory === 'SECURITY') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Service 05
                </div>
                <h3 className="text-base font-bold text-neutral-950 mb-2">CCTV & Surveillance</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Precision security camera installation with encrypted remote mobile monitoring.
                </p>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  <li>• Indoor & Outdoor IP Camera Mounting</li>
                  <li>• NVR Storage & Archive Configuration</li>
                  <li>• Mobile Remote Live Feed Access</li>
                  <li>• Biometric Door Access Control</li>
                  <li>• Perimeter Motion Alerts</li>
                </ul>
              </div>
              <a href="#consultation-section" className="pt-4 mt-4 border-t border-neutral-100 text-xs font-semibold text-emerald-700 hover:underline">
                Inquire Installation →
              </a>
            </div>
          )}

          {/* F. Software & Cloud */}
          {(activeServiceCategory === 'ALL' || activeServiceCategory === 'CLOUD') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <Cloud className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Service 06
                </div>
                <h3 className="text-base font-bold text-neutral-950 mb-2">Software & Cloud Setup</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Clean operating systems, corporate cloud migration, and automated backups.
                </p>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  <li>• Windows 11 Clean Business Setup</li>
                  <li>• Microsoft 365 & Outlook Migration</li>
                  <li>• Google Workspace Configuration</li>
                  <li>• Centralized Endpoint Antivirus</li>
                  <li>• Automated Daily Cloud Backups</li>
                </ul>
              </div>
              <a href="#consultation-section" className="pt-4 mt-4 border-t border-neutral-100 text-xs font-semibold text-emerald-700 hover:underline">
                Plan Migration →
              </a>
            </div>
          )}

          {/* G. Implementation & Training */}
          {(activeServiceCategory === 'ALL' || activeServiceCategory === 'TRAINING') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Service 07
                </div>
                <h3 className="text-base font-bold text-neutral-950 mb-2">Implementation & Training</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Empowering your team with patient hands-on coaching and historical data import.
                </p>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  <li>• On-Site Technician Staff Coaching</li>
                  <li>• Cashier & Storekeeper Training</li>
                  <li>• Legacy Excel & Paper Data Migration</li>
                  <li>• Departmental Workflow Mapping</li>
                  <li>• Role-Based Access Configuration</li>
                </ul>
              </div>
              <a href="#consultation-section" className="pt-4 mt-4 border-t border-neutral-100 text-xs font-semibold text-emerald-700 hover:underline">
                Schedule Training →
              </a>
            </div>
          )}

          {/* I. SEO & Digital Growth */}
          {(activeServiceCategory === 'ALL' || activeServiceCategory === 'GROWTH') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Service 09
                </div>
                <h3 className="text-base font-bold text-neutral-950 mb-2">SEO & Digital Growth</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Improve how customers discover your business in Google Search and local results with a measurable technical and content foundation.
                </p>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  <li>• Technical SEO Audit & Site Health</li>
                  <li>• On-Page SEO, Titles & Meta Descriptions</li>
                  <li>• Google Search Console & Indexing Setup</li>
                  <li>• Local SEO & Google Business Profile Optimization</li>
                  <li>• Sitemap, Structured Data & Core Web Vitals Review</li>
                </ul>
                <div className="mt-4 pt-3 border-t border-neutral-100 text-[11px] text-neutral-500">
                  <span className="font-semibold text-neutral-700">Assigned:</span> SEO & Digital Growth Engineer
                </div>
              </div>
              <a href="#consultation-section" className="pt-4 mt-4 border-t border-neutral-100 text-xs font-semibold text-emerald-700 hover:underline">
                Request SEO Audit →
              </a>
            </div>
          )}

          {/* H. Support & Managed IT */}
          {(activeServiceCategory === 'ALL' || activeServiceCategory === 'SUPPORT') && (
            <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <Headphones className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                  Service 08
                </div>
                <h3 className="text-base font-bold text-neutral-950 mb-2">Support & Managed IT</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  Continuous local technical peace of mind so your business never stops running.
                </p>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  <li>• Dedicated WhatsApp & Phone Desk</li>
                  <li>• Fast Secure Remote Desktop Help</li>
                  <li>• Scheduled Preventative Site Visits</li>
                  <li>• Hardware Warranty & Swap Support</li>
                  <li>• Managed System Health Monitoring</li>
                </ul>
              </div>
              <a href="#consultation-section" className="pt-4 mt-4 border-t border-neutral-100 text-xs font-semibold text-emerald-700 hover:underline">
                Get Support →
              </a>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          4. BUSINESS-SPECIFIC INDUSTRY PACKAGES
         ========================================================================= */}
      <section id="business-packages" className="scroll-mt-24 pt-8 border-t border-neutral-200">
        <div className="max-w-3xl mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-600 block mb-2">
            Tailored Industry Solutions
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-950 tracking-tight">
            Integrated technology packages for Kenya's core sectors.
          </h2>
          <p className="mt-3 text-base text-neutral-600 leading-relaxed">
            See how TDBK Sale hardware, professional TDBK Services, and your DBK workspace combine into a unified operational package.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. Schools */}
          <div className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-xs flex flex-col justify-between group hover:border-neutral-300 transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Education Package
              </div>
              <h3 className="text-xl font-bold text-neutral-950 mb-2">Schools & Academies</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-5">
                CBC student records, automated fee reminders, and campus connectivity for primary, junior, and senior secondary schools.
              </p>
              <div className="space-y-2 text-xs text-neutral-700 pb-4 mb-4 border-b border-neutral-100">
                <div className="font-semibold text-neutral-900">Recommended Bundle:</div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Admin Workstations + Staff Room Wi-Fi</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>CBC Grade Tracker + Attendance Tablets</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Lipa Na M-Pesa Fee Sync + Teacher Onboarding</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => onSelectSector && onSelectSector('EDUCATION')}
                className="text-xs px-3.5 py-2 rounded-xl bg-neutral-950 text-white font-semibold hover:bg-neutral-800 transition cursor-pointer"
              >
                Choose School Space
              </button>
              <a href="#consultation-section" className="text-xs font-semibold text-neutral-600 hover:text-neutral-950">
                Inquire Kit →
              </a>
            </div>
          </div>

          {/* 2. Retail */}
          <div className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-xs flex flex-col justify-between group hover:border-neutral-300 transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Retail Package
              </div>
              <h3 className="text-xl font-bold text-neutral-950 mb-2">Retail & Supermarkets</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-5">
                Fast checkout, stock control, and eTIMS-ready receipts for supermarkets, grocery stores, pharmacies, and boutiques.
              </p>
              <div className="space-y-2 text-xs text-neutral-700 pb-4 mb-4 border-b border-neutral-100">
                <div className="font-semibold text-neutral-900">Recommended Bundle:</div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Touchscreen POS + Thermal Receipt Printer</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Optical Barcode Scanner + Cash Drawer</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Lipa Na M-Pesa Setup + eTIMS Compliance</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => onSelectSector && onSelectSector('RETAIL')}
                className="text-xs px-3.5 py-2 rounded-xl bg-neutral-950 text-white font-semibold hover:bg-neutral-800 transition cursor-pointer"
              >
                Choose Retail Space
              </button>
              <a href="#consultation-section" className="text-xs font-semibold text-neutral-600 hover:text-neutral-950">
                Inquire Kit →
              </a>
            </div>
          </div>

          {/* 3. Hardware & Wholesale */}
          <div className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-xs flex flex-col justify-between group hover:border-neutral-300 transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                <Store className="w-5 h-5" />
              </div>
              <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Wholesale Package
              </div>
              <h3 className="text-xl font-bold text-neutral-950 mb-2">Hardware & Commerce</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-5">
                Bulk inventory, multi-tier pricing, trade credit ledgers, and delivery dispatches for distributors and hardware stores.
              </p>
              <div className="space-y-2 text-xs text-neutral-700 pb-4 mb-4 border-b border-neutral-100">
                <div className="font-semibold text-neutral-900">Recommended Bundle:</div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Industrial Heavy-Duty POS + Long-Range Scanner</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Warehouse Wi-Fi Mesh + Multi-Till Networking</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Credit Ledger + KRA eTIMS Tax Validation</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => onSelectSector && onSelectSector('COMMERCE')}
                className="text-xs px-3.5 py-2 rounded-xl bg-neutral-950 text-white font-semibold hover:bg-neutral-800 transition cursor-pointer"
              >
                Choose Hardware Space
              </button>
              <a href="#consultation-section" className="text-xs font-semibold text-neutral-600 hover:text-neutral-950">
                Inquire Kit →
              </a>
            </div>
          </div>

          {/* 4. Healthcare */}
          <div className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-xs flex flex-col justify-between group hover:border-neutral-300 transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Healthcare Package
              </div>
              <h3 className="text-xl font-bold text-neutral-950 mb-2">Hospitals & Clinics</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-5">
                Patient outpatient records, pharmacy expiry tracking, triage logs, and consultation flow for private medical centres.
              </p>
              <div className="space-y-2 text-xs text-neutral-700 pb-4 mb-4 border-b border-neutral-100">
                <div className="font-semibold text-neutral-900">Recommended Bundle:</div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Reception Workstation + Secure Clinical Network</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Pharmacy Barcode Scanner + Prescription Receipts</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Encrypted Daily Cloud Backup + Staff Privacy Setup</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => onSelectSector && onSelectSector('HEALTHCARE')}
                className="text-xs px-3.5 py-2 rounded-xl bg-neutral-950 text-white font-semibold hover:bg-neutral-800 transition cursor-pointer"
              >
                Choose Clinic Space
              </button>
              <a href="#consultation-section" className="text-xs font-semibold text-neutral-600 hover:text-neutral-950">
                Inquire Kit →
              </a>
            </div>
          </div>

          {/* 5. Hospitality */}
          <div className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-xs flex flex-col justify-between group hover:border-neutral-300 transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                <Hotel className="w-5 h-5" />
              </div>
              <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Hospitality Package
              </div>
              <h3 className="text-xl font-bold text-neutral-950 mb-2">Hotels & Lodges</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-5">
                Front-desk guest check-in, dining POS order dispatch, guest billing, and remote connectivity for urban hotels and safari camps.
              </p>
              <div className="space-y-2 text-xs text-neutral-700 pb-4 mb-4 border-b border-neutral-100">
                <div className="font-semibold text-neutral-900">Recommended Bundle:</div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Front Desk Workstation + Restaurant Kitchen POS</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Starlink Remote Connectivity + Guest Wi-Fi Mesh</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Room Bill Consolidation + M-Pesa Reception Till</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => onSelectSector && onSelectSector('HOSPITALITY')}
                className="text-xs px-3.5 py-2 rounded-xl bg-neutral-950 text-white font-semibold hover:bg-neutral-800 transition cursor-pointer"
              >
                Choose Lodge Space
              </button>
              <a href="#consultation-section" className="text-xs font-semibold text-neutral-600 hover:text-neutral-950">
                Inquire Kit →
              </a>
            </div>
          </div>

          {/* 6. Organisations */}
          <div className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-xs flex flex-col justify-between group hover:border-neutral-300 transition">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Corporate & NGO Package
              </div>
              <h3 className="text-xl font-bold text-neutral-950 mb-2">Organisations & Trusts</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-5">
                Staff workstations, cloud file collaboration, grant tracking, and secure multi-branch access for institutions and NGOs.
              </p>
              <div className="space-y-2 text-xs text-neutral-700 pb-4 mb-4 border-b border-neutral-100">
                <div className="font-semibold text-neutral-900">Recommended Bundle:</div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Business Laptops + Microsoft 365 / Workspace</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Structured Office Network + Secure VPN Gateway</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  <span>Document Registry + Managed IT Support Retainer</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => onSelectSector && onSelectSector('GOVERNMENT')}
                className="text-xs px-3.5 py-2 rounded-xl bg-neutral-950 text-white font-semibold hover:bg-neutral-800 transition cursor-pointer"
              >
                Choose Org Space
              </button>
              <a href="#consultation-section" className="text-xs font-semibold text-neutral-600 hover:text-neutral-950">
                Inquire Kit →
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-neutral-600">
          Illustrative sector packages. Equipment combinations can be customized to match your exact branch requirements.
        </div>
      </section>

      {/* =========================================================================
          5. TDBK QUOTE BUILDER
         ========================================================================= */}
      <section id="quote-builder" className="scroll-mt-24 pt-8">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="max-w-3xl mb-8">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 block mb-2">TDBK Quote Engine</span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-950 tracking-tight">Quote any service.</h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-600 leading-relaxed">Select a service, quantity and delivery costs. The quote engine calculates a transparent estimate before a formal quotation is issued.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-neutral-700">Service
                <select value={quoteService} onChange={(e) => setQuoteService(e.target.value)} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm">
                  {quoteServices.map((s) => <option key={s.name}>{s.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-neutral-700">Scope
                <select value={quoteScope} onChange={(e) => setQuoteScope(e.target.value)} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm">
                  <option>Audit</option><option>Setup</option><option>Implementation</option><option>Maintenance</option><option>Full Project</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-neutral-700">Quantity
                <input type="number" min="1" max="1000" step="1" inputMode="numeric" aria-label="Quote quantity" value={quoteQuantity} onChange={(e) => setQuoteQuantity(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">Labour (KSh)
                <input type="number" min="0" max="10000000" step="1" inputMode="numeric" aria-label="Labour cost in Kenyan shillings" value={quoteLabour} onChange={(e) => setQuoteLabour(Math.min(10000000, Math.max(0, Number(e.target.value) || 0)))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </label>
              <label className="text-xs font-semibold text-neutral-700">Materials / extras (KSh)
                <input type="number" min="0" max="10000000" step="1" inputMode="numeric" aria-label="Materials and extras cost in Kenyan shillings" value={quoteMaterials} onChange={(e) => setQuoteMaterials(Math.min(10000000, Math.max(0, Number(e.target.value) || 0)))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 sm:col-span-2" />
              </label>
            </div>
            <div className="lg:col-span-5 rounded-2xl bg-neutral-950 text-white p-6">
              <div className="text-xs uppercase tracking-widest text-neutral-400 mb-3">Estimate</div>
              <div className="text-sm text-neutral-300">{selectedQuoteService.name} • {quoteScope}</div>
              <div className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between"><span>Service</span><span>KSh {selectedQuoteService.base.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Quantity</span><span>{quoteQuantity}</span></div>
                <div className="flex justify-between"><span>Labour</span><span>KSh {quoteLabour.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Materials / extras</span><span>KSh {quoteMaterials.toLocaleString()}</span></div>
                <div className="border-t border-neutral-800 pt-3 mt-3 flex justify-between text-neutral-300"><span>Subtotal</span><span>KSh {quoteSubtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-neutral-400"><span>VAT estimate</span><span>KSh {quoteVat.toLocaleString()}</span></div>
              </div>
              <div className="border-t border-neutral-700 mt-4 pt-4 flex justify-between items-end"><span className="font-semibold">Estimated total</span><span className="text-2xl font-bold">KSh {quoteTotal.toLocaleString()}</span></div>
              <a href="#consultation-section" className="mt-5 w-full inline-flex justify-center rounded-xl bg-white text-neutral-950 py-3 text-sm font-bold hover:bg-neutral-100 transition">Request Formal Quote →</a>
            </div>
          </div>
          <p className="mt-5 text-[11px] text-neutral-500">Prices are configurable estimates, not a final tax invoice. Licensing, equipment, travel and project-specific scope are confirmed before formal quotation.</p>
        </div>
      </section>

      {/* =========================================================================
          5. ENHANCED CONSULTATION CARD
         ========================================================================= */}
      <section id="consultation-section" className="scroll-mt-24 pt-8">
        <div className="bg-neutral-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-neutral-800 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-neutral-900 text-xs font-mono text-emerald-400 mb-6 border border-neutral-800">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Specialist Advisory Services</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight mb-4 text-white">
                Not sure what your business needs?
              </h2>
              <p className="text-base text-neutral-300 leading-relaxed mb-6">
                Tell us about your business and we'll help you plan the technology, digital services, and DBK workspace that fit your operations, team size, and budget.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-neutral-400 mb-6">
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Expert hardware sizing without excess cost</span>
                </div>
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Direct Lipa Na M-Pesa & eTIMS advice</span>
                </div>
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Coverage in all 47 counties across Kenya</span>
                </div>
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Transparent quotations & genuine licensing</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-neutral-900 rounded-2xl p-6 sm:p-7 border border-neutral-800">
              {consultationSuccess ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Request Received</h3>
                  <p className="text-xs text-neutral-300 leading-relaxed mb-6">
                    A TDBK technology specialist will contact you shortly via call or WhatsApp at <span className="text-white font-mono font-bold">{consultationPhone}</span> to review your requirements.
                  </p>
                  <button
                    onClick={() => {
                      setConsultationSuccess(false);
                      setConsultationPhone('');
                      setConsultationName('');
                      setConsultationNotes('');
                    }}
                    className="px-4 py-2 rounded-xl bg-neutral-800 text-white text-xs font-semibold hover:bg-neutral-700 transition cursor-pointer"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleConsultationSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                      Business / Institution Name
                    </label>
                    <input
                      type="text"
                      value={consultationName}
                      onChange={(e) => setConsultationName(e.target.value)}
                      placeholder="e.g. Eldoret Crest Academy or Nairobi Star Hardware"
                      className="w-full px-4 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                      Phone / M-Pesa Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={consultationPhone}
                      onChange={(e) => setConsultationPhone(e.target.value)}
                      placeholder="e.g. 0712 345 678 or +254 7..."
                      className="w-full px-4 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                      Industry Sector
                    </label>
                    <select
                      value={consultationSector}
                      onChange={(e) => setConsultationSector(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-white focus:outline-none focus:border-neutral-300 cursor-pointer"
                    >
                      <option value="Schools & Academies">Schools & Academies</option>
                      <option value="Retail & Shops">Retail & Supermarkets</option>
                      <option value="Hardware & Wholesale">Hardware & Wholesale Commerce</option>
                      <option value="Healthcare & Clinics">Healthcare & Clinics</option>
                      <option value="Hotels & Lodges">Hotels, Lodges & Hospitality</option>
                      <option value="Organisations & Trusts">Organisations & Trusts</option>
                      <option value="Other Enterprise">Other Enterprise</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                      Notes / What do you need? (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={consultationNotes}
                      onChange={(e) => setConsultationNotes(e.target.value)}
                      placeholder="e.g. 2 counter tills, receipt printer, and M-Pesa setup in Nakuru"
                      className="w-full px-4 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-300 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-white text-neutral-950 font-bold text-sm hover:bg-neutral-100 transition shadow-sm cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>Schedule Consultation</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. PUBLIC TRUST / DISCLAIMERS
         ========================================================================= */}
      <section className="pt-2">
        <div className="bg-neutral-100/80 rounded-2xl p-6 border border-neutral-200/80">
          <div className="flex items-start space-x-3">
            <Info className="w-4 h-4 text-neutral-600 mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs text-neutral-600 leading-relaxed">
              <div className="font-bold text-neutral-800 uppercase tracking-wider text-[11px]">
                Product & Service Notices
              </div>
              <p>
                Availability may vary based on market supply and distributor inventory. Product brands and specifications may vary while meeting or exceeding indicated performance benchmarks.
              </p>
              <p>
                Licensed software is supplied subject to applicable vendor licensing terms. Service coverage, on-site deployment, and scheduling depend on physical county location and project scope.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

// Helper internal icon component for Step 3
function LayoutGridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

export default CommercialBridge;
