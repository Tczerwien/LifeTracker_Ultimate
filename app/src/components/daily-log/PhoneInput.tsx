import { useState, useEffect, useMemo } from 'react';

interface PhoneTiers {
  t1Min: number;
  t2Min: number;
  t3Min: number;
  t1Penalty: number;
  t2Penalty: number;
  t3Penalty: number;
}

interface PhoneInputProps {
  value: number;
  onBlur: (minutes: number) => void;
  phoneTiers: PhoneTiers;
}

function computeTier(
  minutes: number,
  tiers: PhoneTiers,
): { label: string; penalty: number } | null {
  if (minutes >= tiers.t3Min) return { label: 'Tier 3', penalty: tiers.t3Penalty };
  if (minutes >= tiers.t2Min) return { label: 'Tier 2', penalty: tiers.t2Penalty };
  if (minutes >= tiers.t1Min) return { label: 'Tier 1', penalty: tiers.t1Penalty };
  return null;
}

export default function PhoneInput({ value, onBlur: onBlurProp, phoneTiers }: PhoneInputProps) {
  const [raw, setRaw] = useState(String(value));

  // Sync when parent value changes (date change resets form)
  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  const tier = useMemo(() => {
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 0) return null;
    return computeTier(parsed, phoneTiers);
  }, [raw, phoneTiers]);

  function handleBlur() {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1440) {
      if (parsed !== value) {
        onBlurProp(parsed);
      }
    } else {
      // Snap back to last valid value
      setRaw(String(value));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={1440}
        className="w-20 rounded border border-gray-300 px-2 py-1 text-body text-center"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={handleBlur}
        aria-label="Phone use in minutes"
      />
      <span className="text-subdued text-gray-400">
        {tier !== null ? `${tier.label}: ${tier.penalty.toFixed(2)} penalty` : 'No penalty'}
      </span>
    </div>
  );
}
