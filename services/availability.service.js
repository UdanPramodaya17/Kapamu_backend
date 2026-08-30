const Saloon = require('../models/Saloon');
const Barber = require('../models/Barber');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const {
  timeToMinutes,
  minutesToTime,
  doTimesOverlap,
  getDayOfWeek,
  isSameDay,
} = require('../utils/dateHelpers');

/**
 * Calculate available slots for a single specific barber
 */
const getSingleBarberSlots = async ({ saloon, barber, service, date }) => {
  const targetDate = new Date(date);
  const dayOfWeek = getDayOfWeek(targetDate);

  // STEP 1: Check saloon operating hours
  let saloonDay = saloon.operatingHours && saloon.operatingHours.length > 0
    ? saloon.operatingHours.find((h) => h.day === dayOfWeek)
    : { day: dayOfWeek, openTime: '09:00', closeTime: '21:00', isClosed: false };

  if (!saloonDay || saloonDay.isClosed) {
    return { slots: [], reason: 'Saloon is closed on this day.' };
  }

  // STEP 2: Check saloon holidays
  const isHoliday = saloon.holidays?.some((h) => isSameDay(h.date, targetDate));
  if (isHoliday) {
    const holiday = saloon.holidays.find((h) => isSameDay(h.date, targetDate));
    return { slots: [], reason: `Holiday: ${holiday?.reason || 'Saloon is closed.'}` };
  }

  // STEP 3: Check barber working hours
  const barberDay = barber.workingHours?.find((h) => h.day === dayOfWeek);
  const effectiveStartTime = barberDay?.isWorking ? barberDay.startTime : saloonDay.openTime;
  const effectiveEndTime = barberDay?.isWorking ? barberDay.endTime : saloonDay.closeTime;

  if (barberDay && !barberDay.isWorking) {
    return { slots: [], reason: 'Barber is not working on this day.' };
  }

  const openMinutes = Math.max(
    timeToMinutes(saloonDay.openTime || '09:00'),
    timeToMinutes(effectiveStartTime || '09:00')
  );
  const closeMinutes = Math.min(
    timeToMinutes(saloonDay.closeTime || '21:00'),
    timeToMinutes(effectiveEndTime || '21:00')
  );

  if (openMinutes >= closeMinutes) {
    return { slots: [], reason: 'No valid working window for this day.' };
  }

  // STEP 4: Check barber leave schedule
  const leavesForDay = (barber.leaveSchedule || []).filter((l) => isSameDay(l.date, targetDate));
  const hasFullDayLeave = leavesForDay.some((l) => l.isFullDay);
  if (hasFullDayLeave) {
    return { slots: [], reason: 'Barber is on leave today.' };
  }

  const blockedRanges = leavesForDay
    .filter((l) => !l.isFullDay && l.startTime && l.endTime)
    .map((l) => ({ start: l.startTime, end: l.endTime }));

  // STEP 5: Generate slots
  const duration = service.duration || 30;
  const allSlots = [];

  // Buffer check for Today (Sri Lanka timezone)
  const BUFFER_MINUTES = 30;
  const nowSL = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }));
  const isToday =
    targetDate.getFullYear() === nowSL.getFullYear() &&
    targetDate.getMonth() === nowSL.getMonth() &&
    targetDate.getDate() === nowSL.getDate();

  const currentMinutes = isToday
    ? nowSL.getHours() * 60 + nowSL.getMinutes() + BUFFER_MINUTES
    : 0;

  for (let start = openMinutes; start + duration <= closeMinutes; start += duration) {
    const startTime = minutesToTime(start);
    const endTime = minutesToTime(start + duration);

    if (isToday && start < currentMinutes) {
      continue;
    }

    const blockedByLeave = blockedRanges.some((range) =>
      doTimesOverlap(startTime, endTime, range.start, range.end)
    );

    if (!blockedByLeave) {
      allSlots.push({ startTime, endTime });
    }
  }

  // STEP 6: Fetch existing appointments
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingAppointments = await Appointment.find({
    barber: barber._id,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed'] },
  }).select('startTime endTime');

  // STEP 7: Filter out occupied slots
  const availableSlots = allSlots.filter((slot) => {
    const isOccupied = existingAppointments.some((appt) =>
      doTimesOverlap(slot.startTime, slot.endTime, appt.startTime, appt.endTime)
    );
    return !isOccupied;
  });

  return {
    slots: availableSlots,
    totalSlots: allSlots.length,
    availableCount: availableSlots.length,
    bookedCount: allSlots.length - availableSlots.length,
  };
};

