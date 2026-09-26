/**
 * TDBK V2 DIGITAL SIGNING CAPABILITY CONTRACT
 * Provider-neutral API; external signing providers implement adapters.
 */
import {CapabilityApiContract,CapabilityExecutionContext,CapabilityOperationDefinition,CapabilityProviderAdapter} from './engineering';
export interface SigningRequest{documentId:string;signerId:string;reason?:string;metadata?:Record<string,unknown>}
export interface SigningResult{requestId:string;documentId:string;status:'PENDING'|'SIGNED'|'REJECTED'|'FAILED'|'REQUIRES_RECONCILIATION';providerReference?:string;signatureReference?:string}
export interface SignatureVerificationRequest{documentId:string;signatureReference:string}
export interface SignatureVerificationResult{valid:boolean;documentId:string;verifiedAt:string;providerReference?:string}
export interface SigningStatusRequest{requestId:string}
export interface SigningStatusResult{requestId:string;documentId:string;status:SigningResult['status'];providerReference?:string}
export type SigningProviderAdapter=CapabilityProviderAdapter;
const createOperation=<TRequest,TResponse>(operationId:string,description:string,execute:(context:CapabilityExecutionContext,request:TRequest)=>Promise<TResponse>):CapabilityOperationDefinition<TRequest,TResponse>=>({operationId,version:'1.0',description,idempotencyRequired:true,requestSchema:'tdbk://capability/digital-signing/'+operationId+'/request/v1',responseSchema:'tdbk://capability/digital-signing/'+operationId+'/response/v1',execute});
export const DIGITAL_SIGNING_OPERATIONS=[
 createOperation<SigningRequest,SigningResult>('SIGN_DOCUMENT','Create or submit a document signing request.',async()=>{throw new Error('SIGN_DOCUMENT requires a configured signing provider adapter')}),
 createOperation<SignatureVerificationRequest,SignatureVerificationResult>('VERIFY_SIGNATURE','Verify the authoritative signature state of a signed document.',async()=>{throw new Error('VERIFY_SIGNATURE requires a configured signing provider adapter')}),
 createOperation<SigningStatusRequest,SigningStatusResult>('GET_SIGNING_STATUS','Read authoritative signing state by TDBK signing request identity.',async()=>{throw new Error('GET_SIGNING_STATUS requires a configured signing provider adapter')})
] as const;
export const DIGITAL_SIGNING_CONTRACT:CapabilityApiContract={capabilityId:'capability_document_management',version:'2.0.0',configurationSchemaVersion:'1.0',operations:DIGITAL_SIGNING_OPERATIONS,providerBindings:[{operationId:'SIGN_DOCUMENT',providerId:'configured.signing',configurationKey:'signing.provider',enabled:true},{operationId:'VERIFY_SIGNATURE',providerId:'configured.signing',configurationKey:'signing.provider',enabled:true},{operationId:'GET_SIGNING_STATUS',providerId:'configured.signing',configurationKey:'signing.provider',enabled:true}],async execute(operationId,context,request){const operation=this.operations.find(candidate=>candidate.operationId===operationId);if(!operation)throw new Error('Unsupported signing operation: '+operationId);return operation.execute(context,request);}};
export function createSigningAdapter(adapter:SigningProviderAdapter):SigningProviderAdapter{if(adapter.capabilityId!==DIGITAL_SIGNING_CONTRACT.capabilityId)throw new Error("Signing adapter '"+adapter.providerId+"' is bound to '"+adapter.capabilityId+"', expected '"+DIGITAL_SIGNING_CONTRACT.capabilityId+"'");return adapter;}
