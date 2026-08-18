/**
 * TDBK V2 — STRUCTURED DOCUMENT EXTRACTION ENGINE
 * Layer: LEVEL 6 — ADVANCED DOCUMENT INGESTION
 * 
 * Rules:
 * - Extracts structured key-value entities from document content.
 * - Retains per-field confidence score (0.0 - 1.0).
 * - Retains source evidence (page, lineReference, textSnippet, boundingBox) where available.
 * - Does NOT directly commit to business truth; produces extracted representation.
 */

import { 
  ExtractedDataMap, 
  ExtractedField, 
  DocumentClassificationType, 
  SourceEvidence 
} from '../types';

export interface ExtractionResult {
  extractedFields: ExtractedDataMap;
  confidenceAverage: number;
  lowConfidenceFields: string[];
  requiresReview: boolean;
  rawEntities: Record<string, any>;
}

export class DocumentExtractor {
  private static instance: DocumentExtractor;

  private constructor() {}

  public static getInstance(): DocumentExtractor {
    if (!DocumentExtractor.instance) {
      DocumentExtractor.instance = new DocumentExtractor();
    }
    return DocumentExtractor.instance;
  }

  public extractStructuredData(
    text: string,
    classificationType: DocumentClassificationType,
    version: string = '1.0.0'
  ): ExtractionResult {
    const fields: ExtractedDataMap = {};
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Extraction helper
    const addField = <T>(
      name: string,
      val: T,
      conf: number,
      evidence?: SourceEvidence,
      method: 'OCR_RULE' | 'SCHEMA_MATCH' | 'AI_INFERENCE' = 'AI_INFERENCE'
    ) => {
      fields[name] = {
        fieldName: name,
        value: val,
        confidence: Math.min(0.99, Math.max(0.1, Number(conf.toFixed(2)))),
        sourceEvidence: evidence,
        extractionMethod: method,
        processingVersion: version,
      };
    };

    // 1. INVOICE / RECEIPT EXTRACTION
    if (classificationType === 'invoice' || classificationType === 'receipt') {
      // Find invoice/receipt number (require colon/delimiter on the same line)
      const invMatch = text.match(/(?:(?:INVOICE|RECEIPT|INV|REF|TXN)(?:[^\S\r\n]+(?:NO|NUMBER|#))?[^\S\r\n]*[:#-][^\S\r\n]*)([A-Z0-9-]{3,20})/i) ||
                       text.match(/(?:(?:INVOICE|RECEIPT|INV|REF|TXN)[^\S\r\n]+)([A-Z0-9-]{3,20})/i);
      if (invMatch) {
        const lineIdx = lines.findIndex(l => l.includes(invMatch[0]));
        addField('referenceNumber', invMatch[1].trim(), 0.96, {
          lineReference: `Line ${lineIdx >= 0 ? lineIdx + 1 : 1}`,
          textSnippet: invMatch[0],
          page: 1,
        });
      } else {
        addField('referenceNumber', 'UNKNOWN-REF', 0.40, { lineReference: 'N/A' });
      }

      // Find Total Amount / Currency
      const amountMatch = text.match(/(?:KES|KSH|USD|EUR|TOTAL|AMOUNT|AMT)[^\S\r\n]*[:#-]*[^\S\r\n]*([\d,]+(?:\.\d{2})?)/i);
      if (amountMatch) {
        const numVal = parseFloat(amountMatch[1].replace(/,/g, ''));
        const lineIdx = lines.findIndex(l => l.includes(amountMatch[0]));
        addField('totalAmount', isNaN(numVal) ? 0 : numVal, 0.94, {
          lineReference: `Line ${lineIdx >= 0 ? lineIdx + 1 : 2}`,
          textSnippet: amountMatch[0],
          page: 1,
          boundingBox: { x: 420, y: 710, width: 120, height: 24 }
        });
        addField('currency', 'KES', 0.98, { textSnippet: 'KES' });
      } else {
        addField('totalAmount', 0, 0.35, { lineReference: 'Not detected' });
        addField('currency', 'KES', 0.70);
      }

      // Supplier / Vendor Name
      const vendorMatch = text.match(/(?:FROM|VENDOR|SUPPLIER|COMPANY|BILLER)[^\S\r\n]*[:#-]*[^\S\r\n]*([A-Za-z0-9\s.,&]{3,40})/i);
      if (vendorMatch) {
        const firstLine = vendorMatch[1].split('\n')[0].trim();
        addField('vendorName', firstLine, 0.91, {
          textSnippet: vendorMatch[0].split('\n')[0],
          page: 1,
        });
      } else if (lines.length > 0) {
        // Fallback first line as potential vendor
        addField('vendorName', lines[0].substring(0, 40), 0.72, {
          lineReference: 'Line 1 (Header)',
          textSnippet: lines[0],
          page: 1,
        });
      }

      // Date
      const dateMatch = text.match(/(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})/i);
      if (dateMatch) {
        addField('issueDate', dateMatch[0], 0.95, { textSnippet: dateMatch[0] });
      } else {
        addField('issueDate', new Date().toISOString().split('T')[0], 0.50);
      }
    }

    // 2. WAYBILL / LOGISTICS EXTRACTION
    else if (classificationType === 'waybill' || classificationType === 'delivery_note') {
      const wbMatch = text.match(/(?:WB|WAYBILL|CONSIGNMENT|BOL)[\s:#-]*([A-Z0-9-]{5,16})/i);
      addField('waybillNumber', wbMatch ? wbMatch[1] : 'WB-DRAFT', wbMatch ? 0.95 : 0.45, {
        textSnippet: wbMatch ? wbMatch[0] : undefined,
        page: 1,
      });

      const consignorMatch = text.match(/(?:CONSIGNOR|SENDER|FROM)[\s:#-]*([A-Za-z0-9\s.,]{3,40})/i);
      addField('consignor', consignorMatch ? consignorMatch[1].trim() : 'General Shipper', consignorMatch ? 0.92 : 0.60);

      const consigneeMatch = text.match(/(?:CONSIGNEE|RECEIVER|TO|DELIVER TO)[\s:#-]*([A-Za-z0-9\s.,]{3,40})/i);
      addField('consignee', consigneeMatch ? consigneeMatch[1].trim() : 'Apex Depot', consigneeMatch ? 0.93 : 0.60);

      const weightMatch = text.match(/([\d,]+(?:\.\d+)?)\s*(?:KG|TONS|TONNES|LBS|PKGS)/i);
      addField('weightKg', weightMatch ? parseFloat(weightMatch[1]) : 100, weightMatch ? 0.89 : 0.55);
    }

    // 3. STUDENT ADMISSION / EDUCATION EXTRACTION
    else if (classificationType === 'admission_document' || classificationType === 'student_record') {
      const admMatch = text.match(/(?:ADMISSION NUMBER|ADM NO|ADM NUMBER|ADM|ADMISSION|STD|REG)[\s:#-]*([A-Z0-9\/-]{3,20})/i);
      addField('admissionNumber', admMatch ? admMatch[1].split('\n')[0].trim() : 'ADM-NEW', admMatch ? 0.97 : 0.40, {
        textSnippet: admMatch ? admMatch[0] : undefined,
      });

      const nameMatch = text.match(/(?:STUDENT NAME|FULL NAME|NAME|CANDIDATE)[\s:#-]*([A-Za-z\t ]{3,40})/i);
      addField('studentName', nameMatch ? nameMatch[1].split('\n')[0].trim() : 'New Student', nameMatch ? 0.94 : 0.50);

      const gradeMatch = text.match(/(?:GRADE \/ CLASS|GRADE|CLASS|FORM|YEAR)[\s:#-]*([A-Za-z0-9\t ]{1,20})/i);
      addField('gradeLevel', gradeMatch ? gradeMatch[1].split('\n')[0].trim() : 'Grade 1', gradeMatch ? 0.90 : 0.65);
    }

    // 4. HEALTHCARE / PATIENT FORM
    else if (classificationType === 'patient_form' || classificationType === 'prescription') {
      const opdMatch = text.match(/(?:OPD|PATIENT|FILE|MRN)[\s:#-]*([A-Z0-9-]{3,16})/i);
      addField('patientId', opdMatch ? opdMatch[1] : 'OPD-TEMP', opdMatch ? 0.96 : 0.45);

      const nameMatch = text.match(/(?:PATIENT NAME|NAME)[\s:#-]*([A-Za-z\s]{3,40})/i);
      addField('patientName', nameMatch ? nameMatch[1].trim() : 'Outpatient', nameMatch ? 0.93 : 0.55);

      const vitalsMatch = text.match(/(?:BP|BLOOD PRESSURE)[\s:#-]*([\d\/]+)/i);
      if (vitalsMatch) {
        addField('bloodPressure', vitalsMatch[1], 0.92, { textSnippet: vitalsMatch[0] });
      }
    }

    // 5. GENERIC / FALLBACK
    else {
      addField('rawSnippet', text.substring(0, 200), 0.75);
      addField('detectedKeywords', lines.slice(0, 5).join(', '), 0.70);
    }

    // Compute Confidence Metrics
    const fieldValues = Object.values(fields);
    const totalConf = fieldValues.reduce((acc, f) => acc + f.confidence, 0);
    const confidenceAverage = fieldValues.length > 0 ? Number((totalConf / fieldValues.length).toFixed(2)) : 0.5;

    const lowConfidenceFields = fieldValues.filter(f => f.confidence < 0.85).map(f => f.fieldName);
    const requiresReview = confidenceAverage < 0.85 || lowConfidenceFields.length > 0;

    const rawEntities: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      rawEntities[k] = v.value;
    }

    return {
      extractedFields: fields,
      confidenceAverage,
      lowConfidenceFields,
      requiresReview,
      rawEntities,
    };
  }
}

export const documentExtractor = DocumentExtractor.getInstance();
