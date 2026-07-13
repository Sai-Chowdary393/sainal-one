export function findMatchingRecord(prompt, records, fields) {
  const normalisedPrompt = String(prompt || "").toLowerCase();

  return records?.find((record) =>
    fields.some((field) => {
      const value = String(record?.[field] || "")
        .trim()
        .toLowerCase();

      return value && normalisedPrompt.includes(value);
    })
  );
}

export function detectServiceFromPrompt(prompt, profile) {
  const normalisedPrompt = String(prompt || "").toLowerCase();

  const configuredServices = String(profile?.services || "")
    .split(/[\n,;]+/)
    .map((service) => service.trim())
    .filter(Boolean);

  const matchedService = configuredServices.find((service) =>
    normalisedPrompt.includes(service.toLowerCase())
  );

  if (matchedService) {
    return matchedService;
  }

  const genericServiceMatch = String(prompt || "").match(
    /(?:for|service|needs?|requires?)\s+(.+?)(?:\s+£|\s+value|\s+email|\s+phone|$)/i
  );

  if (genericServiceMatch?.[1]) {
    return genericServiceMatch[1].trim();
  }

  return configuredServices[0] || "Professional Services";
}
