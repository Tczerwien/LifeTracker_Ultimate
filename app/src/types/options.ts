// ---------------------------------------------------------------------------
// Dropdown Options — CONFIG_SCHEMA.md Section 4
// ---------------------------------------------------------------------------

/** Structure of the `dropdown_options` JSON stored in `app_config`. */
export interface DropdownOptions {
  study_subjects: string[];
  study_types: string[];
  study_locations: string[];
  app_sources: string[];
  relapse_time_options: string[];
  relapse_duration_options: string[];
  relapse_trigger_options: string[];
  relapse_location_options: string[];
  relapse_device_options: string[];
  relapse_activity_before_options: string[];
  relapse_emotional_state_options: string[];
  relapse_resistance_technique_options: string[];
  urge_technique_options: string[];
  urge_duration_options: string[];
  urge_pass_options: string[];
}

/** All 15 required keys in the DropdownOptions object. */
export const DROPDOWN_OPTION_KEYS: readonly (keyof DropdownOptions)[] = [
  'study_subjects',
  'study_types',
  'study_locations',
  'app_sources',
  'relapse_time_options',
  'relapse_duration_options',
  'relapse_trigger_options',
  'relapse_location_options',
  'relapse_device_options',
  'relapse_activity_before_options',
  'relapse_emotional_state_options',
  'relapse_resistance_technique_options',
  'urge_technique_options',
  'urge_duration_options',
  'urge_pass_options',
] as const;

/** Keys that cannot be edited by the user in the Settings UI. */
export const READ_ONLY_DROPDOWN_KEYS: readonly (keyof DropdownOptions)[] = [
  'relapse_time_options',
  'urge_pass_options',
] as const;

/** Seed values from CONFIG_SCHEMA.md Section 4.2. */
export const SEED_DROPDOWN_OPTIONS: Readonly<DropdownOptions> = {
  study_subjects: [
    'Quantum Computing',
    'Mobile App Development',
    'Data Communications',
    'IT Labs',
    'Networking Labs',
    'Certs',
    'Project',
  ],
  study_types: [
    'Self-Study',
    'Review',
    'Homework',
    'Personal-Project',
    'Lab Work',
    'Cert Study',
  ],
  study_locations: [
    'Library',
    'Home',
    'Coffee Shop',
    'Campus',
    'Other',
  ],
  app_sources: [
    'JobRight',
    'Simplify',
    'LinkedIn',
    'Indeed',
    'Company Site',
    'Referral',
    'Other',
  ],
  relapse_time_options: [
    'Early Morning (3-6am)',
    'Morning (6-9am)',
    'Late Morning (9am-12pm)',
    'Afternoon (12-5pm)',
    'Evening (5-9pm)',
    'Night (9pm-12am)',
    'Late Night (12-3am)',
  ],
  relapse_duration_options: [
    '< 5 min',
    '5-15 min',
    '15-30 min',
    '30-60 min',
    '1-2 hours',
    '2+ hours',
  ],
  relapse_trigger_options: [
    'Boredom',
    'Stress',
    'Loneliness',
    'Arousal',
    'Habit/Autopilot',
    'Insomnia',
    'Anxiety',
    'Sadness',
    'Anger',
    'Rejection',
    'Celebration',
  ],
  relapse_location_options: [
    'Bedroom',
    'Desk/Office',
    'Bathroom',
    'Living Room',
    'Other',
  ],
  relapse_device_options: [
    'Phone',
    'Laptop',
    'Tablet',
  ],
  relapse_activity_before_options: [
    'Studying',
    'Scrolling Social Media',
    'In Bed (Not Sleeping)',
    'Watching TV/YouTube',
    'Working',
    'Nothing/Idle',
    'Browsing Internet',
    'Gaming',
    'Other',
  ],
  relapse_emotional_state_options: [
    'Anxious',
    'Bored',
    'Sad',
    'Angry',
    'Restless',
    'Lonely',
    'Tired',
    'Stressed',
    'Neutral',
    'Happy',
  ],
  relapse_resistance_technique_options: [
    'Left Room',
    'Exercise',
    'Called/Texted Someone',
    'Cold Water',
    'Meditation',
    'Distraction Activity',
    'Turned Off Device',
    'None',
    'Other',
  ],
  urge_technique_options: [
    'Left Room',
    'Exercise',
    'Called/Texted Someone',
    'Cold Water',
    'Meditation',
    'Went for Walk',
    'Journaled',
    'Push-ups',
    'Distraction Activity',
    'Turned Off Device',
    'Deep Breathing',
    'Other',
  ],
  urge_duration_options: [
    '< 1 min',
    '1-5 min',
    '5-15 min',
    '15-30 min',
    '30-60 min',
    '1+ hour',
  ],
  urge_pass_options: [
    'Yes - completely',
    'Yes - mostly',
    'Partially',
    'No (but I resisted anyway)',
  ],
} as const;

/**
 * Runtime type guard verifying an unknown value conforms to the DropdownOptions shape.
 * Checks: non-null object, all 15 keys present, each value is a string array.
 */
export function isValidDropdownOptions(obj: unknown): obj is DropdownOptions {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  const record = obj as Record<string, unknown>;

  for (const key of DROPDOWN_OPTION_KEYS) {
    const value = record[key];
    if (!Array.isArray(value)) {
      return false;
    }
    if (!value.every((item): item is string => typeof item === 'string')) {
      return false;
    }
  }

  return true;
}
