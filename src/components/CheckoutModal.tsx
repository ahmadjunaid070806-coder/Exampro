import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Lock,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import type { AppSettings, PaymentOrder } from '../types';
import { apiFetch } from '../lib/api';

interface RazorpaySuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: RazorpaySuccessPayload) => void | Promise<void>;
  modal?: {
    ondismiss?: () => void;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
      on?: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
    };
  }
}

interface Props {
  itemType: 'test' | 'bundle';
  itemId: number;
  itemTitle: string;
  price: number;
  settings: AppSettings;
  onClose: () => void;
  onSuccess: (order: PaymentOrder, updatedUser: unknown) => void;
  onToast: (msg: string) => void;
}

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let activeRazorpayLoad: Promise<boolean> | null = null;

function loadRazorpayScript(timeoutMs = 10000): Promise<boolean> {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }
  if (window.Razorpay) {
    return Promise.resolve(true);
  }
  if (activeRazorpayLoad) {
    return activeRazorpayLoad;
  }

  activeRazorpayLoad = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT_SRC}"]`
    );

    const injectFreshScript = () => {
      let settled = false;
      const script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_SRC;
      script.async = true;
      script.setAttribute('data-rzp-status', 'loading');

      const finish = (ok: boolean, status: 'loaded' | 'error') => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        script.setAttribute('data-rzp-status', status);
        activeRazorpayLoad = null;
        resolve(ok);
      };

      const timer = window.setTimeout(() => {
        finish(Boolean(window.Razorpay), window.Razorpay ? 'loaded' : 'error');
      }, timeoutMs);

      script.onload = () => finish(Boolean(window.Razorpay), window.Razorpay ? 'loaded' : 'error');
      script.onerror = () => {
        script.remove();
        finish(false, 'error');
      };
      document.head.appendChild(script);
    };

    if (existing) {
      const status = existing.getAttribute('data-rzp-status');
      if (status === 'error' || status === 'loaded') {
        existing.remove();
        injectFreshScript();
        return;
      }

      // Existing script tag (e.g. from index.html) may still be loading or may have silently failed
      let settled = false;
      const finishExisting = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        activeRazorpayLoad = null;
        if (!ok && !window.Razorpay) {
          existing.remove();
        }
        resolve(ok);
      };

      const timer = window.setTimeout(() => {
        if (window.Razorpay) {
          finishExisting(true);
        } else {
          existing.remove();
          injectFreshScript();
        }
      }, Math.min(4000, timeoutMs));

      existing.addEventListener('load', () => finishExisting(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener('error', () => {
        existing.remove();
        injectFreshScript();
      }, { once: true });
      return;
    }

    injectFreshScript();
  });

  return activeRazorpayLoad;
}

