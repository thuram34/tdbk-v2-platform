import { CapabilityViewDefinition } from './viewRegistry';

const fields = (...items: CapabilityViewDefinition['entitySchema']): CapabilityViewDefinition['entitySchema'] => items;

export const SPECIALIZED_VIEW_CATALOG: CapabilityViewDefinition[] = [
  // SCHOOL / EDUCATION
  { capabilityId:'student_records', defaultNavLabel:'Students', category:'STUDENTS', iconName:'GraduationCap', viewType:'STUDENT_REGISTRY', displayOrder:1, terminologyKey:'customer',
    entitySchema:fields({name:'admissionNo',label:'Admission Number',type:'string',required:true},{name:'fullName',label:'Student Name',type:'string',required:true},{name:'classStream',label:'Class / Stream',type:'string',required:true},{name:'guardianName',label:'Parent / Guardian',type:'string',required:true},{name:'guardianPhone',label:'Guardian Phone',type:'string',required:true},{name:'dateOfBirth',label:'Date of Birth',type:'date',required:true},{name:'gender',label:'Gender',type:'string',required:true,options:['MALE','FEMALE']}) },
  { capabilityId:'fee_management', defaultNavLabel:'School Fees', category:'FINANCE', iconName:'Receipt', viewType:'SCHOOL_FEES', displayOrder:2, terminologyKey:'contract',
    entitySchema:fields({name:'studentId',label:'Student / Admission No.',type:'string',required:true},{name:'feeItem',label:'Fee Item',type:'string',required:true},{name:'term',label:'Term',type:'string',required:true},{name:'amount',label:'Amount (KES)',type:'number',required:true},{name:'dueDate',label:'Due Date',type:'date',required:true}) },
  { capabilityId:'mpesa_reconciliation', defaultNavLabel:'M-Pesa Fee Reconciliation', category:'FINANCE', iconName:'Smartphone', viewType:'SCHOOL_MPESA', displayOrder:3, terminologyKey:'transaction',
    entitySchema:fields({name:'transactionCode',label:'M-Pesa Transaction Code',type:'string',required:true},{name:'studentId',label:'Student / Admission No.',type:'string',required:true},{name:'amount',label:'Amount (KES)',type:'number',required:true},{name:'payerPhone',label:'Payer Phone',type:'string',required:true}) },
  { capabilityId:'parent_portal', defaultNavLabel:'Parents & Guardians', category:'COMMUNICATION', iconName:'Users', viewType:'PARENT_COMMUNICATION', displayOrder:4 },
  { capabilityId:'cbc_grading', defaultNavLabel:'CBC Assessment', category:'ACADEMICS', iconName:'GraduationCap', viewType:'CBC_ASSESSMENT', displayOrder:5, terminologyKey:'customer',
    entitySchema:fields({name:'studentId',label:'Student',type:'string',required:true},{name:'learningArea',label:'Learning Area',type:'string',required:true},{name:'strand',label:'Strand / Sub-strand',type:'string',required:false},{name:'rating',label:'Performance Level',type:'string',required:true,options:['EE','ME','AE','BE']},{name:'teacherComment',label:'Teacher Comment',type:'string',required:false}) },
  { capabilityId:'transport_tracking', defaultNavLabel:'School Transport', category:'OPERATIONS', iconName:'Bus', viewType:'SCHOOL_TRANSPORT', displayOrder:6 },
  { capabilityId:'hostel_management', defaultNavLabel:'Boarding & Hostel', category:'OPERATIONS', iconName:'Bed', viewType:'HOSTEL_MANAGEMENT', displayOrder:7 },
  { capabilityId:'library_sys', defaultNavLabel:'Library & Textbooks', category:'OPERATIONS', iconName:'BookOpen', viewType:'SCHOOL_LIBRARY', displayOrder:8 },
  { capabilityId:'smart_classroom', defaultNavLabel:'Smart Classroom', category:'ACADEMICS', iconName:'Presentation', viewType:'CUSTOM_CLASSROOM', displayOrder:9 },

  // HEALTHCARE
  { capabilityId:'patient_queue', defaultNavLabel:'Patient Triage Queue', category:'CLINICAL', iconName:'Stethoscope', viewType:'PATIENT_TRIAGE', displayOrder:1,
    entitySchema:fields({name:'patientNumber',label:'OPD Number',type:'string',required:true},{name:'fullName',label:'Patient Name',type:'string',required:true},{name:'triageCategory',label:'Triage Category',type:'string',required:true,options:['EMERGENCY','URGENT','ROUTINE']},{name:'complaint',label:'Chief Complaint',type:'string',required:true}) },
  { capabilityId:'emr_consultation', defaultNavLabel:'Clinical Consultation', category:'CLINICAL', iconName:'Stethoscope', viewType:'EMR_CONSULTATION', displayOrder:2,
    entitySchema:fields({name:'patientId',label:'Patient',type:'string',required:true},{name:'clinician',label:'Clinician',type:'string',required:true},{name:'diagnosis',label:'Diagnosis',type:'string',required:true},{name:'treatmentPlan',label:'Treatment Plan',type:'string',required:true},{name:'followUpDate',label:'Follow-up Date',type:'date',required:false}) },
  { capabilityId:'pharmacy_dispensing', defaultNavLabel:'Pharmacy Dispensing', category:'PHARMACY', iconName:'Pill', viewType:'PHARMACY_DISPENSING', displayOrder:3,
    entitySchema:fields({name:'patientId',label:'Patient',type:'string',required:true},{name:'prescriptionId',label:'Prescription',type:'string',required:true},{name:'medicine',label:'Medicine',type:'string',required:true},{name:'quantity',label:'Quantity',type:'number',required:true},{name:'batchNo',label:'Batch Number',type:'string',required:false}) },
  { capabilityId:'medical_billing', defaultNavLabel:'Patient Billing', category:'FINANCE', iconName:'Receipt', viewType:'MEDICAL_BILLING', displayOrder:4,
    entitySchema:fields({name:'patientId',label:'Patient',type:'string',required:true},{name:'invoiceNumber',label:'Invoice Number',type:'string',required:true},{name:'amount',label:'Amount (KES)',type:'number',required:true},{name:'payerType',label:'Payer Type',type:'string',required:true,options:['CASH','INSURANCE','SHA','CORPORATE']}) },
  { capabilityId:'vitals_triage', defaultNavLabel:'Vitals & Triage', category:'CLINICAL', iconName:'Activity', viewType:'VITALS_TRIAGE', displayOrder:5 },
  { capabilityId:'e_prescriptions', defaultNavLabel:'e-Prescriptions', category:'CLINICAL', iconName:'FileText', viewType:'E_PRESCRIPTIONS', displayOrder:6 },
  { capabilityId:'sha_insurance', defaultNavLabel:'SHA / Insurance Claims', category:'FINANCE', iconName:'ShieldCheck', viewType:'INSURANCE_CLAIMS', displayOrder:7 },

  // HOSPITALITY
  { capabilityId:'room_reservations', defaultNavLabel:'Room Reservations', category:'FRONT_DESK', iconName:'Hotel', viewType:'ROOM_RESERVATIONS', displayOrder:1,
    entitySchema:fields({name:'bookingRef',label:'Booking Reference',type:'string',required:true},{name:'guestName',label:'Guest Name',type:'string',required:true},{name:'roomNumber',label:'Room Number',type:'string',required:true},{name:'checkInDate',label:'Check-in',type:'date',required:true},{name:'checkOutDate',label:'Check-out',type:'date',required:true}) },
  { capabilityId:'checkin_checkout', defaultNavLabel:'Front Desk Check-in / Check-out', category:'FRONT_DESK', iconName:'KeyRound', viewType:'HOTEL_FRONT_DESK', displayOrder:2 },
  { capabilityId:'guest_folio_billing', defaultNavLabel:'Guest Folios', category:'FINANCE', iconName:'Receipt', viewType:'GUEST_FOLIO', displayOrder:3 },
  { capabilityId:'housekeeping_status', defaultNavLabel:'Housekeeping', category:'HOUSEKEEPING', iconName:'BedDouble', viewType:'HOUSEKEEPING', displayOrder:4 },
  { capabilityId:'room_folio_pos', defaultNavLabel:'Restaurant / Bar Room Posting', category:'RESTAURANT', iconName:'Utensils', viewType:'ROOM_FOLIO_POS', displayOrder:5 },

  // BEAUTY
  { capabilityId:'appointment_booking', defaultNavLabel:'Appointments', category:'APPOINTMENTS', iconName:'CalendarDays', viewType:'SALON_APPOINTMENTS', displayOrder:1,
    entitySchema:fields({name:'clientName',label:'Client',type:'string',required:true},{name:'service',label:'Service',type:'string',required:true},{name:'stylist',label:'Stylist / Therapist',type:'string',required:true},{name:'appointmentDate',label:'Appointment Date',type:'date',required:true}) },
  { capabilityId:'salon_pos', defaultNavLabel:'Salon Checkout', category:'SALES', iconName:'Scissors', viewType:'SALON_POS', displayOrder:2,
    entitySchema:fields({name:'clientName',label:'Client',type:'string',required:true},{name:'service',label:'Service',type:'string',required:true},{name:'amount',label:'Amount (KES)',type:'number',required:true},{name:'stylist',label:'Stylist / Therapist',type:'string',required:true}) },
  { capabilityId:'stylist_commission', defaultNavLabel:'Stylist Commissions', category:'FINANCE', iconName:'Percent', viewType:'STYLIST_COMMISSIONS', displayOrder:3 },
  { capabilityId:'salon_product_inventory', defaultNavLabel:'Beauty Product Stock', category:'INVENTORY', iconName:'Package', viewType:'SALON_INVENTORY', displayOrder:4 },

  // LOGISTICS
  { capabilityId:'waybill_booking', defaultNavLabel:'Waybills & Consignments', category:'SHIPMENTS', iconName:'FileText', viewType:'WAYBILL_BOOKING', displayOrder:1,
    entitySchema:fields({name:'waybillNo',label:'Waybill Number',type:'string',required:true},{name:'consignor',label:'Consignor',type:'string',required:true},{name:'consignee',label:'Consignee',type:'string',required:true},{name:'originDepot',label:'Origin Depot',type:'string',required:true},{name:'destinationDepot',label:'Destination Depot',type:'string',required:true},{name:'cargoDescription',label:'Cargo Description',type:'string',required:true}) },
  { capabilityId:'driver_assignment', defaultNavLabel:'Driver & Vehicle Dispatch', category:'DISPATCH', iconName:'Truck', viewType:'LOGISTICS_DISPATCH', displayOrder:2 },
  { capabilityId:'pod_tracking', defaultNavLabel:'Proof of Delivery', category:'DISPATCH', iconName:'ClipboardCheck', viewType:'PROOF_OF_DELIVERY', displayOrder:3 },
  { capabilityId:'cargo_manifest', defaultNavLabel:'Truck Manifests', category:'SHIPMENTS', iconName:'List', viewType:'CARGO_MANIFEST', displayOrder:4 },
  { capabilityId:'fuel_mileage_logs', defaultNavLabel:'Fuel & Fleet Maintenance', category:'FLEET', iconName:'Fuel', viewType:'FLEET_LOGS', displayOrder:5 },
  { capabilityId:'corporate_billing', defaultNavLabel:'Corporate Freight Billing', category:'FINANCE', iconName:'Receipt', viewType:'CORPORATE_BILLING', displayOrder:6 },

  // PROFESSIONAL SERVICES
  { capabilityId:'case_management', defaultNavLabel:'Client Matters & Cases', category:'MATTERS', iconName:'BriefcaseBusiness', viewType:'CASE_MANAGEMENT', displayOrder:1,
    entitySchema:fields({name:'clientName',label:'Client',type:'string',required:true},{name:'matterReference',label:'Matter / File Number',type:'string',required:true},{name:'matterType',label:'Matter Type',type:'string',required:true},{name:'responsibleStaff',label:'Responsible Professional',type:'string',required:true}) },
  { capabilityId:'fee_note_invoicing', defaultNavLabel:'Fee Notes & Billing', category:'FINANCE', iconName:'Receipt', viewType:'FEE_NOTE_BILLING', displayOrder:2 },
  { capabilityId:'time_billing', defaultNavLabel:'Billable Time', category:'BILLABLE_TIME', iconName:'Clock3', viewType:'TIME_BILLING', displayOrder:3 },
  { capabilityId:'retainer_ledger', defaultNavLabel:'Retainer Ledger', category:'FINANCE', iconName:'WalletCards', viewType:'RETAINER_LEDGER', displayOrder:4 },
  { capabilityId:'doc_management', defaultNavLabel:'Client Documents', category:'DOCUMENTS', iconName:'FolderOpen', viewType:'CLIENT_DOCUMENTS', displayOrder:5 },

  // MANUFACTURING / CONSTRUCTION / COMMUNITY
  { capabilityId:'bom_management', defaultNavLabel:'Bill of Materials', category:'PRODUCTION', iconName:'Layers', viewType:'BOM_MANAGER', displayOrder:1 },
  { capabilityId:'production_orders', defaultNavLabel:'Production Orders', category:'PRODUCTION', iconName:'Factory', viewType:'PRODUCTION_ORDERS', displayOrder:2 },
  { capabilityId:'project_register', defaultNavLabel:'Projects & Sites', category:'PROJECTS', iconName:'HardHat', viewType:'PROJECT_REGISTER', displayOrder:1 },
  { capabilityId:'boq_management', defaultNavLabel:'Bill of Quantities', category:'PROJECTS', iconName:'ClipboardList', viewType:'BOQ_MANAGER', displayOrder:2 },
  { capabilityId:'member_registry', defaultNavLabel:'Members & Beneficiaries', category:'PEOPLE', iconName:'Users', viewType:'MEMBER_REGISTRY', displayOrder:1 },
  { capabilityId:'community_projects', defaultNavLabel:'Community Projects', category:'PROGRAMS', iconName:'HeartHandshake', viewType:'COMMUNITY_PROJECTS', displayOrder:2 },
  { capabilityId:'donation_management', defaultNavLabel:'Donations & Pledges', category:'FINANCE', iconName:'HandCoins', viewType:'DONATIONS', displayOrder:3 },
];