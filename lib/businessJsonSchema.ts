export const businessJsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    city: { type: "string" },
    state: { type: "string" },
    county: { type: "string" },
    zip: { type: "string" },
    business_metrics: { type: "object" },
    description: { type: "string" },
    additional_info: { type: "object" }
  },
  required: []
}; 