export interface VerticalWorkflowDefinition {
  capabilityId: string;
  requiredFields: string[];
  terminalStatuses: string[];
  allowedTransitions: Record<string, string[]>;
}

export const VERTICAL_WORKFLOW_CATALOG: VerticalWorkflowDefinition[] = [
  { capabilityId:'student_records', requiredFields:['admissionNo','fullName','classStream'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{ACTIVE:['COMPLETED','CANCELLED'],PENDING:['ACTIVE','CANCELLED']} },
  { capabilityId:'school_fee_structure', requiredFields:['feeName','amount','term'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['ACTIVE','CANCELLED'],ACTIVE:['COMPLETED','CANCELLED']} },
  { capabilityId:'cbc_grading', requiredFields:['studentId','subject','score'], terminalStatuses:['COMPLETED'], allowedTransitions:{PENDING:['COMPLETED']} },
  { capabilityId:'patient_queue', requiredFields:['patientNumber','fullName','triageCategory'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{ACTIVE:['WITH_DOCTOR','CANCELLED'],WITH_DOCTOR:['COMPLETED','CANCELLED'],LAB_QUEUED:['COMPLETED','CANCELLED']} },
  { capabilityId:'emr_consultation', requiredFields:['patientId','diagnosis','treatmentPlan'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['COMPLETED','CANCELLED'],ACTIVE:['COMPLETED','CANCELLED']} },
  { capabilityId:'pharmacy_dispensing', requiredFields:['patientId','medicine','quantity'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['COMPLETED','CANCELLED']} },
  { capabilityId:'medical_billing', requiredFields:['patientId','invoiceNumber','amount'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['PAID','CANCELLED'],PAID:['COMPLETED']} },
  { capabilityId:'room_reservations', requiredFields:['bookingRef','guestName','roomNumber','checkInDate','checkOutDate'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['CONFIRMED','CANCELLED'],CONFIRMED:['CHECKED_IN','CANCELLED'],CHECKED_IN:['COMPLETED']} },
  { capabilityId:'checkin_checkout', requiredFields:['bookingRef','guestName','roomNumber'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['CHECKED_IN','CANCELLED'],CHECKED_IN:['COMPLETED']} },
  { capabilityId:'guest_folio_billing', requiredFields:['bookingRef','amount','chargeType'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['POSTED','CANCELLED'],POSTED:['COMPLETED']} },
  { capabilityId:'housekeeping_status', requiredFields:['roomNumber','housekeeper','status'], terminalStatuses:['COMPLETED'], allowedTransitions:{DIRTY:['CLEANING'],CLEANING:['INSPECTED'],INSPECTED:['READY']} },
  { capabilityId:'appointment_booking', requiredFields:['clientName','service','appointmentDate','stylist'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['CONFIRMED','CANCELLED'],CONFIRMED:['IN_SERVICE','CANCELLED'],IN_SERVICE:['COMPLETED']} },
  { capabilityId:'salon_pos', requiredFields:['service','amount','clientName'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['COMPLETED','CANCELLED']} },
  { capabilityId:'stylist_commission', requiredFields:['stylist','saleId','commissionAmount'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['COMPLETED','CANCELLED']} },
  { capabilityId:'waybill_booking', requiredFields:['waybillNo','consignor','consignee','originDepot','destinationDepot'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{PENDING:['BOOKED','CANCELLED'],BOOKED:['IN_TRANSIT','CANCELLED'],IN_TRANSIT:['DELIVERED']} },
  { capabilityId:'driver_assignment', requiredFields:['waybillNo','driver','vehicle'], terminalStatuses:['COMPLETED'], allowedTransitions:{PENDING:['ASSIGNED'],ASSIGNED:['DISPATCHED'],DISPATCHED:['COMPLETED']} },
  { capabilityId:'pod_tracking', requiredFields:['waybillNo','recipientName','deliveredAt'], terminalStatuses:['COMPLETED'], allowedTransitions:{PENDING:['COMPLETED']} },
  { capabilityId:'case_management', requiredFields:['clientName','matterReference','matterType'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{OPEN:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['COMPLETED','CANCELLED']} },
  { capabilityId:'fee_note_invoicing', requiredFields:['clientName','feeNoteNumber','amount'], terminalStatuses:['COMPLETED','CANCELLED'], allowedTransitions:{DRAFT:['ISSUED','CANCELLED'],ISSUED:['PAID','CANCELLED'],PAID:['COMPLETED']} },
  { capabilityId:'time_billing', requiredFields:['matterReference','staff','hours'], terminalStatuses:['COMPLETED'], allowedTransitions:{DRAFT:['SUBMITTED'],SUBMITTED:['COMPLETED']} },
];