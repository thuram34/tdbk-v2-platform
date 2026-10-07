import { Blueprint } from './types';

export const EXTENDED_BLUEPRINT_CATALOG: Blueprint[] = [
  {
    id:'manufacturing_v1', name:'Manufacturing & Production Operations', version:'1.0.0', sector:'MANUFACTURING',
    description:'Production, bill of materials, work orders, quality, inventory and procurement.',
    terminology:{customer:{singular:'Customer',plural:'Customers'},provider:{singular:'Supplier',plural:'Suppliers'},contract:{singular:'Production Order',plural:'Production Orders'},location:{singular:'Plant / Branch',plural:'Plants / Branches'},transaction:{singular:'Production Transaction',plural:'Production Transactions'},product:{singular:'Finished Good',plural:'Finished Goods'},material:{singular:'Raw Material',plural:'Raw Materials'}},
    domains:[
      {id:'production',name:'Production Control',description:'Bills of material, work orders and production output',displayOrder:1,supportedCapabilityIds:['bom_management','production_orders','work_centres']},
      {id:'inventory',name:'Materials & Inventory',description:'Raw materials, finished goods and stock movements',displayOrder:2,supportedCapabilityIds:['manufacturing_inventory','material_issue']},
      {id:'quality',name:'Quality Control',description:'Inspections, non-conformance and release status',displayOrder:3,supportedCapabilityIds:['quality_control']},
      {id:'procurement',name:'Procurement',description:'Supplier orders and material receipts',displayOrder:4,supportedCapabilityIds:['manufacturing_procurement']},
      {id:'finance',name:'Costing & Finance',description:'Production cost, variance and billing',displayOrder:5,supportedCapabilityIds:['production_costing']}],
    supportedCapabilities:[
      {id:'bom_management',name:'Bill of Materials',category:'MANUFACTURING',isDefault:true,description:'Define components and quantities required to manufacture finished goods.'},
      {id:'production_orders',name:'Production Orders',category:'MANUFACTURING',isDefault:true,description:'Create, schedule and complete production orders.'},
      {id:'work_centres',name:'Work Centres & Capacity',category:'MANUFACTURING',isDefault:false,description:'Track production work centres, operators and capacity.'},
      {id:'manufacturing_inventory',name:'Manufacturing Inventory',category:'INVENTORY',isDefault:true,description:'Track raw materials, WIP and finished goods.'},
      {id:'material_issue',name:'Material Issue & Consumption',category:'INVENTORY',isDefault:true,description:'Issue raw materials to production and record consumption.'},
      {id:'quality_control',name:'Quality Control',category:'MANUFACTURING',isDefault:false,description:'Inspection results, quality holds and release decisions.'},
      {id:'manufacturing_procurement',name:'Manufacturing Procurement',category:'PURCHASING',isDefault:false,description:'Supplier purchase orders and material receipts.'},
      {id:'production_costing',name:'Production Costing',category:'FINANCE',isDefault:false,description:'Material, labour and overhead costing with variance tracking.'}],
    defaultRoles:['PRODUCTION_MANAGER','STORE_MANAGER','QUALITY_OFFICER','PROCUREMENT_OFFICER','ACCOUNTANT'],
    supportedDocumentTypes:['BOM','PRODUCTION_ORDER','GOODS_RECEIPT','QUALITY_REPORT'],supportedCommunicationChannels:['WHATSAPP','SMS','EMAIL'],
    financialNeeds:['PRODUCTION_COSTING','SUPPLIER_LEDGER'],inventoryNeeds:['RAW_MATERIALS','WORK_IN_PROGRESS','FINISHED_GOODS'],createdAt:'2026-10-07T00:00:00.000Z'
  },
  {
    id:'construction_v1', name:'Construction & Project Operations', version:'1.0.0', sector:'CONSTRUCTION',
    description:'Projects, BOQs, procurement, site operations, labour and progress billing.',
    terminology:{customer:{singular:'Client',plural:'Clients'},provider:{singular:'Contractor / Supplier',plural:'Contractors / Suppliers'},contract:{singular:'Contract / LPO',plural:'Contracts / LPOs'},location:{singular:'Project Site',plural:'Project Sites'},transaction:{singular:'Project Transaction',plural:'Project Transactions'},product:{singular:'Material',plural:'Materials'}},
    domains:[
      {id:'projects',name:'Projects & Sites',description:'Projects, phases, sites and progress tracking',displayOrder:1,supportedCapabilityIds:['project_register','project_progress']},
      {id:'commercial',name:'BOQ & Cost Control',description:'Bills of quantities, budgets and variations',displayOrder:2,supportedCapabilityIds:['boq_management','project_costing']},
      {id:'procurement',name:'Procurement & Materials',description:'Supplier orders, deliveries and site stock',displayOrder:3,supportedCapabilityIds:['construction_procurement','site_inventory']},
      {id:'workforce',name:'Labour & Workforce',description:'Workers, attendance and labour allocation',displayOrder:4,supportedCapabilityIds:['labour_tracking']},
      {id:'billing',name:'Client Billing',description:'Progress claims, invoices and payments',displayOrder:5,supportedCapabilityIds:['progress_billing']}],
    supportedCapabilities:[
      {id:'project_register',name:'Project & Site Register',category:'PROJECTS',isDefault:true,description:'Create projects, sites, phases and responsible teams.'},
      {id:'boq_management',name:'Bill of Quantities',category:'PROJECTS',isDefault:true,description:'Manage BOQ items, quantities, rates and approved variations.'},
      {id:'project_progress',name:'Site Progress Tracking',category:'PROJECTS',isDefault:true,description:'Record completed work, site updates and project milestones.'},
      {id:'project_costing',name:'Project Cost Control',category:'FINANCE',isDefault:true,description:'Track committed, actual and forecast project costs.'},
      {id:'construction_procurement',name:'Construction Procurement',category:'PURCHASING',isDefault:false,description:'Supplier LPOs, delivery notes and procurement status.'},
      {id:'site_inventory',name:'Site Materials Inventory',category:'INVENTORY',isDefault:true,description:'Track materials received, issued and remaining at site.'},
      {id:'labour_tracking',name:'Labour & Site Attendance',category:'WORKFORCE',isDefault:false,description:'Track workers, attendance and labour allocation.'},
      {id:'progress_billing',name:'Progress Billing',category:'FINANCE',isDefault:false,description:'Generate progress claims and client invoices from approved work.'}],
    defaultRoles:['PROJECT_MANAGER','SITE_ENGINEER','QUANTITY_SURVEYOR','STOREKEEPER','ACCOUNTANT'],
    supportedDocumentTypes:['BOQ','LPO','DELIVERY_NOTE','SITE_REPORT','PROGRESS_CLAIM'],supportedCommunicationChannels:['WHATSAPP','SMS','EMAIL'],
    financialNeeds:['PROJECT_COSTING','PROGRESS_BILLING'],inventoryNeeds:['SITE_MATERIALS','TOOLS'],createdAt:'2026-10-07T00:00:00.000Z'
  },
  {
    id:'community_v1', name:'NGO, Church & Community Operations', version:'1.0.0', sector:'COMMUNITY',
    description:'Members, beneficiaries, donations, projects, volunteers and accountable programs.',
    terminology:{customer:{singular:'Member / Beneficiary',plural:'Members / Beneficiaries'},provider:{singular:'Partner / Donor',plural:'Partners / Donors'},contract:{singular:'Program / Project',plural:'Programs / Projects'},location:{singular:'Branch / Centre',plural:'Branches / Centres'},transaction:{singular:'Contribution',plural:'Contributions'}},
    domains:[
      {id:'people',name:'Members & Beneficiaries',description:'Member, beneficiary and household records',displayOrder:1,supportedCapabilityIds:['member_registry','beneficiary_registry']},
      {id:'programs',name:'Programs & Projects',description:'Projects, activities, beneficiaries and outcomes',displayOrder:2,supportedCapabilityIds:['community_projects','program_tracking']},
      {id:'finance',name:'Donations & Contributions',description:'Donations, pledges, contributions and receipts',displayOrder:3,supportedCapabilityIds:['donation_management','contribution_receipts']},
      {id:'volunteers',name:'Volunteers',description:'Volunteer registration, assignments and attendance',displayOrder:4,supportedCapabilityIds:['volunteer_management']},
      {id:'communications',name:'Community Communication',description:'Notices, campaigns and member messaging',displayOrder:5,supportedCapabilityIds:['community_messaging']}],
    supportedCapabilities:[
      {id:'member_registry',name:'Member Registry',category:'COMMUNITY',isDefault:true,description:'Maintain members, households, contacts and participation.'},
      {id:'beneficiary_registry',name:'Beneficiary Registry',category:'COMMUNITY',isDefault:true,description:'Track beneficiaries and support history.'},
      {id:'community_projects',name:'Community Projects',category:'PROJECTS',isDefault:true,description:'Manage projects, activities, budgets and outcomes.'},
      {id:'program_tracking',name:'Program Monitoring',category:'PROJECTS',isDefault:false,description:'Track indicators, milestones and beneficiary outcomes.'},
      {id:'donation_management',name:'Donation & Pledge Management',category:'FINANCE',isDefault:true,description:'Record donations, pledges and donor commitments.'},
      {id:'contribution_receipts',name:'Contribution Receipts',category:'FINANCE',isDefault:true,description:'Issue accountable receipts for contributions.'},
      {id:'volunteer_management',name:'Volunteer Management',category:'WORKFORCE',isDefault:false,description:'Volunteer profiles, assignments and attendance.'},
      {id:'community_messaging',name:'Community Messaging',category:'COMMUNICATION',isDefault:false,description:'Broadcast notices through configured communication bridges.'}],
    defaultRoles:['DIRECTOR','PROGRAM_MANAGER','TREASURER','ADMINISTRATOR','VOLUNTEER_COORDINATOR'],
    supportedDocumentTypes:['DONATION_RECEIPT','PROJECT_REPORT','MEMBER_FORM'],supportedCommunicationChannels:['WHATSAPP','SMS','EMAIL'],
    financialNeeds:['DONATIONS','PROJECT_BUDGETS'],inventoryNeeds:['ASSETS','PROGRAM_STOCK'],createdAt:'2026-10-07T00:00:00.000Z'
  },
];