export const CheckoutModal: React.FC<Props> = ({
  itemType,
  itemId,
  itemTitle,
  price,
  settings,
  onClose,
  onSuccess,
  onToast,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadRazorpayScript();
  }, []);

  const finalAmount = Math.max(0, price - discount);

  const handleApplyCoupon = async () => {
    setCouponMsg(null);
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    try {
      const res = await apiFetch<{ discount: number; finalAmount: number; coupon: { code: string } }>(
        '/api/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({ code, amount: price }),
        }
      );
      setDiscount(res.discount);
      setAppliedCoupon(res.coupon.code);
      setCouponMsg({
        ok: true,
        text:
          res.finalAmount === 0
            ? `Coupon ${res.coupon.code} applied! 100% Free instant unlock ready.`
            : `Coupon ${res.coupon.code} applied! You saved ₹${res.discount}.`,
      });
    } catch (err: unknown) {
      setDiscount(0);
      setAppliedCoupon(null);
      setCouponMsg({ ok: false, text: err instanceof Error ? err.message : 'Invalid coupon.' });
    }
  };

  const handlePayWithRazorpay = async () => {
    if (submitting || verifying) return;
    setError('');
    setSubmitting(true);

    const controller = new AbortController();
    const requestTimeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const orderRes = await apiFetch<{
        freeUnlock?: boolean;
        order: PaymentOrder;
        user?: unknown;
        key?: string;
        keyId?: string;
        order_id?: string;
        razorpay_order_id?: string;
        razorpayOrderId?: string;
        amount?: number;
        finalAmount?: number;
        currency?: string;
        error?: string;
        message?: string;
        prefill?: { name?: string; email?: string; contact?: string };
      }>('/api/v1/payments/create-order', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          itemType,
          itemId,
          test_id: itemType === 'test' ? itemId : undefined,
          bundle_id: itemType === 'bundle' ? itemId : undefined,
          couponCode: appliedCoupon || undefined,
        }),
      });
      window.clearTimeout(requestTimeout);

      if (orderRes.freeUnlock && orderRes.user) {
        setSubmitting(false);
        onSuccess(orderRes.order, orderRes.user);
        return;
      }

      const resolvedOrderId =
        orderRes.razorpayOrderId || orderRes.order_id || orderRes.razorpay_order_id || '';
      const resolvedKeyId = orderRes.keyId || orderRes.key || '';

      if (!resolvedOrderId || !resolvedKeyId) {
        console.error('Invalid Razorpay create-order response:', orderRes);
        throw new Error(
          orderRes.error ||
            orderRes.message ||
            'Could not initialize Razorpay order: missing order_id or key.'
        );
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error(
          'Unable to load Razorpay Checkout SDK. Check your connection or popup settings and try again.'
        );
      }

      const razorpayOrderId = resolvedOrderId;

      try {
        const rzp = new window.Razorpay({
          key: resolvedKeyId,
          amount: orderRes.amount ?? finalAmount * 100,
          currency: orderRes.currency || 'INR',
          name: settings.upi.payeeName || 'ExamPro',
          description: `${itemType === 'bundle' ? 'Bundle' : 'Mock Test'}: ${itemTitle}`,
          order_id: razorpayOrderId,
          prefill: orderRes.prefill,
          theme: { color: '#4F46E5' },
          handler: async (response: RazorpaySuccessPayload) => {
            setVerifying(true);
            setSubmitting(false);
            setError('');
            try {
              const verifyRes = await apiFetch<{
                status: string;
                order: PaymentOrder;
                user: unknown;
              }>('/api/v1/payments/verify', {
                method: 'POST',
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              onToast('Payment verified via Razorpay! Access unlocked immediately.');
              onSuccess(verifyRes.order, verifyRes.user);
            } catch (verifyErr: unknown) {
              const msg =
                verifyErr instanceof Error
                  ? verifyErr.message
                  : 'Payment signature verification failed.';
              setError(msg);
              onToast(msg);
            } finally {
              setVerifying(false);
            }
          },
          modal: {
            ondismiss: () => {
              setSubmitting(false);
              setError('Payment cancelled before completion. No amount was charged.');
            },
          },
        });

        rzp.on?.('payment.failed', (resp) => {
          setSubmitting(false);
          const failMsg = resp?.error?.description || 'Razorpay payment failed. Please try again.';
          setError(failMsg);
          onToast(failMsg);
          void apiFetch('/api/v1/payments/mark-failed', {
            method: 'POST',
            body: JSON.stringify({ razorpay_order_id: razorpayOrderId }),
          }).catch(() => {});
        });

        // Trigger Razorpay Checkout immediately and clear "Opening Razorpay..." state
        // so the modal button never remains stuck if popup/overlay is blocked or closed externally.
        rzp.open();
        setSubmitting(false);
      } catch (sdkErr: unknown) {
        const msg =
          sdkErr instanceof Error ? sdkErr.message : 'Unable to launch Razorpay Checkout.';
        setError(msg);
        onToast(msg);
        setSubmitting(false);
      }
    } catch (err: unknown) {
      window.clearTimeout(requestTimeout);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const msg = isTimeout
        ? 'Payment server timed out while creating order. Please try again.'
        : err instanceof Error
        ? err.message
        : 'Failed to open Razorpay checkout.';
      setError(msg);
      onToast(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              Razorpay Checkout
            </p>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {itemTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Price Breakdown */}
        <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Payable Amount</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                ₹{finalAmount}
              </span>
              {discount > 0 && (
                <span className="text-xs text-slate-400 line-through tabular-nums">₹{price}</span>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-slate-600 dark:text-slate-300">
            <div className="font-semibold">Instant Auto-Unlock</div>
            <div>{itemType === 'bundle' ? 'Bundle Pack' : 'Single Test'}</div>
          </div>
        </div>

        {/* Coupon Input */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
            <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Have a Coupon Code?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-white uppercase focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              className="btn-press rounded-xl bg-slate-900 dark:bg-indigo-600 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              Apply Coupon
            </button>
          </div>
          {couponMsg && (
            <p
              className={`mt-1.5 text-xs font-medium ${
                couponMsg.ok
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {couponMsg.text}
            </p>
          )}
        </div>

        {finalAmount === 0 ? (
          <div className="mt-5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-1.5" />
            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              100% Discount Applied — ₹0 Payable
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
              Click below to unlock immediately!
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={handlePayWithRazorpay}
              className="btn-press mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Unlocking...' : 'Unlock Now for ₹0'}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Secured by Razorpay. Instant automatic access upon payment verification.
              </span>
            </p>

            {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

            <button
              type="button"
              disabled={submitting || verifying}
              onClick={handlePayWithRazorpay}
              className="btn-press w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting || verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{verifying ? 'Verifying Payment...' : 'Opening Razorpay...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Pay with Razorpay</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
