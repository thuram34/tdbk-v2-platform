/**
 * Production bridge bootstrap.
 * Registers executable priority bridge adapters exactly once at process startup.
 * Tenant configuration remains durable and tenant-scoped in the Connection Hub.
 */
import { bridgeRegistry } from './registry';
import { MpesaBridge } from './adapters/mpesaBridge';
import { EtimsBridge } from './adapters/etimsBridge';
import { WhatsappBridge } from './adapters/whatsappBridge';
import { SmsBridge } from './adapters/smsBridge';
import { EmailBridge } from './adapters/emailBridge';

let bootstrapped = false;

export function bootstrapProductionBridges(): void {
  if (bootstrapped) return;

  bridgeRegistry.registerBridgeInstance(new MpesaBridge());
  bridgeRegistry.registerBridgeInstance(new EtimsBridge());
  bridgeRegistry.registerBridgeInstance(new WhatsappBridge());
  bridgeRegistry.registerBridgeInstance(new SmsBridge());
  bridgeRegistry.registerBridgeInstance(new EmailBridge());

  bootstrapped = true;
}

bootstrapProductionBridges();
