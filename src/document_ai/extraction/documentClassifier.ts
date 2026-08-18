/**
 * TDBK V2 — DOCUMENT CLASSIFICATION ENGINE
 * Layer: LEVEL 6 — ADVANCED DOCUMENT INGESTION
 * 
 * Rules:
 * - Identifies document type with explicit confidence score (0.0 - 1.0).
 * - Classification is a structured proposal, not infallible truth.
 * - Supports sector-specific types (School, Healthcare, Logistics, Hardware, Retail).
 */

import { DocumentClassification, DocumentClassificationType } from '../types';

export class DocumentClassifier {
  private static instance: DocumentClassifier;

  private constructor() {}

  public static getInstance(): DocumentClassifier {
    if (!DocumentClassifier.instance) {
      DocumentClassifier.instance = new DocumentClassifier();
    }
    return DocumentClassifier.instance;
  }

  public classifyDocument(text: string, fileName?: string): DocumentClassification {
    const lower = (text + ' ' + (fileName || '')).toLowerCase();

    // High-confidence pattern scoring
    const scores: Record<DocumentClassificationType, number> = {
      invoice: 0,
      receipt: 0,
      statement: 0,
      purchase_order: 0,
      student_record: 0,
      admission_document: 0,
      patient_form: 0,
      prescription: 0,
      delivery_note: 0,
      waybill: 0,
      contract: 0,
      identity_document: 0,
      report: 0,
      unknown: 0.1,
    };

    // Invoice patterns
    if (lower.includes('invoice') || lower.includes('tax invoice') || lower.includes('inv-') || lower.includes('amount due') || lower.includes('pin:')) {
      scores.invoice += 0.6;
    }
    if (lower.includes('bill to') || lower.includes('payment terms') || lower.includes('due date')) {
      scores.invoice += 0.35;
    }

    // Receipt patterns
    if (lower.includes('receipt') || lower.includes('mpesa') || lower.includes('m-pesa') || lower.includes('transaction code') || lower.includes('paid in full') || lower.includes('cash sale')) {
      scores.receipt += 0.65;
    }
    if (lower.includes('payment confirmation') || lower.includes('received from')) {
      scores.receipt += 0.3;
    }

    // Student / Admission
    if (lower.includes('admission') || lower.includes('enrollment') || lower.includes('student') || lower.includes('term') || lower.includes('grade') || lower.includes('school')) {
      if (lower.includes('admission') || lower.includes('admission form') || lower.includes('application for admission') || lower.includes('admission confirmation') || lower.includes('admission slip')) {
        scores.admission_document += 0.85;
      }
      scores.student_record += 0.75;
    }

    // Healthcare / Patient / Prescription
    if (lower.includes('patient') || lower.includes('clinic') || lower.includes('diagnosis') || lower.includes('triage') || lower.includes('doctor') || lower.includes('hospital')) {
      if (lower.includes('rx') || lower.includes('prescription') || lower.includes('dosage') || lower.includes('dispense')) {
        scores.prescription += 0.75;
      } else {
        scores.patient_form += 0.7;
      }
    }

    // Logistics / Waybill / Delivery
    if (lower.includes('waybill') || lower.includes('consignment') || lower.includes('consignee') || lower.includes('consignor') || lower.includes('cargo') || lower.includes('transit')) {
      scores.waybill += 0.75;
    }
    if (lower.includes('delivery note') || lower.includes('goods received') || lower.includes('dispatch note')) {
      scores.delivery_note += 0.7;
    }

    // Purchase Order
    if (lower.includes('purchase order') || lower.includes('po number') || lower.includes('p.o.')) {
      scores.purchase_order += 0.75;
    }

    // Identity
    if (lower.includes('national id') || lower.includes('passport') || lower.includes('huduma') || lower.includes('kra pin')) {
      scores.identity_document += 0.7;
    }

    // Statement
    if (lower.includes('account statement') || lower.includes('statement of account') || lower.includes('ledger statement')) {
      scores.statement += 0.7;
    }

    // Determine highest scoring classification
    let bestType: DocumentClassificationType = 'unknown';
    let maxScore = 0.2;

    const secondary: Array<{ type: DocumentClassificationType; confidence: number }> = [];

    for (const [type, score] of Object.entries(scores) as Array<[DocumentClassificationType, number]>) {
      const capped = Math.min(0.99, Number(score.toFixed(2)));
      if (capped > maxScore) {
        if (bestType !== 'unknown') {
          secondary.push({ type: bestType, confidence: maxScore });
        }
        maxScore = capped;
        bestType = type;
      } else if (capped > 0.3) {
        secondary.push({ type, confidence: capped });
      }
    }

    return {
      type: bestType,
      confidence: maxScore,
      secondaryTypes: secondary.slice(0, 2),
      detectedLanguage: 'en-KE',
      classificationVersion: '1.0.0',
      classifiedAt: new Date().toISOString(),
    };
  }
}

export const documentClassifier = DocumentClassifier.getInstance();
