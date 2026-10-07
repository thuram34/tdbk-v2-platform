import { capabilityRegistry } from '../../capability/registry';

export interface CapabilityViewDefinition {
  capabilityId: string;
  defaultNavLabel: string;
  category: string;
  iconName: string;
  viewType: string;
  displayOrder?: number;
  terminologyKey?: string;
  entitySchema?: Array<{
    name: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
  }>;
}

export class CapabilityViewRegistry {
  private static instance: CapabilityViewRegistry;
  private definitions: Map<string, CapabilityViewDefinition> = new Map();

  private constructor() {
    this.registerDefaultViews();
  }

  public static getInstance(): CapabilityViewRegistry {
    if (!CapabilityViewRegistry.instance) {
      CapabilityViewRegistry.instance = new CapabilityViewRegistry();
    }
    return CapabilityViewRegistry.instance;
  }

  private registerDefaultViews() {
    const defaults: CapabilityViewDefinition[] = [
      // EDUCATION
      {
        capabilityId: 'student_records',
        defaultNavLabel: 'Student Directory',
        category: 'STUDENT',
        iconName: 'Users',
        viewType: 'ENTITY_LIST',
        displayOrder: 1,
        terminologyKey: 'customer',
        entitySchema: [
          { name: 'admissionNo', label: 'Admission Number', type: 'string', required: true },
          { name: 'fullName', label: 'Student Full Name', type: 'string', required: true },
          { name: 'classStream', label: 'Class / Stream', type: 'string', required: true },
          { name: 'parentContact', label: 'Parent Phone / Contact', type: 'string', required: false },
          { name: 'feeBalance', label: 'Fee Balance (KES)', type: 'number', required: false },
        ],
      },
      {
        capabilityId: 'school_students',
        defaultNavLabel: 'Students',
        category: 'ACADEMICS',
        iconName: 'Users',
        viewType: 'ENTITY_LIST',
        displayOrder: 2,
        terminologyKey: 'students',
        entitySchema: [
          { name: 'fullName', label: 'Student Full Name', type: 'string', required: true },
          { name: 'admissionNumber', label: 'Admission Number', type: 'string', required: true },
          { name: 'gradeLevel', label: 'Grade / Class', type: 'string', required: true },
        ],
      },
      {
        capabilityId: 'fee_management',
        defaultNavLabel: 'Fee Management',
        category: 'FINANCE',
        iconName: 'DollarSign',
        viewType: 'ENTITY_LIST',
        displayOrder: 3,
        terminologyKey: 'contract',
        entitySchema: [
          { name: 'feeName', label: 'Fee Structure Name', type: 'string', required: true },
          { name: 'amount', label: 'Amount (KES)', type: 'number', required: true },
          { name: 'term', label: 'Term / Period', type: 'string', required: true },
        ],
      },
      {
        capabilityId: 'school_fee_structure',
        defaultNavLabel: 'Fee Structure',
        category: 'FINANCE',
        iconName: 'DollarSign',
        viewType: 'ENTITY_LIST',
        displayOrder: 4,
        terminologyKey: 'fees',
        entitySchema: [
          { name: 'feeName', label: 'Fee Name', type: 'string', required: true },
          { name: 'amount', label: 'Amount (KES)', type: 'number', required: true },
          { name: 'term', label: 'Term / Period', type: 'string', required: true },
        ],
      },
      {
        capabilityId: 'mpesa_reconciliation',
        defaultNavLabel: 'M-Pesa Reconciliation',
        category: 'FINANCE',
        iconName: 'Smartphone',
        viewType: 'OPERATIONAL_FLOW',
        displayOrder: 5,
        terminologyKey: 'transaction',
      },
      {
        capabilityId: 'cbc_grading',
        defaultNavLabel: 'CBC Assessment',
        category: 'ACADEMICS',
        iconName: 'GraduationCap',
        viewType: 'ENTITY_LIST',
        displayOrder: 6,
        entitySchema: [
          { name: 'studentId', label: 'Student ID', type: 'string', required: true },
          { name: 'learningArea', label: 'Learning Area / Subject', type: 'string', required: true },
          { name: 'rating', label: 'Proficiency Level (EE/ME/AE/BE)', type: 'string', required: true },
        ],
      },
      {
        capabilityId: 'smart_classroom',
        defaultNavLabel: 'Smart Classroom',
        category: 'ACADEMICS',
        iconName: 'GraduationCap',
        viewType: 'CUSTOM_CLASSROOM',
        displayOrder: 7,
      },

      // HARDWARE
      {
        capabilityId: 'counter_pos',
        defaultNavLabel: 'Counter POS',
        category: 'SALES',
        iconName: 'ShoppingCart',
        viewType: 'ENTITY_LIST',
        displayOrder: 1,
        terminologyKey: 'transaction',
        entitySchema: [
          { name: 'itemName', label: 'Item / Material', type: 'string', required: true },
          { name: 'unitPrice', label: 'Unit Price', type: 'number', required: true },
          { name: 'quantity', label: 'Quantity', type: 'number', required: true },
        ],
      },
      {
        capabilityId: 'pos_register',
        defaultNavLabel: 'POS Register',
        category: 'SALES',
        iconName: 'ShoppingCart',
        viewType: 'ENTITY_LIST',
        displayOrder: 1,
        terminologyKey: 'sales',
        entitySchema: [
          { name: 'itemName', label: 'Item Name', type: 'string', required: true },
          { name: 'unitPrice', label: 'Unit Price', type: 'number', required: true },
          { name: 'quantity', label: 'Quantity', type: 'number', required: true },
        ],
      },
      {
        capabilityId: 'stock_control',
        defaultNavLabel: 'Yard Inventory',
        category: 'INVENTORY',
        iconName: 'Package',
        viewType: 'ENTITY_LIST',
        displayOrder: 2,
        terminologyKey: 'stock',
        entitySchema: [
          { name: 'skuCode', label: 'SKU / Material Code', type: 'string', required: true },
          { name: 'itemName', label: 'Item Name', type: 'string', required: true },
          { name: 'quantityOnHand', label: 'Stock Quantity', type: 'number', required: true },
          { name: 'unitPrice', label: 'Unit Price (KES)', type: 'number', required: true },
        ],
      },
      {
        capabilityId: 'inventory_catalog',
        defaultNavLabel: 'Inventory Catalog',
        category: 'INVENTORY',
        iconName: 'Package',
        viewType: 'ENTITY_LIST',
        displayOrder: 2,
        terminologyKey: 'inventory',
        entitySchema: [
          { name: 'productName', label: 'Product Name', type: 'string', required: true },
          { name: 'stockCount', label: 'Stock Count', type: 'number', required: true },
          { name: 'unitCost', label: 'Unit Cost', type: 'number', required: true },
        ],
      },
      {
        capabilityId: 'quotations',
        defaultNavLabel: 'Quotations & Proformas',
        category: 'SALES',
        iconName: 'FileText',
        viewType: 'ENTITY_LIST',
        displayOrder: 3,
        terminologyKey: 'contract',
      },
      {
        capabilityId: 'mpesa_till',
        defaultNavLabel: 'Till Integration',
        category: 'FINANCE',
        iconName: 'CreditCard',
        viewType: 'OPERATIONAL_FLOW',
        displayOrder: 4,
      },

      // RETAIL
      {
        capabilityId: 'barcode_pos',
        defaultNavLabel: 'Barcode Checkout',
        category: 'POS',
        iconName: 'Barcode',
        viewType: 'ENTITY_LIST',
        displayOrder: 1,
        terminologyKey: 'transaction',
      },
      {
        capabilityId: 'sku_inventory',
        defaultNavLabel: 'SKU Inventory',
        category: 'INVENTORY',
        iconName: 'Boxes',
        viewType: 'ENTITY_LIST',
        displayOrder: 2,
        terminologyKey: 'product',
      },
      {
        capabilityId: 'till_reconciliation',
        defaultNavLabel: 'Till Reconciliation',
        category: 'FINANCE',
        iconName: 'Receipt',
        viewType: 'OPERATIONAL_FLOW',
        displayOrder: 3,
      },

      // LOGISTICS
      {
        capabilityId: 'waybill_booking',
        defaultNavLabel: 'Waybills & Cargo',
        category: 'SHIPMENT',
        iconName: 'FileText',
        viewType: 'ENTITY_LIST',
        displayOrder: 1,
        terminologyKey: 'contract',
        entitySchema: [
          { name: 'waybillNo', label: 'Waybill Number', type: 'string', required: true },
          { name: 'consignor', label: 'Consignor (Sender)', type: 'string', required: true },
          { name: 'consignee', label: 'Consignee (Receiver)', type: 'string', required: true },
          { name: 'destinationDepot', label: 'Destination Depot', type: 'string', required: true },
        ],
      },
      {
        capabilityId: 'pod_tracking',
        defaultNavLabel: 'Proof of Delivery',
        category: 'DISPATCH',
        iconName: 'CheckCircle2',
        viewType: 'OPERATIONAL_FLOW',
        displayOrder: 2,
      },
      {
        capabilityId: 'driver_assignment',
        defaultNavLabel: 'Fleet & Driver Dispatch',
        category: 'DISPATCH',
        iconName: 'Truck',
        viewType: 'ENTITY_LIST',
        displayOrder: 3,
      },
      {
        capabilityId: 'logistics_fleet',
        defaultNavLabel: 'Fleet Dispatch',
        category: 'LOGISTICS',
        iconName: 'Truck',
        viewType: 'ENTITY_LIST',
        displayOrder: 4,
        terminologyKey: 'fleet',
        entitySchema: [
          { name: 'vehicleReg', label: 'Vehicle Reg Number', type: 'string', required: true },
          { name: 'driverName', label: 'Driver Name', type: 'string', required: true },
          { name: 'status', label: 'Status', type: 'string', required: true, options: ['IDLE', 'IN_TRANSIT', 'MAINTENANCE'] },
        ],
      },

      // HEALTHCARE
      {
        capabilityId: 'patient_queue',
        defaultNavLabel: 'Triage Queue',
        category: 'TRIAGE',
        iconName: 'UserCheck',
        viewType: 'ENTITY_LIST',
        displayOrder: 1,
        terminologyKey: 'customer',
        entitySchema: [
          { name: 'patientNumber', label: 'Patient Number (OPD)', type: 'string', required: true },
          { name: 'fullName', label: 'Full Name', type: 'string', required: true },
          { name: 'triageCategory', label: 'Triage Level (URGENT/ROUTINE)', type: 'string', required: true },
        ],
      },
      {
        capabilityId: 'clinic_patients',
        defaultNavLabel: 'Patient Records',
        category: 'CLINICAL',
        iconName: 'UserCheck',
        viewType: 'ENTITY_LIST',
        displayOrder: 2,
        terminologyKey: 'patients',
        entitySchema: [
          { name: 'patientName', label: 'Patient Name', type: 'string', required: true },
          { name: 'age', label: 'Age', type: 'number', required: true },
          { name: 'diagnosis', label: 'Primary Diagnosis', type: 'string', required: true },
        ],
      },
      {
        capabilityId: 'emr_consultation',
        defaultNavLabel: 'EMR Consultation',
        category: 'CLINICAL',
        iconName: 'Stethoscope',
        viewType: 'ENTITY_LIST',
        displayOrder: 3,
      },
      {
        capabilityId: 'pharmacy_dispensing',
        defaultNavLabel: 'Pharmacy Dispense',
        category: 'PHARMACY',
        iconName: 'Pill',
        viewType: 'ENTITY_LIST',
        displayOrder: 4,
      },
      {
        capabilityId: 'medical_billing',
        defaultNavLabel: 'Medical Billing',
        category: 'FINANCE',
        iconName: 'CreditCard',
        viewType: 'ENTITY_LIST',
        displayOrder: 5,
      },

      // HOSPITALITY
      {
        capabilityId: 'room_reservations',
        defaultNavLabel: 'Room Reservations',
        category: 'HOSPITALITY',
        iconName: 'Hotel',
        viewType: 'ENTITY_LIST',
        displayOrder: 1,
      },
      {
        capabilityId: 'restaurant_pos',
        defaultNavLabel: 'Restaurant & Bar POS',
        category: 'SALES',
        iconName: 'Utensils',
        viewType: 'ENTITY_LIST',
        displayOrder: 2,
      },

      // BEAUTY
      {
        capabilityId: 'salon_pos',
        defaultNavLabel: 'Salon Checkout',
        category: 'SALES',
        iconName: 'Scissors',
        viewType: 'ENTITY_LIST',
        displayOrder: 1,
      },

      // PROFESSIONAL SERVICES
      {
        capabilityId: 'case_management',
        defaultNavLabel: 'Matters & Cases',
        category: 'OPERATIONS',
        iconName: 'Briefcase',
        viewType: 'ENTITY_LIST',
        displayOrder: 1,
      },
    ];

    for (const d of defaults) {
      this.definitions.set(d.capabilityId, d);
    }
  }

  public registerViewDefinition(def: CapabilityViewDefinition): void {
    this.definitions.set(def.capabilityId, def);
  }

  public getViewDefinition(capabilityId: string): CapabilityViewDefinition | undefined {
    return this.definitions.get(capabilityId) || {
      capabilityId,
      defaultNavLabel: capabilityId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      category: 'GENERAL',
      iconName: 'FileText',
      viewType: 'ENTITY_LIST',
      displayOrder: 10,
    };
  }

  public getAllDefinitions(): CapabilityViewDefinition[] {
    return Array.from(this.definitions.values());
  }
}

export const capabilityViewRegistry = CapabilityViewRegistry.getInstance();
