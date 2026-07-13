export function getTomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

export function todayDate() {
  return new Date().toISOString().split("T")[0];
}
