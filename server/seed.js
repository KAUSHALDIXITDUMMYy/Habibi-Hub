// Seed data — a believable mid-operation snapshot of the Hub.
// Dates are computed relative to "today" so the demo always looks alive.

const day = 24 * 60 * 60 * 1000;
const isoDate = (offsetDays) =>
  new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const isoTs = (offsetDays, hour = 9) =>
  new Date(new Date(isoDate(offsetDays) + 'T00:00:00').getTime() + hour * 3600_000).toISOString();

export function buildSeed() {
  const teamMembers = [
    { userId: 1, name: 'Kaushal', role: 'Lead', permissions: ['*'] },
    { userId: 2, name: 'Chitrank', role: 'Ops', permissions: ['events:write', 'applications:write'] },
    { userId: 3, name: 'Abhay', role: 'Ops', permissions: ['events:write', 'applications:write'] },
    { userId: 4, name: 'Nilesh', role: 'Ops', permissions: ['notifications:resolve'] },
  ];

  const clients = [
    { companyId: 1, companyName: 'Sunrise Markets' },
    { companyId: 2, companyName: 'Vertex Retail Group' },
  ];

  const talent = [
    { talentId: 1, firstName: 'Maria', lastName: 'Lopez', email: 'maria.lopez@example.com', phone: '555-0101', homeMarket: 'Chicago, IL', latitude: 41.88, longitude: -87.63, source: 'PopBookings', pbProfileUrl: 'https://popbookings.com/p/maria', thProfileUrl: null, isDemosStaffId: 4101, noShowCount: 0, completedJobsCount: 12, notes: 'Reliable, strong closer.', lastContactedAt: isoTs(-3, 14), paymentAgreementRequired: false, active: true },
    { talentId: 2, firstName: 'Devon', lastName: 'Clark', email: 'devon.clark@example.com', phone: '555-0102', homeMarket: 'Chicago, IL', latitude: 41.9, longitude: -87.65, source: 'IS-Demos', pbProfileUrl: null, thProfileUrl: null, isDemosStaffId: 4102, noShowCount: 0, completedJobsCount: 8, notes: 'Needs payment agreement on PB bookings.', lastContactedAt: isoTs(-2, 10), paymentAgreementRequired: true, active: true },
    { talentId: 3, firstName: 'Priya', lastName: 'Nair', email: 'priya.nair@example.com', phone: '555-0103', homeMarket: 'Milwaukee, WI', latitude: 43.04, longitude: -87.91, source: 'Internal DB', pbProfileUrl: null, thProfileUrl: 'https://trustedherd.com/p/priya', isDemosStaffId: 4103, noShowCount: 0, completedJobsCount: 3, notes: '', lastContactedAt: null, paymentAgreementRequired: false, active: true },
    { talentId: 4, firstName: 'Jordan', lastName: 'Blake', email: 'jordan.blake@example.com', phone: '555-0104', homeMarket: 'Chicago, IL', latitude: 41.79, longitude: -87.58, source: 'TrustedHerd', pbProfileUrl: null, thProfileUrl: 'https://trustedherd.com/p/jordan', isDemosStaffId: 4104, noShowCount: 1, completedJobsCount: 6, notes: 'One no-show last quarter.', lastContactedAt: isoTs(-10, 16), paymentAgreementRequired: false, active: true },
    { talentId: 5, firstName: 'Sofia', lastName: 'Reyes', email: 'sofia.reyes@example.com', phone: '555-0105', homeMarket: 'Indianapolis, IN', latitude: 39.77, longitude: -86.16, source: 'PopBookings', pbProfileUrl: 'https://popbookings.com/p/sofia', thProfileUrl: null, isDemosStaffId: 4105, noShowCount: 0, completedJobsCount: 15, notes: 'Top performer.', lastContactedAt: isoTs(-5, 11), paymentAgreementRequired: false, active: true },
    { talentId: 6, firstName: 'Ethan', lastName: 'Kim', email: 'ethan.kim@example.com', phone: '555-0106', homeMarket: 'Chicago, IL', latitude: 41.91, longitude: -87.64, source: 'Internal DB', pbProfileUrl: null, thProfileUrl: null, isDemosStaffId: null, noShowCount: 0, completedJobsCount: 1, notes: 'New hire.', lastContactedAt: null, paymentAgreementRequired: true, active: true },
    { talentId: 7, firstName: 'Hannah', lastName: 'Moss', email: 'hannah.moss@example.com', phone: '555-0107', homeMarket: 'Chicago, IL', latitude: 41.85, longitude: -87.66, source: 'PopBookings', pbProfileUrl: 'https://popbookings.com/p/hannah', thProfileUrl: null, isDemosStaffId: 4107, noShowCount: 0, completedJobsCount: 4, notes: '', lastContactedAt: isoTs(-1, 9), paymentAgreementRequired: false, active: true },
    { talentId: 8, firstName: 'Liam', lastName: 'Ortiz', email: 'liam.ortiz@example.com', phone: '555-0108', homeMarket: 'Milwaukee, WI', latitude: 43.02, longitude: -87.92, source: 'TrustedHerd', pbProfileUrl: null, thProfileUrl: 'https://trustedherd.com/p/liam', isDemosStaffId: 4108, noShowCount: 0, completedJobsCount: 2, notes: '', lastContactedAt: null, paymentAgreementRequired: false, active: true },
  ];

  // Event 1 — TODAY, mid-flight: one completed slot, one confirmed slot that
  // has not checked in yet (check-in missing alert), one open slot with applicants.
  // Event 2 — upcoming, posted with a FAILED TrustedHerd row (partial-failure demo).
  // Event 3 — past, fully completed.
  // Event 4 — future, created but NOT posted yet (POST JOB demo).
  const events = [
    { eventId: 1, companyId: 1, program: 'Weekend Demo — Sunrise Central', siteNumber: 'S-118', address: '410 N Michigan Ave', city: 'Chicago', state: 'IL', zip: '60611', eventDate: isoDate(0), startTime: '09:00', endTime: '15:00', payRate: 26.0, positionsRequired: 3, requirements: 'Must be 21+, comfortable standing 5h', dressCode: 'Black polo, khakis', instructions: 'Check in with store manager at front desk. Samples arrive 8:30.', jobCancelled: false, createdAt: isoTs(-7, 10) },
    { eventId: 2, companyId: 1, program: 'Fall Sampling — Sunrise North', siteNumber: 'S-204', address: '5340 N Broadway', city: 'Chicago', state: 'IL', zip: '60640', eventDate: isoDate(7), startTime: '10:00', endTime: '16:00', payRate: 25.0, positionsRequired: 2, requirements: 'Food handler card preferred', dressCode: 'Black polo, khakis', instructions: 'Booth setup near produce.', jobCancelled: false, createdAt: isoTs(-3, 13) },
    { eventId: 3, companyId: 2, program: 'Back-to-School Demo — Vertex Ridge', siteNumber: 'V-77', address: '5600 W 79th St', city: 'Chicago', state: 'IL', zip: '60638', eventDate: isoDate(-14), startTime: '11:00', endTime: '17:00', payRate: 24.5, positionsRequired: 2, requirements: '', dressCode: 'Company tee provided', instructions: '', jobCancelled: false, createdAt: isoTs(-21, 9) },
    { eventId: 4, companyId: 2, program: 'Holiday Launch — Vertex Plaza', siteNumber: 'V-12', address: '1 Plaza Dr', city: 'Chicago', state: 'IL', zip: '60601', eventDate: isoDate(21), startTime: '12:00', endTime: '18:00', payRate: 28.0, positionsRequired: 2, requirements: 'Prior demo experience', dressCode: 'Festive + name badge', instructions: 'Gift-card raffle at booth.', jobCancelled: false, createdAt: isoTs(-1, 15) },
  ];

  const positions = [
    { positionId: 1, eventId: 1, slotNumber: 1, status: 'Completed', assignedTalentId: 1 },
    { positionId: 2, eventId: 1, slotNumber: 2, status: 'Confirmed', assignedTalentId: 2 },
    { positionId: 3, eventId: 1, slotNumber: 3, status: 'Open', assignedTalentId: null },
    { positionId: 4, eventId: 2, slotNumber: 1, status: 'Open', assignedTalentId: null },
    { positionId: 5, eventId: 2, slotNumber: 2, status: 'Open', assignedTalentId: null },
    { positionId: 6, eventId: 3, slotNumber: 1, status: 'Completed', assignedTalentId: 5 },
    { positionId: 7, eventId: 3, slotNumber: 2, status: 'Completed', assignedTalentId: 6 },
    { positionId: 8, eventId: 4, slotNumber: 1, status: 'Open', assignedTalentId: null },
    { positionId: 9, eventId: 4, slotNumber: 2, status: 'Open', assignedTalentId: null },
  ];

  const applications = [
    // Event 1: full pipeline story
    { applicationId: 1, eventId: 1, positionId: 1, talentId: 1, platformSource: 'PopBookings', externalApplicationId: 'PB-a-551', status: 'Completed', appliedAt: isoTs(-6, 9), statusChangedAt: isoTs(-13/24 - 0.1, 17) },
    { applicationId: 2, eventId: 1, positionId: 2, talentId: 2, platformSource: 'IS-Demos', externalApplicationId: 'ISD-a-220', status: 'FinalCheckinPending', appliedAt: isoTs(-6, 10), statusChangedAt: isoTs(-1, 12) },
    { applicationId: 3, eventId: 1, positionId: 3, talentId: 3, platformSource: 'TrustedHerd', externalApplicationId: 'TH-a-118', status: 'Applied', appliedAt: isoTs(-2, 14), statusChangedAt: isoTs(-2, 14) },
    { applicationId: 4, eventId: 1, positionId: 3, talentId: 4, platformSource: 'Internal DB', externalApplicationId: null, status: 'Reviewed', appliedAt: isoTs(-2, 15), statusChangedAt: isoTs(-1, 9) },
    // Event 2: inbox with a Selected candidate ready to BOOK + a Declined example
    { applicationId: 5, eventId: 2, positionId: 4, talentId: 3, platformSource: 'TrustedHerd', externalApplicationId: 'TH-a-131', status: 'Selected', appliedAt: isoTs(-2, 11), statusChangedAt: isoTs(-1, 10) },
    { applicationId: 6, eventId: 2, positionId: 4, talentId: 7, platformSource: 'PopBookings', externalApplicationId: 'PB-a-560', status: 'Applied', appliedAt: isoTs(-2, 12), statusChangedAt: isoTs(-2, 12) },
    { applicationId: 7, eventId: 2, positionId: 5, talentId: 8, platformSource: 'Internal DB', externalApplicationId: null, status: 'Applied', appliedAt: isoTs(-1, 9), statusChangedAt: isoTs(-1, 9) },
    { applicationId: 8, eventId: 2, positionId: 5, talentId: 7, platformSource: 'PopBookings', externalApplicationId: 'PB-a-561', status: 'Declined', appliedAt: isoTs(-2, 13), statusChangedAt: isoTs(-1, 16) },
    // Event 3: history
    { applicationId: 9, eventId: 3, positionId: 6, talentId: 5, platformSource: 'PopBookings', externalApplicationId: 'PB-a-500', status: 'Completed', appliedAt: isoTs(-20, 10), statusChangedAt: isoTs(-13, 18) },
    { applicationId: 10, eventId: 3, positionId: 7, talentId: 6, platformSource: 'Internal DB', externalApplicationId: null, status: 'Completed', appliedAt: isoTs(-20, 11), statusChangedAt: isoTs(-13, 18) },
  ];

  const bookings = [
    { bookingId: 1, positionId: 1, talentId: 1, isDemosShiftId: 73101, externalBookingId: '73101', status: 'Completed', paymentAgreementRequired: false, paymentAgreementAccepted: true, confirmedAt: isoTs(-5, 11) },
    { bookingId: 2, positionId: 2, talentId: 2, isDemosShiftId: 73102, externalBookingId: '73102', status: 'Confirmed', paymentAgreementRequired: true, paymentAgreementAccepted: true, confirmedAt: isoTs(-1, 12) },
    { bookingId: 3, positionId: 5, talentId: 7, isDemosShiftId: 73103, externalBookingId: '73103', status: 'Cancelled', paymentAgreementRequired: false, paymentAgreementAccepted: false, confirmedAt: null },
  ];

  const platformMappings = [
    { mappingId: 1, eventId: 1, platform: 'IS-Demos', externalId: 'job-92810', postStatus: 'Posted', lastSyncedAt: isoTs(-6, 10), retryCount: 0 },
    { mappingId: 2, eventId: 1, platform: 'PopBookings', externalId: '73920', postStatus: 'Posted', lastSyncedAt: isoTs(-6, 10), retryCount: 0 },
    { mappingId: 3, eventId: 1, platform: 'TrustedHerd', externalId: '18274', postStatus: 'Posted', lastSyncedAt: isoTs(-6, 10), retryCount: 0 },
    { mappingId: 4, eventId: 2, platform: 'IS-Demos', externalId: 'job-92811', postStatus: 'Posted', lastSyncedAt: isoTs(-2, 14), retryCount: 0 },
    { mappingId: 5, eventId: 2, platform: 'PopBookings', externalId: '73921', postStatus: 'Posted', lastSyncedAt: isoTs(-2, 14), retryCount: 0 },
    { mappingId: 6, eventId: 2, platform: 'TrustedHerd', externalId: null, postStatus: 'Failed', lastSyncedAt: isoTs(-2, 14), retryCount: 0 },
    { mappingId: 7, eventId: 3, platform: 'IS-Demos', externalId: 'job-92799', postStatus: 'Posted', lastSyncedAt: isoTs(-20, 10), retryCount: 0 },
    { mappingId: 8, eventId: 3, platform: 'PopBookings', externalId: '73888', postStatus: 'Posted', lastSyncedAt: isoTs(-20, 10), retryCount: 0 },
    { mappingId: 9, eventId: 3, platform: 'TrustedHerd', externalId: '18201', postStatus: 'Posted', lastSyncedAt: isoTs(-20, 10), retryCount: 0 },
  ];

  const confirmationEmails = [
    { emailId: 1, bookingId: 1, sentAt: isoTs(-5, 11), deliveryStatus: 'delivered' },
    { emailId: 2, bookingId: 2, sentAt: isoTs(-1, 12), deliveryStatus: 'delivered' },
  ];

  const communicationLogs = [
    { logId: 1, talentId: 2, channel: 'email', direction: 'out', content: 'Booking confirmation — Weekend Demo, slot 2', timestamp: isoTs(-1, 12), teamMember: 'system' },
    { logId: 2, talentId: 7, channel: 'email', direction: 'out', content: 'Booking request — Fall Sampling', timestamp: isoTs(-2, 13), teamMember: 'system' },
  ];

  const notifications = [
    { notificationId: 1, type: 'shift.checkin_missing', severity: 'high', eventId: 1, talentId: 2, timestamp: isoTs(0, 9), assignedTeamMember: 'Kaushal', resolved: false, requiredAction: 'Shift started 09:00 and Devon has not checked in — call/text now.' },
    { notificationId: 2, type: 'platform.post_failed', severity: 'medium', eventId: 2, talentId: null, timestamp: isoTs(-2, 14), assignedTeamMember: 'Abhay', resolved: false, requiredAction: 'TrustedHerd posting failed for Fall Sampling — retry that platform only.' },
    { notificationId: 3, type: 'reporting.required', severity: 'low', eventId: 3, talentId: 6, timestamp: isoTs(-13, 19), assignedTeamMember: 'Nilesh', resolved: true, requiredAction: 'Report submitted late.' },
  ];

  // Minimal history: current status entry per application (runtime transitions append).
  const statusHistory = applications.map((a) => ({
    historyId: a.applicationId,
    applicationId: a.applicationId,
    fromStatus: null,
    toStatus: a.status,
    actor: 'seed',
    note: 'seeded state',
    timestamp: a.statusChangedAt,
  }));

  return {
    sequences: {
      client: 2, event: 4, position: 9, talent: 8, application: 10,
      booking: 3, mapping: 9, email: 2, log: 2, notification: 3,
      history: statusHistory.length, teamMember: 4,
    },
    teamMembers, clients, events, positions, talent, applications, bookings,
    platformMappings, confirmationEmails, communicationLogs, notifications, statusHistory,
  };
}
