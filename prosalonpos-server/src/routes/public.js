/**
 * ProSalonPOS — Public Routes (No Auth Required)
 * Session C19 | Online Booking Portal
 *
 * These endpoints are called by the public-facing online booking page.
 * No JWT required. Data is filtered to only expose what customers need.
 *
 * GET  /public/salon/:salonCode/booking-data  — salon info, services, categories, staff for booking
 * POST /public/salon/:salonCode/book          — submit a booking (creates appointment + service lines)
 */
import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../config/database.js';
import { getIO } from '../utils/emit.js';

var router = Router();

// ── Helper: get today's date bounds in Eastern time ──
function todayBoundsET() {
  var now = new Date();
  var str = now.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' });
  var isEDT = str.indexOf('EDT') >= 0;
  var etOffset = isEDT ? 240 : 300;
  var etNow = new Date(now.getTime() - etOffset * 60000);
  var y = etNow.getUTCFullYear();
  var m = etNow.getUTCMonth();
  var d = etNow.getUTCDate();
  var start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  start.setUTCMinutes(start.getUTCMinutes() + etOffset);
  var end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
  end.setUTCMinutes(end.getUTCMinutes() + etOffset);
  return { start: start, end: end };
}

// ── Helper: look up salon by code ──
async function findSalonByCode(salonCode) {
  return prisma.salon.findUnique({
    where: { salon_code: salonCode },
    select: {
      id: true, name: true, phone: true, logo_url: true,
      status: true, salon_code: true,
    }
  });
}

// ══════════════════════════════════════════
// GET /public/salon/:salonCode/booking-data
// ══════════════════════════════════════════
// Returns everything the booking portal needs: salon info, settings,
// online-enabled services + categories, active staff (names only),
// and today's existing appointments for availability calculation.

