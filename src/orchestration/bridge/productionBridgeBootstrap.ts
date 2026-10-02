/**
 * Production bridge bootstrap.
 * Registers executable priority bridge adapters exactly once at process startup.
 * Tenant configuration remains durable and tenant-scoped in the Connection Hub.
 */
import { bridgeRegistry } from './registry';
import { MpesaBridge } from './adapters/mpesaBridge';
import { EtimsBridge } from './adapters/etimsBridge';
import { WhatsappBridge } from './adapters/whatsappBridge';

let bootstrapped = false;

export function bootstrapProductionBridges(): void {
  if (bootstrapped) return;

  bridgeRegistry.registerBridgeInstance(new MpesaBridge());
  bridgeRegistry.registerBridgeInstance(new EtimsBridge());
  bridgeRegistry.registerBridgeInstance(new WhatsappBridge());

  bootstrapped = true;
}

bootstrapProductionBridges();
