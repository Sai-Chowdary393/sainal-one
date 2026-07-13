export function getBusinessProfile(settings) {
  return {
    companyName: settings?.company_name || "The company",
    companyEmail: settings?.company_email || "",
    companyPhone: settings?.company_phone || "",
    website: settings?.website || "",
    address: settings?.address || "",
    industry: settings?.industry || "General business services",
    businessType: settings?.business_type || "Service business",
    services: settings?.services || "Professional services",
    targetCustomers:
      settings?.target_customers || "Business customers",
    aiInstructions:
      settings?.ai_instructions ||
      "Give practical, professional and commercially useful advice.",
    currency: settings?.default_currency || "GBP",
    vatRate: settings?.default_vat_rate || "0",
    invoicePrefix: settings?.invoice_prefix || "SNI",
    paymentTerms:
      settings?.payment_terms ||
      "Payment due within 14 days of invoice date.",
  };
}

export function businessProfilePrompt(profile) {
  return `
Company name: ${profile.companyName}
Industry: ${profile.industry}
Business type: ${profile.businessType}
Services offered: ${profile.services}
Target customers: ${profile.targetCustomers}
Website: ${profile.website}
Additional AI instructions: ${profile.aiInstructions}
  `;
}
