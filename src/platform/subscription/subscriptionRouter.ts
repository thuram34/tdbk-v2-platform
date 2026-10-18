/**
 * TDBK V2 — SUBSCRIPTION HTTP BOUNDARY
 * Authentication and Master authorization are enforced before commercial mutations.
 */
import { Router, Request, Response } from 'express';
import { securityContextFactory } from '../../kernel/context/contextFactory';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { subscriptionService } from './subscriptionService';
import { subscriptionRepository } from '../../persistence/firestore/repositories/subscriptionRepository';
import { dbkRegistry } from '../dbkRegistry';
import { mpesaBridge } from '../../orchestration/bridge/adapters/mpesaBridge';

export const subscriptionRouter = Router();

const contextFor = (req: Request) => securityContextFactory.createSecurityContext({
  authHeader: req.headers.authorization,
  targetTenantId: req.params.dbkId || req.body?.dbkId,
  ipAddress: req.ip,
});

const sendError = (res: Response, error: unknown) => {
  if (error instanceof KernelError) return res.status(error.statusCode).json(error.toJSON());
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Subscription operation failed.' } });
};

subscriptionRouter.get('/:dbkId', async (req, res) => {
  try {
    const context = await contextFor(req);
    await dbkRegistry.getDbk(context, req.params.dbkId);
    const subscriptions = await subscriptionRepository.listSubscriptions(req.params.dbkId);
    return res.json({ subscriptions });
  } catch (error) { return sendError(res, error); }
});

subscriptionRouter.post('/', async (req, res) => {
  try {
    const context = await contextFor(req);
    const subscription = await subscriptionService.createSubscription(context, req.body);
    return res.status(201).json({ subscription });
  } catch (error) { return sendError(res, error); }
});


subscriptionRouter.post('/:dbkId/checkout', async (req, res) => {
  try {
    const context = await contextFor(req);
    const dbkId = req.params.dbkId;
    const tier = req.body?.tier;
    const allowedTiers = ['FOUNDATION', 'GROWTH', 'PRO', 'ENTERPRISE'] as const;
    if (!allowedTiers.includes(tier)) {
      return res.status(400).json({ error: { code: 'INVALID_TIER', message: 'Choose a valid paid TDBK tier.' } });
    }
    const priceKey = `TDBK_TIER_PRICE_KES_${tier}`;
    const configuredAmount = process.env[priceKey];
    if (!configuredAmount || !/^\\d+$/.test(configuredAmount) || !Number.isSafeInteger(Number(configuredAmount)) || Number(configuredAmount) <= 0) {
      return res.status(503).json({ error: { code: 'TIER_PRICE_NOT_CONFIGURED', message: `The server price for ${tier} is not configured. No payment was initiated.`, tier } });
    }
    const phoneNumber = String(req.body?.phoneNumber || '').trim();
    if (!/^254[17]\\d{8}$/.test(phoneNumber)) {
      return res.status(400).json({ error: { code: 'INVALID_PHONE_NUMBER', message: 'Use a Kenyan M-Pesa number in 2547XXXXXXXX or 2541XXXXXXXX format.' } });
    }
    await dbkRegistry.getDbk(context, dbkId);
    const correlationId = context.correlationId || context.requestId;
    const subscription = await subscriptionService.createOwnerCheckoutSubscription(context, {
      dbkId,
      tier,
      amount: Number(configuredAmount),
      currency: 'KES',
      interval: req.body?.interval === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
      correlationId,
    });
    try {
      const payment = await mpesaBridge.execute(context, 'STK_PUSH', {
        phoneNumber,
        amount: subscription.amount,
        accountReference: `TDBK-${dbkId}-${subscription.subscriptionId}`,
        transactionDesc: `TDBK subscription ${subscription.tier}`,
      });
      await subscriptionRepository.updateSubscriptionForDbk(dbkId, subscription.subscriptionId, {
        paymentReference: payment.providerReference,
        provider: payment.provider || 'SAFARICOM_MPESA',
        paymentStatus: 'PENDING',
        status: 'TRIAL',
      });
      return res.status(202).json({ subscriptionId: subscription.subscriptionId, tier: subscription.tier, amount: subscription.amount, currency: 'KES', payment });
    } catch (paymentError) {
      await subscriptionRepository.updateSubscriptionForDbk(dbkId, subscription.subscriptionId, { paymentStatus: 'FAILED', status: 'PAST_DUE' });
      throw paymentError;
    }
  } catch (error) { return sendError(res, error); }
});

subscriptionRouter.post('/:dbkId/:subscriptionId/pay', async (req, res) => {
  try {
    const context = await contextFor(req);
    const dbkId = req.params.dbkId;
    const subscriptionId = req.params.subscriptionId;
    const subscription = await subscriptionRepository.getSubscriptionForDbk(dbkId, subscriptionId);
    if (!subscription) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
    if (subscription.dbkId !== context.tenantContext?.tenantId) {
      return res.status(403).json({ error: { code: 'TENANT_ISOLATION_ERROR', message: 'Subscription tenant mismatch' } });
    }
    if (subscription.paymentStatus === 'PAID' && subscription.status === 'ACTIVE') {
      return res.status(409).json({ error: { code: 'ALREADY_PAID', message: 'Subscription is already active and paid' } });
    }
    const phoneNumber = String(req.body?.phoneNumber || '');
    const result = await mpesaBridge.execute(context, 'STK_PUSH', {
      phoneNumber,
      amount: subscription.amount,
      accountReference: `TDBK-${dbkId}-${subscriptionId}`,
      transactionDesc: `TDBK subscription ${subscription.tier}`,
    });
    await subscriptionRepository.updateSubscriptionForDbk(dbkId, subscriptionId, {
      paymentReference: result.providerReference,
      provider: result.provider,
      paymentStatus: 'PENDING',
      status: 'TRIAL',
    });
    return res.status(202).json({ subscriptionId, payment: result });
  } catch (error) { return sendError(res, error); }
});

subscriptionRouter.post('/:dbkId/:subscriptionId/activate', async (req, res) => {
  try {
    const context = await contextFor(req);
    const subscription = await subscriptionService.activateSubscription(context, req.params.subscriptionId, req.params.dbkId);
    return res.json({ subscription });
  } catch (error) { return sendError(res, error); }
});

subscriptionRouter.post('/:dbkId/:subscriptionId/cancel', async (req, res) => {
  try {
    const context = await contextFor(req);
    const subscription = await subscriptionService.cancelSubscription(context, req.params.subscriptionId, req.params.dbkId, req.body?.reason);
    return res.json({ subscription });
  } catch (error) { return sendError(res, error); }
});
