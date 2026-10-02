import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  ShoppingBag,
  Wrench,
  Stethoscope,
  Hotel,
  Building2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Users,
  CreditCard,
  TrendingUp,
  Sparkles,
  Package,
  Calendar,
  FileText,
  Activity,
  Compass,
  Menu,
  X,
  LogIn,
  LayoutDashboard,
} from 'lucide-react';
import { CommercialBridge } from './CommercialBridge';

export type BusinessSector =
  | 'EDUCATION'
  | 'RETAIL'
  | 'COMMERCE'
  | 'HEALTHCARE'
  | 'HOSPITALITY'
  | 'GOVERNMENT';

export interface PublicGatewayProps {
  onSelectSector?: (sector: BusinessSector) => void;
  onSignIn?: () => void;
}

interface WorkspaceShowcaseItem {
  id: string;
  categoryTitle: string;
  sector: BusinessSector;
  businessName: string;
  workspaceType: string;
  badge: string;
  metrics: Array<{
    label: string;
    value: string;
    change: string;
    isPositive: boolean;
    icon: React.ElementType;
  }>;
  navItems: string[];
  activityTitle: string;
  activities: Array<{
    title: string;
    detail: string;
    time: string;
    status: 'COMPLETED' | 'PENDING' | 'ACTIVE';
  }>;
}

