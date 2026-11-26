export const STATUSES = [
  "registered",
  "in_triage",
  "waiting_doctor", "being_treated", 
  "waiting_results","waiting_bed", "bed_assigned", 
  "transferring", "moved_inpatient", "discharged", 
  "referred", "speak_to_staff"
];

export const LOCATIONS = [
  "waiting_area",
  "triage", "resus", "treatment", 
  "observation", "radiology_ct", "lab", "moving"
];

export const BED_TYPES = ["ward", "hcu", "icu"];

// These statuses MUST have a bed type (the database refuses them without one)
export const NEEDS_BED_TYPE = ["waiting_bed", "bed_assigned", "moved_inpatient"];
// Tap mode shows these first: what usually comes next after the current status.
export const LIKELY_NEXT: Record<string, string[]> = {
  registered: ["in_triage"],
  in_triage: ["waiting_doctor", "being_treated"],
  waiting_doctor: ["being_treated"],
  being_treated: ["waiting_results", "waiting_bed", "discharged"],
  waiting_results: ["being_treated", "waiting_bed", "discharged"],
  waiting_bed: ["bed_assigned"],
  bed_assigned: ["transferring"],
  transferring: ["moved_inpatient"],
  speak_to_staff: ["being_treated"],
};

// Staff-facing: "waiting_bed" -> "waiting bed"
export const word = (value: string) => value.replaceAll("_", " ");