router.get('/salon/:salonCode/booking-data', async function(req, res, next) {
  try {
    var salon = await findSalonByCode(req.params.salonCode);
    if (!salon) return res.status(404).json({ error: 'Salon not found' });
    if (salon.status === 'suspended' || salon.status === 'cancelled') {
      return res.status(403).json({ error: 'This salon is not currently accepting online bookings.' });
    }

    var salonId = salon.id;

    // Fire all queries in parallel
    var [settingsRow, services, categories, categoryLinks, staff, todayAppts] = await Promise.all([
      // Settings (business hours, booking config, brand)
      prisma.salonSettings.findUnique({ where: { salon_id: salonId } }),

      // Only active + online-enabled services
      prisma.serviceCatalog.findMany({
        where: { salon_id: salonId, active: true, online_booking_enabled: true },
        select: {
          id: true, name: true, default_duration_minutes: true,
          calendar_color: true, description: true, position: true,
          price_cents: true,
        },
        orderBy: { position: 'asc' },
      }),

      // Only active categories
      prisma.serviceCategory.findMany({
        where: { salon_id: salonId, active: true },
        select: { id: true, name: true, calendar_color: true, position: true },
        orderBy: { position: 'asc' },
      }),

      // Category links for mapping services → categories
      prisma.serviceCatalogCategory.findMany({
        where: {
          service: { salon_id: salonId, active: true, online_booking_enabled: true }
        },
        select: { service_catalog_id: true, category_id: true },
      }),

      // Active techs visible for online booking — names only (no PINs, no pay info)
      prisma.staff.findMany({
        where: { salon_id: salonId, active: true, show_on_online_booking: { not: false } },
        select: {
          id: true, display_name: true, photo_url: true,
          tech_turn_eligible: true, show_on_online_booking: true,
        },
        orderBy: { display_name: 'asc' },
      }),

      // Today's existing service lines (for availability calculation)
      (function() {
        var bounds = todayBoundsET();
        return prisma.serviceLine.findMany({
          where: {
            appointment: { salon_id: salonId, status: { notIn: ['cancelled', 'no_show'] } },
            starts_at: { gte: bounds.start, lte: bounds.end },
          },
          select: {
            staff_id: true, starts_at: true, duration_minutes: true,
            appointment: { select: { requested: true } },
          },
        });
      })(),
    ]);

    // Parse settings JSON
    var settings = {};
    if (settingsRow && settingsRow.settings) {
      settings = typeof settingsRow.settings === 'string'
        ? JSON.parse(settingsRow.settings) : settingsRow.settings;
    }

    // Check if online booking is enabled
    if (settings.online_booking_enabled === false) {
      return res.status(403).json({ error: 'Online booking is not enabled for this salon.' });
    }

    // Build category_ids on each service using the junction table
    var svcCatMap = {};
    categoryLinks.forEach(function(link) {
      if (!svcCatMap[link.service_catalog_id]) svcCatMap[link.service_catalog_id] = [];
      svcCatMap[link.service_catalog_id].push(link.category_id);
    });
    var servicesWithCats = services.map(function(svc) {
      return Object.assign({}, svc, { category_ids: svcCatMap[svc.id] || [] });
    });

    // Filter categories to only those that have at least one online service
    var usedCatIds = {};
    servicesWithCats.forEach(function(svc) {
      (svc.category_ids || []).forEach(function(cid) { usedCatIds[cid] = true; });
    });
    var filteredCategories = categories.filter(function(cat) { return usedCatIds[cat.id]; });

    // Format today's appointments for client-side availability
    var todayServiceLines = todayAppts.map(function(sl) {
      return {
        staff_id: sl.staff_id,
        starts_at: sl.starts_at.toISOString(),
        dur: sl.duration_minutes,
        requested: sl.appointment ? sl.appointment.requested : false,
      };
    });

    // Build safe settings subset (no PINs, no internal config)
    var publicSettings = {
      salon_name: settings.salon_name || salon.name,
      salon_brand_color: settings.salon_brand_color || null,
      salon_logo_url: settings.salon_logo_url || salon.logo_url || null,
      business_hours: settings.business_hours || null,
      booking_increment_minutes: settings.booking_increment_minutes || 15,
      online_max_advance_days: settings.online_max_advance_days || 30,
      online_min_lead_hours: settings.online_min_lead_hours || 0,
      online_group_booking_enabled: settings.online_group_booking_enabled || false,
      max_group_size: settings.max_group_size || 4,
      online_required_fields: settings.online_required_fields || [],
      deposit_enabled: settings.deposit_enabled || false,
      deposit_source_online: settings.deposit_source_online || false,
      deposit_trigger: settings.deposit_trigger || 'always',
      deposit_threshold_cents: settings.deposit_threshold_cents || 0,
      deposit_amount_type: settings.deposit_amount_type || 'flat',
      deposit_percentage: settings.deposit_percentage || 0,
      deposit_flat_amount_cents: settings.deposit_flat_amount_cents || 0,
      cancellation_window_hours: settings.cancellation_window_hours || 24,
    };

    res.json({
      salon: {
        id: salonId,
        name: salon.name,
        salon_code: salon.salon_code,
      },
      settings: publicSettings,
      services: servicesWithCats,
      categories: filteredCategories,
      staff: staff,
      todayServiceLines: todayServiceLines,
    });

  } catch (err) { next(err); }
});


// ══════════════════════════════════════════
// GET /public/salon/:salonCode/client-lookup/:phone
// ══════════════════════════════════════════
// Checks if a client exists by phone number. Returns name only — no sensitive data.

router.get('/salon/:salonCode/client-lookup/:phone', async function(req, res, next) {
  try {
    var salon = await findSalonByCode(req.params.salonCode);
    if (!salon) return res.status(404).json({ error: 'Salon not found' });

    var phoneDigits = (req.params.phone || '').replace(/\D/g, '').slice(0, 10);
    if (phoneDigits.length < 10) {
      return res.json({ found: false });
    }

    // Search by phone or phone_digits
    var client = await prisma.client.findFirst({
      where: {
        salon_id: salon.id,
        OR: [
          { phone: phoneDigits },
          { phone_digits: phoneDigits },
        ],
      },
      select: {
        first_name: true,
        last_name: true,
      },
    });

    if (client) {
      res.json({ found: true, first_name: client.first_name, last_name: client.last_name });
    } else {
      res.json({ found: false });
    }
  } catch (err) { next(err); }
});


// ══════════════════════════════════════════
// GET /public/salon/:salonCode/availability/:date
// ══════════════════════════════════════════
// Returns service lines for a specific date so the portal can
// calculate available time slots. Called when user picks a date.