const SHOWCASE_DATA: WorkspaceShowcaseItem[] = [
  {
    id: 'schools',
    categoryTitle: 'Schools & Academies',
    sector: 'EDUCATION',
    businessName: 'Premier Academy',
    workspaceType: 'School Workspace',
    badge: 'CBC Curriculum Ready',
    metrics: [
      { label: 'Students', value: '1,248', change: '+34 this term', isPositive: true, icon: Users },
      { label: 'Attendance', value: '96.8%', change: 'Daily average', isPositive: true, icon: CheckCircle2 },
      { label: 'Fees', value: 'KSh 4.8M', change: '89% collected', isPositive: true, icon: CreditCard },
      { label: 'Staff', value: '62', change: 'All departments', isPositive: true, icon: GraduationCap },
    ],
    navItems: ['Dashboard', 'Students', 'Attendance', 'Finance', 'Reports'],
    activityTitle: 'Recent activity',
    activities: [
      { title: 'Grade 5 CBC Assessment scores published', detail: 'Mathematics & Science strands', time: '12m ago', status: 'COMPLETED' },
      { title: 'Term 2 Fee receipt generated via M-Pesa', detail: 'Receipt #RCP-88412 • KSh 45,000', time: '45m ago', status: 'COMPLETED' },
      { title: 'Parent communication broadcast sent', detail: 'Academic open day schedule (1,180 parents)', time: '2h ago', status: 'ACTIVE' },
    ],
  },
  {
    id: 'retail',
    categoryTitle: 'Retail & Shops',
    sector: 'RETAIL',
    businessName: 'Nairobi Fresh Mart',
    workspaceType: 'Retail Workspace',
    badge: 'Fast Checkout & POS',
    metrics: [
      { label: "Today's Sales", value: 'KSh 184,500', change: '+18% vs yesterday', isPositive: true, icon: TrendingUp },
      { label: 'Products', value: '3,420', change: '98% in stock', isPositive: true, icon: Package },
      { label: 'Customers', value: '412', change: 'Served today', isPositive: true, icon: Users },
      { label: 'Orders', value: '188', change: 'Completed at till', isPositive: true, icon: ShoppingBag },
    ],
    navItems: ['POS', 'M-Pesa', 'eTIMS', 'Inventory', 'Customers', 'Reports'],
    activityTitle: 'Recent sales',
    activities: [
      { title: 'Till #02 • Lipa Na M-Pesa transaction confirmed', detail: 'Trans ID: QK88102A • KSh 3,450', time: '3m ago', status: 'COMPLETED' },
      { title: 'Automated low stock notification', detail: 'Cooking Oil 2L (8 units remaining)', time: '28m ago', status: 'PENDING' },
      { title: 'Supplier delivery verified & added to stock', detail: 'Invoice #SUP-4491 • 120 items', time: '1h ago', status: 'COMPLETED' },
    ],
  },
  {
    id: 'hardware',
    categoryTitle: 'Hardware & Commerce',
    sector: 'COMMERCE',
    businessName: 'Mombasa Hardware',
    workspaceType: 'Business Workspace',
    badge: 'POS + Payments + Inventory',
    metrics: [
      { label: "Today's Sales", value: 'KSh 542,000', change: '+12% weekly pace', isPositive: true, icon: TrendingUp },
      { label: 'Stock Items', value: '8,950', change: 'Across 3 depots', isPositive: true, icon: Package },
      { label: 'Customers', value: '230', change: 'Wholesale & walk-in', isPositive: true, icon: Users },
      { label: 'Suppliers', value: '48', change: 'Active contracts', isPositive: true, icon: Wrench },
    ],
    navItems: ['POS', 'M-Pesa', 'eTIMS', 'Inventory', 'Customers', 'Reports'],
    activityTitle: 'Recent sales',
    activities: [
      { title: 'Wholesale order invoiced to Bamburi Contractors', detail: '500 Bags Simba Cement • KSh 380,000', time: '8m ago', status: 'COMPLETED' },
      { title: 'eTIMS electronic tax receipt validated', detail: 'Invoice #ETIMS-99201 confirmed', time: '35m ago', status: 'COMPLETED' },
      { title: 'Supplier payment approved via Bank Transfer', detail: 'Crown Paints Kenya • KSh 145,000', time: '3h ago', status: 'ACTIVE' },
    ],
  },
  {
    id: 'healthcare',
    categoryTitle: 'Healthcare',
    sector: 'HEALTHCARE',
    businessName: 'Kilimani Medical Centre',
    workspaceType: 'Healthcare Workspace',
    badge: 'Patient Privacy Assured',
    metrics: [
      { label: 'Patients', value: '142', change: 'Registered today', isPositive: true, icon: Users },
      { label: 'Appointments', value: '38', change: '8 remaining', isPositive: true, icon: Calendar },
      { label: 'Records', value: '12,400', change: 'Secure digital files', isPositive: true, icon: FileText },
      { label: 'Billing', value: 'KSh 320,000', change: 'SHA & Cash verified', isPositive: true, icon: CreditCard },
    ],
    navItems: ['Dashboard', 'Patients', 'Appointments', 'Records', 'Billing'],
    activityTitle: 'Recent activity',
    activities: [
      { title: 'Doctor consultation completed • Dr. Ochieng', detail: 'Prescription & lab requisition generated', time: '5m ago', status: 'COMPLETED' },
      { title: 'Digital lab results attached to patient record', detail: 'Lipid profile & full hemogram', time: '22m ago', status: 'COMPLETED' },
      { title: 'Social Health Authority (SHA) claim submitted', detail: 'Pre-authorization #SHA-77291 approved', time: '1h ago', status: 'ACTIVE' },
    ],
  },
  {
    id: 'hospitality',
    categoryTitle: 'Hospitality',
    sector: 'HOSPITALITY',
    businessName: 'Mara Haven Lodge',
    workspaceType: 'Hospitality Workspace',
    badge: 'Guest Front Desk',
    metrics: [
      { label: 'Reservations', value: '64', change: '94% occupancy rate', isPositive: true, icon: Calendar },
      { label: 'Rooms', value: '42', change: '38 rooms occupied', isPositive: true, icon: Hotel },
      { label: 'Guests', value: '98', change: 'Resident & international', isPositive: true, icon: Users },
      { label: 'Payments', value: 'KSh 890,000', change: 'Booking folio balanced', isPositive: true, icon: CreditCard },
    ],
    navItems: ['Dashboard', 'Reservations', 'Rooms', 'Guests', 'Payments'],
    activityTitle: 'Recent activity',
    activities: [
      { title: 'Villa 14 check-in confirmed • Mr. & Mrs. Vance', detail: 'Airport transfer & safari game drive registered', time: '14m ago', status: 'COMPLETED' },
      { title: 'Restaurant folio charge posted to Room 08', detail: 'Dinner service • KSh 8,400', time: '50m ago', status: 'COMPLETED' },
      { title: 'Housekeeping status updated to Inspected', detail: 'Rooms 21 through 26 ready for arrival', time: '2h ago', status: 'ACTIVE' },
    ],
  },
  {
    id: 'organisations',
    categoryTitle: 'Organisations',
    sector: 'GOVERNMENT',
    businessName: 'Kenya Community Trust',
    workspaceType: 'Organisation Workspace',
    badge: 'Multi-Project Oversight',
    metrics: [
      { label: 'People', value: '480', change: 'Active members & staff', isPositive: true, icon: Users },
      { label: 'Projects', value: '16', change: 'Across 6 counties', isPositive: true, icon: Compass },
      { label: 'Tasks', value: '124', change: '92% on schedule', isPositive: true, icon: CheckCircle2 },
      { label: 'Reports', value: '48', change: 'Audited & published', isPositive: true, icon: FileText },
    ],
    navItems: ['Dashboard', 'People', 'Projects', 'Tasks', 'Reports'],
    activityTitle: 'Recent activity',
    activities: [
      { title: 'Quarterly Community Impact Audit filed', detail: 'Clean energy borehole initiative in Kilifi', time: '18m ago', status: 'COMPLETED' },
      { title: 'Grant milestone disbursement logged', detail: 'Treasury voucher #TR-2026-904', time: '1h ago', status: 'COMPLETED' },
      { title: 'Board governance minutes circulated for review', detail: 'Digital acknowledgement requested', time: '4h ago', status: 'ACTIVE' },
    ],
  },
];

