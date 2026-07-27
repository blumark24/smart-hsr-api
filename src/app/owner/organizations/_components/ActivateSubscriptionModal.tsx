"use client";

import { useEffect, useState } from "react";
import { X, CreditCard, AlertCircle, Building2 } from "lucide-react";
import {
  activateSubscription,
  type DisplayOrgFull,
} from "../../_lib/ownerQueries";

type Status = "active" | "trialing";
type BillingCycle = "monthly" | "annual";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "active",   label: "اشتراك فعّال" },
  { value: "trialing", label: "تفعيل مبدئي — فترة إطلاق" },
];

const BILLING_OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "شهري" },
  { value: "annual",  label: "سنوي" },
];

interface Props {
  org: DisplayOrgFull | null;
  onClose: () => void;
  onActivated: () => void;
}

export default function ActivateSubscriptionModal({ org, onClose, onActivated }: Props) {
  const [status, setStatus] = useState<Status>("active");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever a new organization is targeted.
  useEffect(() => {
    if (!org) return;
    setStatus("active");
    setBillingCycle("monthly");
    setEndsAt("");
    setError(null);
    setSaving(false);
  }, [org]);

  if (!org) return null;

  const missingPlan = !org.planId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || missingPlan) return;
    setError(null);
    setSaving(true);

    const res = await activateSubscription({
      organizationId: org.id,
      planId: org.planId,
      status,
      billingCycle,
      endsAt: endsAt || null,
    });
    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? "تعذّر تفعيل الاشتراك");
      return;
    }

    onActivated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="glass-card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto border border-[#10b981]/25">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-heading font-bold text-lg flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#10b981]/12 border border-[#10b981]/25">
              <CreditCard size={16} className="text-[#34d399]" />
            </span>
            تفعيل الاشتراك
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-[#8ba3c7] hover:text-white transition-colors disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        {/* Organization + plan summary */}
        <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-2.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#8ba3c7] flex items-center gap-1.5">
              <Building2 size={14} /> المنشأة
            </span>
            <span className="font-semibold text-white">{org.name}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#8ba3c7]">الباقة</span>
            <span className="font-semibold text-white">{org.planName}</span>
          </div>
        </div>

        {/* Missing-plan block */}
        {missingPlan ? (
          <>
            <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-300">
              <AlertCircle size={15} className="flex-shrink-0" />
              يجب اختيار باقة قبل تفعيل الاشتراك
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary w-full"
            >
              إغلاق
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
                <AlertCircle size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div>
                <label className="block text-xs text-[#8ba3c7] mb-1.5">حالة الاشتراك</label>
                <select
                  className="input-dark text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              {/* Billing cycle */}
              <div>
                <label className="block text-xs text-[#8ba3c7] mb-1.5">دورة الفوترة</label>
                <select
                  className="input-dark text-sm"
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                >
                  {BILLING_OPTIONS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional ends_at */}
            <div>
              <label className="block text-xs text-[#8ba3c7] mb-1.5">تاريخ نهاية عرض الإطلاق (اختياري)</label>
              <input
                type="date"
                dir="ltr"
                style={{ textAlign: "left" }}
                className="input-dark text-sm"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saving ? "جارٍ التفعيل..." : "تفعيل الاشتراك"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="btn-secondary flex-1 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
