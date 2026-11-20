import type { MembershipPlan } from './types.ts';

export const MEMBERSHIP_DISCOUNT_MIGRATION_SQL = `-- Crazy Storyes: Membership Plans Original Price & Discount Columns Migration
-- Safe to run on existing databases (preserves all existing plans and data)

ALTER TABLE IF EXISTS public.membership_plans
  ADD COLUMN IF NOT EXISTS original_price NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill original_price for existing plans where it is NULL
UPDATE public.membership_plans
SET original_price = price
WHERE original_price IS NULL;
`;

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatPriceINR(value: number): string {
  const rounded = roundCurrency(Number(value) || 0);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export interface PlanValidationResult {
  ok: true;
  plan: MembershipPlan;
}

export interface PlanValidationError {
  ok: false;
  error: string;
}

export function validateAndNormalizePlanInput(
  rawInput: any,
  options?: { planId?: string; isNew?: boolean }
): PlanValidationResult | PlanValidationError {
  if (!rawInput || typeof rawInput !== 'object') {
    return { ok: false, error: 'अमान्य प्लान डेटा प्राप्त हुआ है।' };
  }

  const rawId = options?.planId || rawInput.id;
  const id =
    typeof rawId === 'string' && rawId.trim()
      ? rawId.trim()
      : options?.isNew
        ? `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        : '';

  if (!id) {
    return { ok: false, error: 'प्लान ID आवश्यक है।' };
  }
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(id)) {
    return { ok: false, error: 'अमान्य प्लान ID फॉर्मेट।' };
  }

  const name = typeof rawInput.name === 'string' ? rawInput.name.trim() : '';
  const hindiName = typeof rawInput.hindiName === 'string' ? rawInput.hindiName.trim() : '';
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: 'Membership Name कम से कम 2 और अधिकतम 100 अक्षरों का होना चाहिए।' };
  }
  if (hindiName.length < 2 || hindiName.length > 100) {
    return { ok: false, error: 'Hindi Name कम से कम 2 और अधिकतम 100 अक्षरों का होना चाहिए।' };
  }

  const rawDuration = Number(rawInput.durationDays);
  if (!Number.isFinite(rawDuration) || !Number.isInteger(rawDuration) || rawDuration < 1 || rawDuration > 3650) {
    return { ok: false, error: 'Membership Duration (Days) 1 से 3650 के बीच एक पूर्ण संख्या होनी चाहिए।' };
  }

  const description = typeof rawInput.description === 'string' ? rawInput.description.trim() : '';
  if (description.length < 4 || description.length > 600) {
    return { ok: false, error: 'Description कम से कम 4 और अधिकतम 600 अक्षरों का होना चाहिए।' };
  }

  const rawFeatures = Array.isArray(rawInput.features) ? rawInput.features : [];
  const features = rawFeatures
    .map((f: any) => (typeof f === 'string' ? f.trim() : ''))
    .filter((f: string) => f.length > 0);

  if (features.length === 0) {
    return { ok: false, error: 'कृपया कम से कम 1 Feature जोड़ें।' };
  }

  const badgeTextRaw = typeof rawInput.badgeText === 'string' ? rawInput.badgeText.trim() : '';
  if (badgeTextRaw.length > 30) {
    return { ok: false, error: 'Badge Text अधिकतम 30 अक्षरों का हो सकता है।' };
  }

  const hasOriginalInput =
    rawInput.originalPrice !== undefined &&
    rawInput.originalPrice !== null &&
    rawInput.originalPrice !== '';
  const hasPriceInput =
    rawInput.price !== undefined &&
    rawInput.price !== null &&
    rawInput.price !== '';

  if (!hasOriginalInput && !hasPriceInput) {
    return { ok: false, error: 'Original Price या Selling Price आवश्यक है।' };
  }

  const originalPrice = roundCurrency(
    hasOriginalInput ? Number(rawInput.originalPrice) : Number(rawInput.price)
  );
  if (!Number.isFinite(originalPrice) || originalPrice <= 0 || originalPrice > 1000000) {
    return { ok: false, error: 'Original Price ₹0 से अधिक और ₹10,00,000 के भीतर होनी चाहिए।' };
  }

  const rawPct =
    rawInput.discountPercentage !== undefined &&
    rawInput.discountPercentage !== null &&
    rawInput.discountPercentage !== ''
      ? Number(rawInput.discountPercentage)
      : 0;
  const rawAmt =
    rawInput.discountAmount !== undefined &&
    rawInput.discountAmount !== null &&
    rawInput.discountAmount !== ''
      ? Number(rawInput.discountAmount)
      : 0;

  if (!Number.isFinite(rawPct) || rawPct < 0) {
    return { ok: false, error: 'Discount Percentage नकारात्मक या अमान्य नहीं हो सकता।' };
  }
  if (!Number.isFinite(rawAmt) || rawAmt < 0) {
    return { ok: false, error: 'Discount Amount नकारात्मक या अमान्य नहीं हो सकता।' };
  }

  if (rawPct > 0 && rawAmt > 0) {
    return {
      ok: false,
      error: 'एक ही समय पर Percentage और Fixed Amount Discount दोनों लागू नहीं किए जा सकते।'
    };
  }

  const requestedType =
    rawInput.discountType === 'percentage' || rawInput.discountType === 'fixed' || rawInput.discountType === 'none'
      ? rawInput.discountType
      : undefined;

  if (requestedType === 'percentage' && rawAmt > 0) {
    return {
      ok: false,
      error: 'Percentage Discount के साथ Fixed Discount Amount लागू नहीं किया जा सकता।'
    };
  }
  if (requestedType === 'fixed' && rawPct > 0) {
    return {
      ok: false,
      error: 'Fixed Amount Discount के साथ Percentage Discount लागू नहीं किया जा सकता।'
    };
  }
  if (requestedType === 'none' && (rawPct > 0 || rawAmt > 0)) {
    return {
      ok: false,
      error: 'जब Discount बंद ("none") है, तो Discount मान 0 होना चाहिए।'
    };
  }

  let discountType: 'none' | 'percentage' | 'fixed' = 'none';
  let discountPercentage = 0;
  let discountAmount = 0;

  if (requestedType === 'percentage' || (!requestedType && rawPct > 0)) {
    if (rawPct <= 0) {
      discountType = 'none';
    } else if (rawPct >= 100) {
      return {
        ok: false,
        error: 'Discount Percentage 100% से कम होना चाहिए ताकि अंतिम कीमत ₹0 से अधिक रहे।'
      };
    } else {
      discountType = 'percentage';
      discountPercentage = roundCurrency(rawPct);
    }
  } else if (requestedType === 'fixed' || (!requestedType && rawAmt > 0)) {
    if (rawAmt <= 0) {
      discountType = 'none';
    } else if (rawAmt >= originalPrice) {
      return {
        ok: false,
        error: 'Discount Amount मूल कीमत (Original Price) से कम होना चाहिए।'
      };
    } else {
      discountType = 'fixed';
      discountAmount = roundCurrency(rawAmt);
    }
  }

  let computedFinalPrice = originalPrice;
  if (discountType === 'percentage') {
    computedFinalPrice = roundCurrency(originalPrice - (originalPrice * discountPercentage) / 100);
  } else if (discountType === 'fixed') {
    computedFinalPrice = roundCurrency(originalPrice - discountAmount);
  }

  if (!Number.isFinite(computedFinalPrice) || computedFinalPrice <= 0) {
    return { ok: false, error: 'अंतिम बिक्री मूल्य ₹0 से अधिक होना चाहिए।' };
  }

  if (hasPriceInput) {
    const clientPrice = roundCurrency(Number(rawInput.price));
    if (!Number.isFinite(clientPrice) || clientPrice <= 0) {
      return { ok: false, error: 'अमान्य Current Selling Price।' };
    }
    if (Math.abs(clientPrice - computedFinalPrice) > 0.05) {
      return {
        ok: false,
        error: `अमान्य मूल्य गणना: भेजी गई अंतिम कीमत (₹${formatPriceINR(clientPrice)}) और वास्तविक गणना (₹${formatPriceINR(computedFinalPrice)}) मेल नहीं खाती।`
      };
    }
  }

  return {
    ok: true,
    plan: {
      id,
      name,
      hindiName,
      originalPrice,
      price: computedFinalPrice,
      durationDays: rawDuration,
      discountType,
      discountPercentage,
      discountAmount,
      description,
      features,
      isActive: rawInput.isActive !== false,
      badgeText: badgeTextRaw || undefined,
      updatedAt: new Date().toISOString()
    }
  };
}