export function PublicGateway({ onSelectSector, onSignIn }: PublicGatewayProps) {
  // Carousel State
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [journeyStep, setJourneyStep] = useState(0);
  const [journeyPaused, setJourneyPaused] = useState(false);

  useEffect(() => {
    if (journeyPaused) return;
    const timer = window.setInterval(() => {
      setJourneyStep((prev) => (prev + 1) % 4);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [journeyPaused]);


  const carouselRef = useRef<HTMLDivElement>(null);

  const activeShowcase = SHOWCASE_DATA[activeSlideIndex];

  const handleNext = useCallback(() => {
    setActiveSlideIndex((prev) => (prev + 1) % SHOWCASE_DATA.length);
  }, []);

  const handlePrev = useCallback(() => {
    setActiveSlideIndex((prev) => (prev - 1 + SHOWCASE_DATA.length) % SHOWCASE_DATA.length);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only react if the carousel container or element has focus or user is scrolling
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    const minSwipeDistance = 45;

    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }
  };

  const handleCreateSpace = (sector: BusinessSector) => {
    onSelectSector?.(sector);
  };

  const handleSelectBusinessCard = (sector: BusinessSector) => {
    const targetIndex = SHOWCASE_DATA.findIndex((item) => item.sector === sector);
    if (targetIndex !== -1) {
      setActiveSlideIndex(targetIndex);
    }
    const showcaseSection = document.getElementById('digital-space-showcase');
    if (showcaseSection) {
      showcaseSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white antialiased">
      {/* 1. PUBLIC HEADER / TOP NAVIGATION */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-serif font-bold text-lg shadow-sm">
              T
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif font-bold text-lg text-neutral-950 tracking-tight">
                  Thuram Digital Bridge Kenya
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-bold border border-neutral-200">
                  DBK V2
                </span>
              </div>
              <p className="text-xs text-neutral-600 hidden sm:block">
                Digital Business Kit for Kenyan Enterprises & Institutions
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-neutral-600">
            <a href="#overview" className="hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 rounded-md px-1 transition">Overview</a>
            <a href="#business-spaces" className="hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 rounded-md px-1 transition">Your Space</a>
            <a href="#digital-space-showcase" className="hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 rounded-md px-1 transition">Workspace Showcase</a>
            <a href="#how-it-works" className="hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 rounded-md px-1 transition">How It Works</a>
            <a href="#services" className="hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 rounded-md px-1 transition">Sale & Services</a>
            <a href="#gazette" className="hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 rounded-md px-1 transition">Gazette</a>
          </nav>

          <div className="hidden md:flex items-center space-x-3">
            {onSignIn ? (
              <button
                onClick={onSignIn}
                aria-label="Sign in to your account"
                className="px-4 py-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 rounded-xl transition cursor-pointer"
              >
                Sign In
              </button>
            ) : null}
            <button
              onClick={() => handleCreateSpace('EDUCATION')}
              aria-label="Get Started with DBK"
              className="px-5 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-950 transition shadow-sm flex items-center space-x-2 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden items-center space-x-2">
            {onSignIn && (
              <button
                onClick={onSignIn}
                aria-label="Sign In"
                className="px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-950 rounded-lg cursor-pointer"
              >
                Sign In
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="p-2 rounded-xl text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 transition focus:outline-none focus:ring-2 focus:ring-neutral-950 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-neutral-200 px-4 pt-3 pb-6 space-y-3 shadow-lg">
            <nav className="flex flex-col space-y-1 text-sm font-medium text-neutral-700">
              <a
                href="#overview"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl hover:bg-neutral-50 hover:text-neutral-950 transition"
              >
                Overview
              </a>
              <a
                href="#business-spaces"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl hover:bg-neutral-50 hover:text-neutral-950 transition"
              >
                Your Space
              </a>
              <a
                href="#digital-space-showcase"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl hover:bg-neutral-50 hover:text-neutral-950 transition"
              >
                Workspace Showcase
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl hover:bg-neutral-50 hover:text-neutral-950 transition"
              >
                How It Works
              </a>
              <a
                href="#services"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl hover:bg-neutral-50 hover:text-neutral-950 transition"
              >
                Sale & Services
              </a>
              <a
                href="#gazette"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl hover:bg-neutral-50 hover:text-neutral-950 transition"
              >
                Gazette
              </a>
            </nav>
            <div className="pt-3 border-t border-neutral-100 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleCreateSpace('EDUCATION');
                }}
                className="w-full py-3 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* 2. HERO SECTION — TDBK JOURNEY SHOWCASE */}
        <section id="overview" className="pt-12 pb-16 md:pt-20 md:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-800 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
                <span>Digital Business Spaces</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-neutral-950 tracking-tight leading-[1.08] mb-6">
                See how your business travels through TDBK.
              </h1>
              <p className="text-lg sm:text-xl text-neutral-600 leading-relaxed max-w-xl mb-8">
                From discovering a School DBK to signing in and arriving inside the operational workspace,
                TDBK turns the customer journey into one connected digital space.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleCreateSpace('EDUCATION')}
                  className="px-6 py-3.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Create a DBK</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#business-spaces"
                  className="px-6 py-3.5 rounded-xl bg-white text-neutral-800 border border-neutral-300 text-sm font-semibold hover:bg-neutral-50 transition flex items-center justify-center"
                >
                  Explore spaces
                </a>
              </div>
            </div>

            {/* The journey stays inside ONE card and travels left → right. */}
            <div
              className="relative rounded-[28px] bg-neutral-950 p-2 sm:p-3 shadow-2xl border border-neutral-800 overflow-hidden"
              onMouseEnter={() => setJourneyPaused(true)}
              onMouseLeave={() => setJourneyPaused(false)}
              onFocus={() => setJourneyPaused(true)}
              onBlur={() => setJourneyPaused(false)}
            >
              <div className="rounded-[22px] overflow-hidden bg-[#F7F8F6] border border-neutral-800">
                <div className="px-4 sm:px-6 py-3.5 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-neutral-700" />
                      <span className="w-2 h-2 rounded-full bg-neutral-700" />
                      <span className="w-2 h-2 rounded-full bg-neutral-700" />
                    </div>
                    <div className="h-4 w-px bg-neutral-700" />
                    <div>
                      <div className="text-xs font-bold tracking-tight">TDBK / School</div>
                      <div className="text-[10px] text-neutral-400">Illustrative customer journey</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                    Step {journeyStep + 1} / 4
                  </span>
                </div>

                <div className="overflow-hidden">
                  <div
                    className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ transform: `translateX(-${journeyStep * 100}%)` }}
                  >
                    {[
                      {
                        label: '01 / DISCOVER',
                        title: 'School DBK',
                        subtitle: 'Start with the space, not the software.',
                        icon: GraduationCap,
                        body: 'Premier Academy',
                        detail: 'CBC • Students • Fees • Attendance',
                      },
                      {
                        label: '02 / SIGN IN',
                        title: 'Welcome back',
                        subtitle: 'Identity opens the right business environment.',
                        icon: LogIn,
                        body: 'School Administrator',
                        detail: 'Secure account access • TDBK identity',
                      },
                      {
                        label: '03 / SELECT',
                        title: 'Your Businesses',
                        subtitle: 'One operator can manage multiple DBKs.',
                        icon: Building2,
                        body: 'Premier Academy',
                        detail: 'School DBK • 6 capabilities active',
                      },
                      {
                        label: '04 / WORKSPACE',
                        title: 'School Workspace',
                        subtitle: 'Arrive where the real work happens.',
                        icon: LayoutDashboard,
                        body: 'Premier Academy',
                        detail: 'Students • CBC • Fees • Attendance • M-Pesa',
                      },
                    ].map((step) => {
                      const StepIcon = step.icon;
                      return (
                        <div key={step.label} className="min-w-full p-5 sm:p-7 md:p-8">
                          <div className="flex items-center justify-between mb-8">
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
                              {step.label}
                            </span>
                            <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-900 shadow-sm">
                              <StepIcon className="w-5 h-5" />
                            </div>
                          </div>

                          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 sm:p-6 min-h-[220px] flex flex-col justify-between">
                            <div>
                              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-2">
                                TDBK DIGITAL SPACE
                              </div>
                              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 mb-2">
                                {step.title}
                              </h2>
                              <p className="text-sm text-neutral-600 leading-relaxed mb-6">
                                {step.subtitle}
                              </p>
                            </div>

                            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                              <div className="text-sm font-bold text-neutral-950">{step.body}</div>
                              <div className="text-xs text-neutral-500 mt-1">{step.detail}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="px-5 sm:px-7 py-4 bg-white border-t border-neutral-200 flex items-center justify-between">
                  <div className="flex items-center gap-1.5" aria-label="Journey steps">
                    {[0, 1, 2, 3].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setJourneyStep(step)}
                        aria-label={`Show journey step ${step + 1}`}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          step === journeyStep ? 'w-8 bg-neutral-950' : 'w-2 bg-neutral-300 hover:bg-neutral-400'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-500">
                    School → Sign In → Business → Workspace
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. YOUR BUSINESS. YOUR SPACE. */}
        <section id="business-spaces" className="py-20 bg-neutral-100/70 border-y border-neutral-200/80 px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-600 block mb-2">
                Tailored Spaces
              </span>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-950 tracking-tight">
                Your Business. Your Space.
              </h2>
              <p className="mt-3 text-base text-neutral-600 leading-relaxed">
                Choose the environment designed specifically for your industry. Every space comes pre-configured with
                the metrics, terminology, and workflows that match your day-to-day operations.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  sector: 'EDUCATION' as BusinessSector,
                  title: 'Schools & Academies',
                  icon: GraduationCap,
                  desc: 'CBC curriculum tracking, student attendance, parent communication, and fee reconciliation.',
                  highlight: 'Grade 1–9 CBC Strands',
                },
                {
                  sector: 'RETAIL' as BusinessSector,
                  title: 'Retail & Shops',
                  icon: ShoppingBag,
                  desc: 'Fast checkout, stock control, customer records, real-time sales summaries, and repeat buyer insights.',
                  highlight: 'Multi-Till POS',
                },
                {
                  sector: 'COMMERCE' as BusinessSector,
                  title: 'Hardware & Commerce',
                  icon: Wrench,
                  desc: 'Wholesale order dispatch, contractor credit accounts, multiple yard stock, and eTIMS receipts.',
                  highlight: 'Heavy Trade Orders',
                },
                {
                  sector: 'HEALTHCARE' as BusinessSector,
                  title: 'Healthcare & Clinics',
                  icon: Stethoscope,
                  desc: 'Outpatient visits, digital prescription flow, SHA insurance verification, and dispensary tracking.',
                  highlight: 'SHA / Insurance Ready',
                },
                {
                  sector: 'HOSPITALITY' as BusinessSector,
                  title: 'Hospitality & Lodges',
                  icon: Hotel,
                  desc: 'Room reservations, guest front desk folios, restaurant till bills, and housekeeping oversight.',
                  highlight: 'Guest Booking Folio',
                },
                {
                  sector: 'GOVERNMENT' as BusinessSector,
                  title: 'Organisations & Trusts',
                  icon: Building2,
                  desc: 'Project milestones, community task allocation, county-level reporting, and transparent fund tracking.',
                  highlight: 'County Program Tracking',
                },
              ].map((card) => {
                const IconComponent = card.icon;
                return (
                  <div
                    key={card.sector}
                    className="bg-white rounded-2xl p-7 border border-neutral-200/80 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all flex flex-col justify-between group cursor-pointer"
                    onClick={() => handleSelectBusinessCard(card.sector)}
                  >
                    <div>
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-5 group-hover:bg-neutral-900 group-hover:text-white transition">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                        {card.highlight}
                      </div>
                      <h3 className="text-xl font-bold text-neutral-950 mb-2">{card.title}</h3>
                      <p className="text-sm text-neutral-600 leading-relaxed mb-6">{card.desc}</p>
                    </div>

                    <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-sm font-semibold text-neutral-900 group-hover:text-neutral-950">
                      <span className="flex items-center space-x-1">
                        <span>Preview Space</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateSpace(card.sector);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-950 hover:text-white text-neutral-800 font-semibold transition cursor-pointer"
                        aria-label={`Choose ${card.title} space`}
                      >
                        Choose Space
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. NEW WORKSPACE SHOWCASE SECTION: "See Your Digital Space" */}
        <section
          id="digital-space-showcase"
          className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20"
        >
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 block mb-3">
              See Your Digital Space
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-neutral-950 tracking-tight mb-4">
              Your business, in one connected space.
            </h2>
            <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-2xl mx-auto">
              Every DBK workspace is shaped around the way your business works — with the core tools, information,
              payments and operations you need in one place. Optional hardware and integrations can be added when useful.
            </p>
            <p className="mt-3 text-[11px] font-mono uppercase tracking-wide text-neutral-400">
              Illustrative workspace references — not live organization data
            </p>
          </div>

          {/* Carousel Category Pills / Indicators */}
          <div className="flex items-center justify-start md:justify-center overflow-x-auto pb-4 mb-8 gap-2 no-scrollbar">
            {SHOWCASE_DATA.map((item, idx) => {
              const isSelected = idx === activeSlideIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSlideIndex(idx)}
                  aria-label={`View workspace for ${item.categoryTitle}`}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-950 text-white shadow-sm'
                      : 'bg-white text-neutral-600 border border-neutral-200/80 hover:border-neutral-300 hover:text-neutral-900'
                  }`}
                >
                  {item.categoryTitle}
                </button>
              );
            })}
          </div>

          {/* Main Interactive Carousel Viewport */}
          <div
            ref={carouselRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative w-full overflow-hidden"
          >
            {/* The Window into the DBK Product (Large White Dashboard Frame) */}
            <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-neutral-200/90 shadow-xl overflow-hidden transition-all duration-300">
              {/* App-Style Top Header Bar */}
              <div className="bg-neutral-900 text-white px-5 sm:px-8 py-3.5 flex items-center justify-between border-b border-neutral-800">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  {/* Traffic light indicator dots */}
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                  </div>
                  <div className="h-4 w-px bg-neutral-800" />
                  <div>
                    <span className="font-bold text-sm tracking-tight text-white mr-2">
                      {activeShowcase.businessName}
                    </span>
                    <span className="text-xs text-neutral-400 font-normal hidden sm:inline">
                      {activeShowcase.workspaceType}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-[11px] text-neutral-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                    <span>Workspace Preview</span>
                  </span>
                  <div className="text-[11px] font-mono text-neutral-400 border border-neutral-800 px-2 py-0.5 rounded">
                    {activeShowcase.badge}
                  </div>
                </div>
              </div>

              {/* Internal Mock Dashboard Layout */}
              <div className="p-4 sm:p-7 md:p-9 bg-[#FAFAF8]">
                {/* Horizontal navigation tabs representing the workspace navigation */}
                <div className="flex items-center space-x-2 sm:space-x-3 border-b border-neutral-200/80 pb-4 mb-7 overflow-x-auto text-xs sm:text-sm">
                  {activeShowcase.navItems.map((nav, nIdx) => (
                    <span
                      key={nav}
                      className={`px-3.5 py-1.5 rounded-lg font-semibold whitespace-nowrap ${
                        nIdx === 0
                          ? 'bg-neutral-900 text-white'
                          : 'bg-white text-neutral-600 border border-neutral-200/80'
                      }`}
                    >
                      {nav}
                    </span>
                  ))}
                </div>

                {/* Dashboard Metric Cards Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-7">
                  {activeShowcase.metrics.map((metric) => {
                    const MetricIcon = metric.icon;
                    return (
                      <div
                        key={metric.label}
                        className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-neutral-500">{metric.label}</span>
                          <div className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
                            <MetricIcon className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-neutral-950 tracking-tight">
                          {metric.value}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1 flex items-center space-x-1">
                          <span className="text-emerald-700 font-semibold">{metric.change}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Activity Feed and Workspace Actions */}
                <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-4">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-neutral-700" />
                      <h4 className="text-sm font-bold text-neutral-900">{activeShowcase.activityTitle}</h4>
                    </div>
                    <span className="text-xs text-neutral-400">Example activity</span>
                  </div>

                  <div className="space-y-3">
                    {activeShowcase.activities.map((act, aIdx) => (
                      <div
                        key={aIdx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100/80 gap-1 sm:gap-4"
                      >
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-neutral-900">{act.title}</div>
                          <div className="text-xs text-neutral-500">{act.detail}</div>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0 text-right">
                          <span className="text-[11px] font-mono text-neutral-400">{act.time}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 text-neutral-800">
                            {act.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Primary Workspace CTA Footer */}
                  <div className="mt-6 pt-5 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-neutral-600 text-center sm:text-left">
                      Ready to configure your own digital space for <strong className="text-neutral-900">{activeShowcase.categoryTitle}</strong>?
                    </div>

                    <button
                      onClick={() => handleCreateSpace(activeShowcase.sector)}
                      aria-label={`Create this space for ${activeShowcase.categoryTitle}`}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>Create this space</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Carousel Navigation Controls (Bottom Bar) */}
            <div className="flex items-center justify-between mt-6 px-1">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrev}
                  aria-label="Previous workspace preview"
                  className="w-10 h-10 rounded-xl bg-white border border-neutral-200/80 text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950 transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-neutral-950 cursor-pointer shadow-xs"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNext}
                  aria-label="Next workspace preview"
                  className="w-10 h-10 rounded-xl bg-white border border-neutral-200/80 text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950 transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-neutral-950 cursor-pointer shadow-xs"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Visual Pagination Indicators */}
              <div className="flex items-center space-x-1.5">
                {SHOWCASE_DATA.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveSlideIndex(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      i === activeSlideIndex ? 'w-6 bg-neutral-950' : 'w-2 bg-neutral-300 hover:bg-neutral-400'
                    }`}
                  />
                ))}
              </div>

              <div className="text-xs font-medium text-neutral-600">
                Workspace <span className="font-bold text-neutral-950">{activeSlideIndex + 1}</span> of {SHOWCASE_DATA.length}
              </div>
            </div>
          </div>
        </section>

        {/* 5. HOW DBK WORKS */}
        <section id="how-it-works" className="py-20 bg-neutral-100/70 border-y border-neutral-200/80 px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-600 block mb-2">
                Effortless Adoption
              </span>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-950 tracking-tight">
                How DBK Works
              </h2>
              <p className="mt-3 text-base text-neutral-600 leading-relaxed">
                Getting started is simple. DBK replaces disjointed spreadsheets, paper forms, and isolated tools
                with a single unified operational environment.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-2xl p-8 border border-neutral-200/80 shadow-xs relative">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm mb-6">
                  1
                </div>
                <h3 className="text-xl font-bold text-neutral-950 mb-3">Discover & Choose</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Explore purpose-built spaces designed for Kenyan schools, retail, wholesale, clinics, and hospitality.
                  Every workspace comes tailored with your industry's exact workflows.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-neutral-200/80 shadow-xs relative">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm mb-6">
                  2
                </div>
                <h3 className="text-xl font-bold text-neutral-950 mb-3">Create Your Space</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Reserve your business identity, select your county, and activate your operational tools in minutes.
                  Connect your staff with role-based permissions tailored to your organization.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-neutral-200/80 shadow-xs relative">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm mb-6">
                  3
                </div>
                <h3 className="text-xl font-bold text-neutral-950 mb-3">Operate & Grow</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Run daily transactions, customer records, Lipa Na M-Pesa payments, and compliance from one connected dashboard.
                  Monitor performance anywhere from your phone, tablet, or laptop.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. TDBK SALE, SERVICES & COMMERCIAL BRIDGE */}
        <section id="services" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24">
          <CommercialBridge
            onSelectSector={handleCreateSpace}
            onBuildDigitalSpace={(sector) => handleCreateSpace(sector || 'EDUCATION')}
          />
        </section>

        {/* 7. TDBK GAZETTE — DIGITAL BRIDGE MARKET INTELLIGENCE */}
        <section id="gazette" className="py-20 bg-neutral-100/60 border-t border-neutral-200/80 px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-10">
              <div className="max-w-2xl">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600 block mb-2">
                  TDBK Intelligence
                </span>
                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-950 tracking-tight">
                  The TDBK Gazette
                </h2>
                <p className="text-sm sm:text-base text-neutral-600 mt-3 leading-relaxed">
                  Market updates, digital infrastructure developments, regulatory signals,
                  technology movements, and opportunities relevant to Kenya’s digital-business ecosystem.
                </p>
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                DIGITAL BRIDGE MARKET INTELLIGENCE
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  tag: 'MARKET',
                  title: 'Digital business movements',
                  summary: 'Track how Kenyan businesses are adopting connectivity, automation, payments, cloud tools, and managed digital operations.',
                },
                {
                  tag: 'OPPORTUNITIES',
                  title: 'Tender & opportunity signals',
                  summary: 'Surface relevant tenders, procurement needs, partnerships, installations, and digital transformation opportunities.',
                },
                {
                  tag: 'REGULATORY',
                  title: 'Regulatory & compliance signals',
                  summary: 'Follow changes affecting eTIMS, data protection, digital records, payments, education, healthcare, and other connected operations.',
                },
                {
                  tag: 'INFRASTRUCTURE',
                  title: 'Digital bridge developments',
                  summary: 'Follow connectivity, cloud, AI, WhatsApp, M-Pesa, eTIMS, networking, security, and other infrastructure changes that can shape TDBK capabilities.',
                },
              ].map((item) => (
                <article key={item.tag} className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs">
                  <div className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 mb-4">
                    {item.tag}
                  </div>
                  <h3 className="text-base font-bold text-neutral-950 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {item.summary}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4">
              <div>
                <div className="text-sm font-bold text-neutral-950">The feed should evolve with the market.</div>
                <div className="text-xs text-neutral-500 mt-1">
                  This surface is reserved for verified TDBK market intelligence rather than invented or stale news.
                </div>
              </div>
              <span className="inline-flex w-fit rounded-full bg-neutral-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Intelligence Feed
              </span>
            </div>
          </div>
        </section>

      </main>

      {/* 8. FOOTER */}
      <footer className="bg-neutral-950 text-white border-t border-neutral-800 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-12 border-b border-neutral-800 text-sm">
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white text-neutral-950 flex items-center justify-center font-serif font-bold">
                  T
                </div>
                <span className="font-serif font-bold text-base tracking-tight">
                  Thuram Digital Bridge Kenya
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                Architected for Kenyan enterprises, schools, healthcare centres, and merchants.
                Designed for high security, local connectivity, and regulatory compliance.
              </p>
              <div className="text-xs font-mono text-neutral-500">
                Nairobi • Mombasa • Kisumu • Nakuru • Eldoret
              </div>
            </div>

            <div>
              <h5 className="font-bold text-xs uppercase tracking-wider text-neutral-400 mb-4">Digital Spaces</h5>
              <ul className="space-y-2.5 text-xs text-neutral-400">
                <li><button onClick={() => handleCreateSpace('EDUCATION')} className="hover:text-white transition">Schools & Academies</button></li>
                <li><button onClick={() => handleCreateSpace('RETAIL')} className="hover:text-white transition">Retail & Supermarkets</button></li>
                <li><button onClick={() => handleCreateSpace('COMMERCE')} className="hover:text-white transition">Hardware & Wholesale</button></li>
                <li><button onClick={() => handleCreateSpace('HEALTHCARE')} className="hover:text-white transition">Hospitals & Clinics</button></li>
                <li><button onClick={() => handleCreateSpace('HOSPITALITY')} className="hover:text-white transition">Hotels & Lodges</button></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-xs uppercase tracking-wider text-neutral-400 mb-4">Sale & Services</h5>
              <ul className="space-y-2.5 text-xs text-neutral-400">
                <li><a href="#sale-catalog" className="hover:text-white transition">Business Hardware & POS</a></li>
                <li><a href="#services-catalog" className="hover:text-white transition">Nationwide Setup & Installation</a></li>
                <li><a href="#sale-catalog" className="hover:text-white transition">Wi-Fi, Networking & Starlink</a></li>
                <li><a href="#services-catalog" className="hover:text-white transition">Lipa Na M-Pesa & eTIMS Compliance</a></li>
                <li><a href="#consultation-section" className="hover:text-white transition">Managed IT & Support Retainers</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-4">
            <div>
              © {new Date().getFullYear()} Thuram Digital Bridge Kenya (TDBK). All rights reserved.
            </div>
            <div className="text-xs font-semibold text-neutral-400">
              Built in Kenya. For Kenya. For a Brighter Tomorrow.
            </div>
            <div className="flex items-center space-x-6">
              <span>Customer-Facing Gateway</span>
              <span>•</span>
              <span>Secure Digital Infrastructure</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}