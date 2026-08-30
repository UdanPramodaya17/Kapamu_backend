/**
 * Convert "HH:mm" time string to total minutes from midnight
 */
const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Convert total minutes to "HH:mm" string
 */
const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Check if two time ranges overlap
 */
const doTimesOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && e1 > s2;
};

/**
 * Get day of week (0=Sunday) from a Date
 */
const getDayOfWeek = (date) => {
  return new Date(date).getDay();
};

/**
 * Normalize a date to midnight UTC
 */
const normalizeDate = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Check if two dates are the same calendar day
 */
const isSameDay = (d1, d2) => {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

module.exports = {
  timeToMinutes,
  minutesToTime,
  doTimesOverlap,
  getDayOfWeek,
  normalizeDate,
  isSameDay,
};
