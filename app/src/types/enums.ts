export enum HabitPool {
  Good = 'good',
  Vice = 'vice',
}

export enum HabitCategory {
  Productivity = 'productivity',
  Health = 'health',
  Growth = 'growth',
}

export enum InputType {
  Checkbox = 'checkbox',
  Dropdown = 'dropdown',
  Number = 'number',
}

export enum PenaltyMode {
  Flat = 'flat',
  PerInstance = 'per_instance',
  Tiered = 'tiered',
}

export enum ApplicationStatus {
  Applied = 'applied',
  PhoneScreen = 'phone_screen',
  Interview = 'interview',
  TechnicalScreen = 'technical_screen',
  Offer = 'offer',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn',
  NoResponse = 'no_response',
}

export type CorrelationWindow = 0 | 30 | 60 | 90 | 180 | 365;

export const VALID_CORRELATION_WINDOWS: readonly CorrelationWindow[] = [
  0, 30, 60, 90, 180, 365,
] as const;