router.get('/salon/:salonCode/availability/:date', async function(req, res, next) {
  try {
    var salon = await findSalonByCode(req.params.salonCode);
    if (!salon) return res.status(404).json({ error: 'Salon not found' });

    var salonId = salon.id;
    var dateStr = req.params.date; // "2026-04-15"
    var dateParts = dateStr.split('-');
    var year = parseInt(dateParts[0]);
    var month = parseInt(dateParts[1]) - 1;
    var day = parseInt(dateParts[2]);

    // Determine ET offset for the requested date
    var probe = new Date(Date.UTC(year, month, day, 12, 0, 0));
    var probeStr = probe.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' });
    var etOffset = probeStr.indexOf('EDT') >= 0 ? 240 : 300;

    // Build day bounds in UTC
    var dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    dayStart.setUTCMinutes(dayStart.getUTCMinutes() + etOffset);
    var dayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    dayEnd.setUTCMinutes(dayEnd.getUTCMinutes() + etOffset);

    var serviceLines = await prisma.serviceLine.findMany({
      where: {
        appointment: { salon_id: salonId, status: { notIn: ['cancelled', 'no_show'] } },
        starts_at: { gte: dayStart, lte: dayEnd },
      },
      select: {
        staff_id: true, starts_at: true, duration_minutes: true,
        appointment: { select: { requested: true } },
      },
    });

    var result = serviceLines.map(function(sl) {
      return {
        staff_id: sl.staff_id,
        starts_at: sl.starts_at.toISOString(),
        dur: sl.duration_minutes,
        requested: sl.appointment ? sl.appointment.requested : false,
      };
    });

    res.json({ date: dateStr, serviceLines: result });
  } catch (err) { next(err); }
});


// ══════════════════════════════════════════
// POST /public/salon/:salonCode/book
// ══════════════════════════════════════════
// Creates appointment(s) + service lines from an online booking.
// Single booking: 1 appointment. Group: N appointments with shared booking_group_id.
//
// Body: {
//   client: { phone, first_name, last_name?, email? },
//   bookings: [
//     { tech_id: uuid|null, services: [{ id, name, duration, color, price_cents }], requested: bool }
//   ],
//   date: "2026-04-10",
//   time: 540,          // minutes from midnight
//   booking_mode: "single" | "group"
// }