/**
 * Main slot availability engine
 * Supports specific barberId or 'any' / multi-barber aggregation
 */
const getAvailableSlots = async ({ saloonId, barberId, serviceId, date }) => {
  const targetDate = new Date(date);
  const isAnyBarber = !barberId || barberId === 'any' || barberId === 'all';

  if (!isAnyBarber) {
    const [saloon, barber, service] = await Promise.all([
      Saloon.findById(saloonId),
      Barber.findById(barberId),
      Service.findById(serviceId),
    ]);

    if (!saloon || !barber || !service) {
      throw new Error('Invalid saloon, barber, or service.');
    }

    return await getSingleBarberSlots({ saloon, barber, service, date });
  }

  // ── "ANY STYLIST" MULTI-BARBER AGGREGATION ──
  const [saloon, service, activeBarbers] = await Promise.all([
    Saloon.findById(saloonId),
    Service.findById(serviceId),
    Barber.find({ saloon: saloonId, isActive: true }).populate('user', 'name avatar'),
  ]);

  if (!saloon || !service) {
    throw new Error('Invalid saloon or service.');
  }

  if (!activeBarbers || activeBarbers.length === 0) {
    return { slots: [], reason: 'No active stylists available at this salon.' };
  }

  // Check saloon general operating status first
  const dayOfWeek = getDayOfWeek(targetDate);
  const saloonDay = saloon.operatingHours?.find((h) => h.day === dayOfWeek);
  if (saloonDay && saloonDay.isClosed) {
    return { slots: [], reason: 'Saloon is closed on this day.' };
  }

  const isHoliday = saloon.holidays?.some((h) => isSameDay(h.date, targetDate));
  if (isHoliday) {
    const holiday = saloon.holidays.find((h) => isSameDay(h.date, targetDate));
    return { slots: [], reason: `Holiday: ${holiday?.reason || 'Saloon is closed.'}` };
  }

  // Map: startTime -> { startTime, endTime, availableBarbers: [] }
  const slotMap = new Map();

  // Run availability for all barbers in parallel
  const barberSlotResults = await Promise.all(
    activeBarbers.map(async (barber) => {
      try {
        const res = await getSingleBarberSlots({ saloon, barber, service, date });
        return { barber, slots: res.slots || [] };
      } catch (err) {
        return { barber, slots: [] };
      }
    })
  );

  // Merge slots from all barbers
  for (const { barber, slots } of barberSlotResults) {
    for (const slot of slots) {
      if (!slotMap.has(slot.startTime)) {
        slotMap.set(slot.startTime, {
          startTime: slot.startTime,
          endTime: slot.endTime,
          availableBarbers: [],
        });
      }
      slotMap.get(slot.startTime).availableBarbers.push({
        _id: barber._id,
        name: barber.user?.name || 'Stylist',
        avatar: barber.user?.avatar || '',
      });
    }
  }

  // Convert to sorted array
  const aggregatedSlots = Array.from(slotMap.values()).sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  return {
    slots: aggregatedSlots,
    isAny: true,
    totalBarbers: activeBarbers.length,
    availableCount: aggregatedSlots.length,
  };
};

module.exports = { getAvailableSlots, getSingleBarberSlots };
