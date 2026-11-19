export const STATUSES = [
  "registered",
  "in_triage",
  "waiting_doctor", "being_treated", 
  "waiting_results","waiting_bed", "bed_assigned", 
  "transferring", "moved_inpatient", "discharged", 
  "referred", "speak_to_staff"
  // ...all 12, in the order from CLAUDE.md
];

export const LOCATIONS = [
  "waiting_area",
  "triage", "resus", "treatment", 
  "observation", "radiology_ct", "lab", "moving"
];

export const BED_TYPES = ["ward", "hcu", "icu"];

// These statuses MUST have a bed type (the database refuses them without one)
export const NEEDS_BED_TYPE = ["waiting_bed", "bed_assigned", "moved_inpatient"];