router.post('/salon/:salonCode/book', async function(req, res, next) {
  try {
    var salon = await findSalonByCode(req.params.salonCode);
    if (!salon) return res.status(404).json({ error: 'Salon not found' });
    if (salon.status === 'suspended' || salon.status === 'cancelled') {
      return res.status(403).json({ error: 'This salon is not currently accepting online bookings.' });
    }

    var salonId = salon.id;
    var body = req.body;

    // ── Validate required fields ──
    if (!body.client || !body.client.phone || !body.client.first_name) {
      return res.status(400).json({ error: 'Phone number and first name are required.' });
    }
    if (!body.bookings || !body.bookings.length) {
      return res.status(400).json({ error: 'At least one booking with services is required.' });
    }
    if (!body.date || body.time === undefined || body.time === null) {
      return res.status(400).json({ error: 'Date and time are required.' });
    }

    // ── Validate business hours — reject bookings on closed days ──
    var settingsRow2 = await prisma.salonSettings.findUnique({ where: { salon_id: salonId } });
    var _settings2 = {};
    if (settingsRow2 && settingsRow2.settings) {
      _settings2 = typeof settingsRow2.settings === 'string' ? JSON.parse(settingsRow2.settings) : settingsRow2.settings;
    }
    var bh = _settings2.business_hours;
    if (bh) {
      var _dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      var bookDate = new Date(body.date + 'T12:00:00');
      var dayKey = _dayKeys[bookDate.getDay()];
      if (!bh[dayKey] || !bh[dayKey].open) {
        return res.status(400).json({ error: 'The salon is closed on this day. Please select a different date.' });
      }
      // Validate time is within business hours
      if (body.time < bh[dayKey].start || body.time >= bh[dayKey].end) {
        return res.status(400).json({ error: 'The selected time is outside business hours.' });
      }
    }

    // ── Find or create client ──
    var phoneDigits = body.client.phone.replace(/\D/g, '').slice(0, 10);
    var existingClient = await prisma.client.findFirst({
      where: { salon_id: salonId, phone: phoneDigits },
    });

    var clientId;
    var clientName = body.client.first_name + (body.client.last_name ? ' ' + body.client.last_name : '');

    if (existingClient) {
      clientId = existingClient.id;
      clientName = existingClient.first_name + (existingClient.last_name ? ' ' + existingClient.last_name : '');
    } else {
      var newClient = await prisma.client.create({
        data: {
          salon_id: salonId,
          phone: phoneDigits,
          phone_digits: phoneDigits,
          first_name: body.client.first_name,
          last_name: body.client.last_name || '',
          email: body.client.email || null,
        }
      });
      clientId = newClient.id;
    }

    // ── Parse date + time into UTC DateTime ──
    var dateParts = body.date.split('-');
    var year = parseInt(dateParts[0]);
    var month = parseInt(dateParts[1]) - 1;
    var day = parseInt(dateParts[2]);
    // Determine ET offset for the booking date
    var probe = new Date(Date.UTC(year, month, day, 12, 0, 0));
    var probeStr = probe.toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' });
    var etOffset = probeStr.indexOf('EDT') >= 0 ? 240 : 300;

    // booking_group_id for group bookings
    var bookingGroupId = null;
    if (body.booking_mode === 'group' && body.bookings.length > 1) {
      bookingGroupId = crypto.randomUUID();
    }

    // ── Create appointments + service lines in a transaction ──
    var createdAppointments = await prisma.$transaction(async function(tx) {
      var appointments = [];

      for (var bi = 0; bi < body.bookings.length; bi++) {
        var booking = body.bookings[bi];
        var techId = booking.tech_id;
        var isRequested = booking.requested || false;

        // If no tech specified, assign the least-busy available tech for this day
        // who is also free at the requested time slot.
        if (!techId) {
          var availableTechs = await tx.staff.findMany({
            where: { salon_id: salonId, active: true, show_on_online_booking: { not: false } },
            select: { id: true, display_name: true },
            orderBy: { display_name: 'asc' },
          });
          if (availableTechs.length === 0) {
            throw new Error('No available technicians for this booking.');
          }

          // Build day boundaries in UTC for the booking date
          var dayStartUTC = new Date(Date.UTC(year, month, day, 0, 0, 0));
          dayStartUTC = new Date(dayStartUTC.getTime() + etOffset * 60000); // midnight ET in UTC
          var dayEndUTC = new Date(dayStartUTC.getTime() + 24 * 60 * 60000);

          // Fetch all service lines for the day for these techs (need times for conflict check)
          var dayLines = await tx.serviceLine.findMany({
            where: {
              staff_id: { in: availableTechs.map(function(t) { return t.id; }) },
              starts_at: { gte: dayStartUTC, lt: dayEndUTC },
              status: { notIn: ['cancelled', 'no_show'] },
            },
            select: { staff_id: true, starts_at: true, duration_minutes: true },
          });

          // Build per-tech appointment list (start/end in minutes from midnight ET)
          var techAppts = {};
          availableTechs.forEach(function(t) { techAppts[t.id] = []; });
          dayLines.forEach(function(sl) {
            var slTime = new Date(sl.starts_at);
            var slMinET = Math.round((slTime.getTime() - dayStartUTC.getTime()) / 60000);
            techAppts[sl.staff_id].push({ start: slMinET, end: slMinET + sl.duration_minutes });
          });

          // Calculate this booking's total duration and time range
          var bookingDuration = booking.services.reduce(function(sum, svc) {
            return sum + (svc.duration || svc.default_duration_minutes || 30);
          }, 0);
          var bookingStart = body.time; // minutes from midnight ET
          var bookingEnd = bookingStart + bookingDuration;

          // Filter to techs who are free at this time slot
          var freeTechs = availableTechs.filter(function(t) {
            var appts = techAppts[t.id];
            for (var ai = 0; ai < appts.length; ai++) {
              var a = appts[ai];
              // Overlap check: new booking overlaps if it starts before existing ends AND ends after existing starts
              if (bookingStart < a.end && bookingEnd > a.start) return false;
            }
            return true;
          });

          // If no tech is free at this exact slot, fall back to all available techs
          // (the availability check on the portal should prevent this, but just in case)
          var candidates = freeTechs.length > 0 ? freeTechs : availableTechs;

          // Also count any techs already assigned earlier in THIS transaction (same booking batch)
          var txAssigned = {};
          appointments.forEach(function(a) {
            if (a.techId) txAssigned[a.techId] = (txAssigned[a.techId] || 0) + 1;
          });

          // Pick candidate with fewest total appointments (existing + in-transaction)
          var bestTech = null;
          var bestCount = Infinity;
          for (var ti = 0; ti < candidates.length; ti++) {
            var t = candidates[ti];
            var total = (techAppts[t.id] || []).length + (txAssigned[t.id] || 0);
            if (total < bestCount) {
              bestCount = total;
              bestTech = t;
            }
          }
          techId = bestTech.id;
        }

        // Create appointment
        var appt = await tx.appointment.create({
          data: {
            salon_id: salonId,
            client_id: clientId,
            client_name: clientName,
            status: 'confirmed',
            source: 'online',
            booking_group_id: bookingGroupId,
            requested: isRequested,
          }
        });

        // Create service lines
        var slotMinutes = body.time;
        var cumulativeOffset = 0;
        var firstSlId = null;

        for (var si = 0; si < booking.services.length; si++) {
          var svc = booking.services[si];
          var svcDuration = svc.duration || svc.default_duration_minutes || 30;

          // Calculate start time for this service line
          var svcStartMinutes = slotMinutes + cumulativeOffset;
          var svcHour = Math.floor(svcStartMinutes / 60);
          var svcMin = svcStartMinutes % 60;

          // Build UTC datetime
          var startsAt = new Date(Date.UTC(year, month, day, svcHour, svcMin, 0, 0));
          startsAt.setUTCMinutes(startsAt.getUTCMinutes() + etOffset);

          var createdSL = await tx.serviceLine.create({
            data: {
              appointment_id: appt.id,
              service_catalog_id: svc.id || null,
              staff_id: techId,
              starts_at: startsAt,
              duration_minutes: svcDuration,
              calendar_color: svc.calendar_color || svc.color || '#3B82F6',
              status: 'confirmed',
              service_name: svc.name,
              price_cents: svc.price_cents || 0,
              client_name: clientName,
              position: si,
            }
          });
          if (si === 0) firstSlId = createdSL.id;

          cumulativeOffset += svcDuration;
        }

        appointments.push(Object.assign({}, appt, {
          techId: techId,
          firstSlId: firstSlId,
          serviceNames: booking.services.map(function(s) { return s.name; }),
        }));
      }

      return appointments;
    }, { timeout: 15000 });

    // Emit socket events so the calendar refreshes in real-time
    try {
      var _io = getIO();
      if (_io) {
        // Emit appointment:created for each appointment so existing calendar listeners pick it up
        createdAppointments.forEach(function(a) {
          _io.to('salon:' + salonId).emit('appointment:created', {
            id: a.id, source: 'online',
          });
        });

        // Look up tech display names for the notification
        var techIds = createdAppointments.map(function(a) { return a.techId; }).filter(Boolean);
        var uniqueTechIds = techIds.filter(function(id, i) { return techIds.indexOf(id) === i; });
        var techRows = uniqueTechIds.length > 0 ? await prisma.staff.findMany({
          where: { id: { in: uniqueTechIds } },
          select: { id: true, display_name: true },
        }) : [];
        var techNameMap = {};
        techRows.forEach(function(t) { techNameMap[t.id] = t.display_name; });

        // Format booking time for display
        var timeHour = Math.floor(body.time / 60);
        var timeMin = body.time % 60;
        var ampm = timeHour >= 12 ? 'PM' : 'AM';
        var displayHour = timeHour > 12 ? timeHour - 12 : (timeHour === 0 ? 12 : timeHour);
        var timeStr = displayHour + ':' + (timeMin < 10 ? '0' : '') + timeMin + ' ' + ampm;

        // Format booked_at timestamp
        var now = new Date();
        var bookedStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });

        // Emit one notification per booking (supports group bookings)
        createdAppointments.forEach(function(a) {
          _io.to('salon:' + salonId).emit('online-booking:received', {
            id: a.id,
            slId: a.firstSlId,
            client: clientName,
            phone: phoneDigits,
            service: (a.serviceNames || []).join(', '),
            tech: techNameMap[a.techId] || 'No Preference',
            time: timeStr,
            date: body.date,
            booked_at: bookedStr,
          });
        });
      }
    } catch (socketErr) {
      console.error('[Public Book] Socket emit error:', socketErr.message);
    }

    res.status(201).json({
      success: true,
      appointments: createdAppointments.map(function(a) {
        return { id: a.id, status: a.status };
      }),
      client_id: clientId,
      booking_group_id: bookingGroupId,
    });

  } catch (err) { next(err); }
});


export default router;
