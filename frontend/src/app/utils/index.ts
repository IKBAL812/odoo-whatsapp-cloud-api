import dayjs from "dayjs";

export const formatTime = (timestamp: number, locale?: string) => {
  const now = dayjs(timestamp);
  // Use 12-hour format for English, 24-hour format for other languages
  return locale === "en" ? now.format("h:mm A") : now.format("HH:mm");
};

export const getTimestamp = () => {
  return Date.now();
};
