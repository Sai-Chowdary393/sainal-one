export function generateQuoteNumber() {
  return `SNQ-${Date.now().toString().slice(-6)}`;
}

export function generateInvoiceNumber(prefix = "SNI") {
  const year = new Date().getFullYear();
  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  return `${prefix}-${year}-${randomNumber}`;
}
