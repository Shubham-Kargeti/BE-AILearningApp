export const getLevel = (score: number) => {
  if (score < 0.34) return { label: "Beginner", color: "green" };
  if (score < 0.67) return { label: "Intermediate", color: "yellow" };
  return { label: "Advanced", color: "red" };
};

export const getBadge = (score: number) => {
  if (score > 90) return "Gold";
  if (score < 90 && score > 70) return "Silver";
  if (score < 70 && score > 60) return "Bronze";
  return "";
};

export const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);

    if (!parsed.protocol.startsWith("http")) return false;

    const pathways = parsed.searchParams.get("pathways");
    if (!pathways || pathways.trim().length === 0) return false;

    return true;
  } catch (e) {
    return false;
  }
};
