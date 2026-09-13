import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const day = 24 * 60 * 60 * 1000;
const isoDate = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * day);
const isoTs = (offsetDays: number, hour = 9) =>
  new Date(new Date(new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10) + 'T00:00:00Z').getTime() + hour * 3600_000);

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing tables in reverse dependency order
  await prisma.confirmationEmail.deleteMany();
  await prisma.communicationLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.application.deleteMany();
  await prisma.position.deleteMany();
  await prisma.platformMapping.deleteMany();
  await prisma.event.deleteMany();
  await prisma.client.deleteMany();
  await prisma.talent.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.platformConfig.deleteMany();

  // 1. Team Members
  const teamMembers = [
    { userId: 1, name: 'Kaushal', email: 'kaushal@habibihub.com', role: 'Lead', permissions: ['*'] },
    { userId: 2, name: 'Chitrank', email: 'chitrank@habibihub.com', role: 'Ops', permissions: ['events:write', 'applications:write'] },
    { userId: 3, name: 'Abhay', email: 'abhay@habibihub.com', role: 'Ops', permissions: ['events:write', 'applications:write'] },
    { userId: 4, name: 'Nilesh', email: 'nilesh@habibihub.com', role: 'Ops', permissions: ['notifications:resolve'] },
  ];
  for (const tm of teamMembers) {
    await prisma.teamMember.create({ data: tm });
  }

  // 2. Clients
  const client1 = await prisma.client.create({ data: { companyId: 1, companyName: 'Sunrise Markets' } });
  const client2 = await prisma.client.create({ data: { companyId: 2, companyName: 'Vertex Retail Group' } });

  // 3. Talent
  const talentData = [
    { talentId: 1, firstName: 'Maria', lastName: 'Lopez', email: 'maria.lopez@example.com', phone: '555-0101', homeMarket: 'Chicago, IL', latitude: 41.88, longitude: -87.63, source: 'PopBookings', pbProfileUrl: 'https://popbookings.com/p/maria', thProfileUrl: null, isDemosStaffId: 4101, noShowCount: 0, completedJobsCount: 12, notes: 'Reliable, strong closer.', lastContactedAt: isoTs(-3, 14) },
    { talentId: 2, firstName: 'Devon', lastName: 'Clark', email: 'devon.clark@example.com', phone: '555-0102', homeMarket: 'Chicago, IL', latitude: 41.90, longitude: -87.65, source: 'IS-Demos', pbProfileUrl: null, thProfileUrl: null, isDemosStaffId: 4102, noShowCount: 0, completedJobsCount: 8, notes: 'Needs payment agreement on PB bookings.', lastContactedAt: isoTs(-2, 10) },
    { talentId: 3, firstName: 'Priya', lastName: 'Nair', email: 'priya.nair@example.com', phone: '555-0103', homeMarket: 'Milwaukee, WI', latitude: 43.04, longitude: -87.91, source: 'Internal DB', pbProfileUrl: null, thProfileUrl: 'https://trustedherd.com/p/priya', isDemosStaffId: 4103, noShowCount: 0, completedJobsCount: 3, notes: '', lastContactedAt: null },
    { talentId: 4, firstName: 'Jordan', lastName: 'Blake', email: 'jordan.blake@example.com', phone: '555-0104', homeMarket: 'Chicago, IL', latitude: 41.79, longitude: -87.58, source: 'TrustedHerd', pbProfileUrl: null, thProfileUrl: 'https://trustedherd.com/p/jordan', isDemosStaffId: 4104, noShowCount: 1, completedJobsCount: 6, notes: 'One no-show last quarter.', lastContactedAt: isoTs(-10, 16) },
    { talentId: 5, firstName: 'Sofia', lastName: 'Reyes', email: 'sofia.reyes@example.com', phone: '555-0105', homeMarket: 'Indianapolis, IN', latitude: 39.77, longitude: -86.16, source: 'PopBookings', pbProfileUrl: 'https://popbookings.com/p/sofia', thProfileUrl: null, isDemosStaffId: 4105, noShowCount: 0, completedJobsCount: 15, notes: 'Top performer.', lastContactedAt: isoTs(-5, 11) },
    { talentId: 6, firstName: 'Ethan', lastName: 'Kim', email: 'ethan.kim@example.com', phone: '555-0106', homeMarket: 'Chicago, IL', latitude: 41.91, longitude: -87.64, source: 'Internal DB', pbProfileUrl: null, thProfileUrl: null, isDemosStaffId: null, noShowCount: 0, completedJobsCount: 1, notes: 'New hire.', lastContactedAt: null },
    { talentId: 7, firstName: 'Hannah', lastName: 'Moss', email: 'hannah.moss@example.com', phone: '555-0107', homeMarket: 'Chicago, IL', latitude: 41.85, longitude: -87.66, source: 'PopBookings', pbProfileUrl: 'https://popbookings.com/p/hannah', thProfileUrl: null, isDemosStaffId: 4107, noShowCount: 0, completedJobsCount: 4, notes: '', lastContactedAt: isoTs(-1, 9) },
    { talentId: 8, firstName: 'Liam', lastName: 'Ortiz', email: 'liam.ortiz@example.com', phone: '555-0108', homeMarket: 'Milwaukee, WI', latitude: 43.02, longitude: -87.92, source: 'TrustedHerd', pbProfileUrl: null, thProfileUrl: 'https://trustedherd.com/p/liam', isDemosStaffId: 4108, noShowCount: 0, completedJobsCount: 2, notes: '', lastContactedAt: null },
  ];
  for (const t of talentData) {
    await prisma.talent.create({ data: t });
  }

  // 4. Events
  const eventsData = [
    { eventId: 1, companyId: client1.companyId, program: 'Weekend Demo — Sunrise Central', siteNumber: 'S-118', address: '410 N Michigan Ave', city: 'Chicago', state: 'IL', zip: '60611', eventDate: isoDate(0), startTime: '09:00', endTime: '15:00', payRate: 26.0, positionsRequired: 3, requirements: 'Must be 21+, comfortable standing 5h', dressCode: 'Black polo, khakis', instructions: 'Check in with store manager at front desk. Samples arrive 8:30.', jobCancelled: false, createdAt: isoTs(-7, 10) },
    { eventId: 2, companyId: client1.companyId, program: 'Fall Sampling — Sunrise North', siteNumber: 'S-204', address: '5340 N Broadway', city: 'Chicago', state: 'IL', zip: '60640', eventDate: isoDate(7), startTime: '10:00', endTime: '16:00', payRate: 25.0, positionsRequired: 2, requirements: 'Food handler card preferred', dressCode: 'Black polo, khakis', instructions: 'Booth setup near produce.', jobCancelled: false, createdAt: isoTs(-3, 13) },
    { eventId: 3, companyId: client2.companyId, program: 'Back-to-School Demo — Vertex Ridge', siteNumber: 'V-77', address: '5600 W 79th St', city: 'Chicago', state: 'IL', zip: '60638', eventDate: isoDate(-14), startTime: '11:00', endTime: '17:00', payRate: 24.5, positionsRequired: 2, requirements: '', dressCode: 'Company tee provided', instructions: '', jobCancelled: false, createdAt: isoTs(-21, 9) },
    { eventId: 4, companyId: client2.companyId, program: 'Holiday Launch — Vertex Plaza', siteNumber: 'V-12', address: '1 Plaza Dr', city: 'Chicago', state: 'IL', zip: '60601', eventDate: isoDate(21), startTime: '12:00', endTime: '18:00', payRate: 28.0, positionsRequired: 2, requirements: 'Prior demo experience', dressCode: 'Festive + name badge', instructions: 'Gift-card raffle at booth.', jobCancelled: false, createdAt: isoTs(-1, 15) },
  ];
  for (const ev of eventsData) {
    await prisma.event.create({ data: ev });
  }

  // 5. Positions
  const positionsData = [
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
  for (const pos of positionsData) {
    await prisma.position.create({ data: pos });
  }

  // 6. Applications
  const applicationsData = [
    { applicationId: 1, eventId: 1, positionId: 1, talentId: 1, platformSource: 'PopBookings', externalApplicationId: 'PB-a-551', status: 'Completed', appliedAt: isoTs(-6, 9), statusChangedAt: isoTs(-1, 17) },
    { applicationId: 2, eventId: 1, positionId: 2, talentId: 2, platformSource: 'IS-Demos', externalApplicationId: 'ISD-a-220', status: 'FinalCheckinPending', appliedAt: isoTs(-6, 10), statusChangedAt: isoTs(-1, 12) },
    { applicationId: 3, eventId: 1, positionId: 3, talentId: 3, platformSource: 'TrustedHerd', externalApplicationId: 'TH-a-118', status: 'Applied', appliedAt: isoTs(-2, 14), statusChangedAt: isoTs(-2, 14) },
    { applicationId: 4, eventId: 1, positionId: 3, talentId: 4, platformSource: 'Internal DB', externalApplicationId: null, status: 'Reviewed', appliedAt: isoTs(-2, 15), statusChangedAt: isoTs(-1, 9) },
    { applicationId: 5, eventId: 2, positionId: 4, talentId: 3, platformSource: 'TrustedHerd', externalApplicationId: 'TH-a-131', status: 'Selected', appliedAt: isoTs(-2, 11), statusChangedAt: isoTs(-1, 10) },
    { applicationId: 6, eventId: 2, positionId: 4, talentId: 7, platformSource: 'PopBookings', externalApplicationId: 'PB-a-560', status: 'Applied', appliedAt: isoTs(-2, 12), statusChangedAt: isoTs(-2, 12) },
    { applicationId: 7, eventId: 2, positionId: 5, talentId: 8, platformSource: 'Internal DB', externalApplicationId: null, status: 'Applied', appliedAt: isoTs(-1, 9), statusChangedAt: isoTs(-1, 9) },
    { applicationId: 8, eventId: 2, positionId: 5, talentId: 7, platformSource: 'PopBookings', externalApplicationId: 'PB-a-561', status: 'Declined', appliedAt: isoTs(-2, 13), statusChangedAt: isoTs(-1, 16) },
    { applicationId: 9, eventId: 3, positionId: 6, talentId: 5, platformSource: 'PopBookings', externalApplicationId: 'PB-a-500', status: 'Completed', appliedAt: isoTs(-20, 10), statusChangedAt: isoTs(-13, 18) },
    { applicationId: 10, eventId: 3, positionId: 7, talentId: 6, platformSource: 'Internal DB', externalApplicationId: null, status: 'Completed', appliedAt: isoTs(-20, 11), statusChangedAt: isoTs(-13, 18) },
  ];
  for (const app of applicationsData) {
    await prisma.application.create({ data: app });
  }

  // 7. Bookings
  const bookingsData = [
    { bookingId: 1, positionId: 1, talentId: 1, isDemosShiftId: 73101, externalBookingId: '73101', status: 'Completed', paymentAgreementRequired: false, paymentAgreementAccepted: true, confirmedAt: isoTs(-5, 11) },
    { bookingId: 2, positionId: 2, talentId: 2, isDemosShiftId: 73102, externalBookingId: '73102', status: 'Confirmed', paymentAgreementRequired: true, paymentAgreementAccepted: true, confirmedAt: isoTs(-1, 12) },
  ];
  for (const b of bookingsData) {
    await prisma.booking.create({ data: b });
  }

  // 8. Platform Mappings
  const mappingsData = [
    { id: 1, eventId: 1, platform: 'isdemos', externalId: 'job-92810', postStatus: 'Posted', lastSyncedAt: isoTs(-6, 10) },
    { id: 2, eventId: 1, platform: 'popbookings', externalId: '73920', postStatus: 'Posted', lastSyncedAt: isoTs(-6, 10) },
    { id: 3, eventId: 1, platform: 'trustedherd', externalId: '18274', postStatus: 'Posted', lastSyncedAt: isoTs(-6, 10) },
    { id: 4, eventId: 2, platform: 'isdemos', externalId: 'job-92811', postStatus: 'Posted', lastSyncedAt: isoTs(-2, 14) },
    { id: 5, eventId: 2, platform: 'popbookings', externalId: '73921', postStatus: 'Posted', lastSyncedAt: isoTs(-2, 14) },
    { id: 6, eventId: 2, platform: 'trustedherd', externalId: null, postStatus: 'Failed', lastSyncedAt: isoTs(-2, 14) },
    { id: 7, eventId: 3, platform: 'isdemos', externalId: 'job-92799', postStatus: 'Posted', lastSyncedAt: isoTs(-20, 10) },
    { id: 8, eventId: 3, platform: 'popbookings', externalId: '73888', postStatus: 'Posted', lastSyncedAt: isoTs(-20, 10) },
    { id: 9, eventId: 3, platform: 'trustedherd', externalId: '18201', postStatus: 'Posted', lastSyncedAt: isoTs(-20, 10) },
  ];
  for (const pm of mappingsData) {
    await prisma.platformMapping.create({ data: pm });
  }

  // 9. Confirmation Emails
  await prisma.confirmationEmail.create({ data: { emailId: 1, bookingId: 1, sentAt: isoTs(-5, 11), deliveryStatus: 'delivered' } });
  await prisma.confirmationEmail.create({ data: { emailId: 2, bookingId: 2, sentAt: isoTs(-1, 12), deliveryStatus: 'delivered' } });

  // 10. Communication Logs
  await prisma.communicationLog.create({ data: { logId: 1, talentId: 2, channel: 'Email', direction: 'Outbound', content: 'Booking confirmation — Weekend Demo, slot 2', timestamp: isoTs(-1, 12), teamMember: 'system' } });
  await prisma.communicationLog.create({ data: { logId: 2, talentId: 7, channel: 'Email', direction: 'Outbound', content: 'Booking request — Fall Sampling', timestamp: isoTs(-2, 13), teamMember: 'system' } });

  // 11. Notifications
  const notificationsData = [
    { notificationId: 1, type: 'checkin_missing', severity: 'High', eventId: 1, talentId: 2, timestamp: isoTs(0, 9), assignedTeamMember: 'Chitrank', resolved: false, requiredAction: 'Call Devon Clark (555-0102) — shift started at 09:00, no check-in recorded.' },
    { notificationId: 2, type: 'posting_failed', severity: 'Medium', eventId: 2, talentId: null, timestamp: isoTs(-2, 14), assignedTeamMember: 'Abhay', resolved: false, requiredAction: 'TrustedHerd posting failed for Fall Sampling — Sunrise North. Click RETRY.' },
    { notificationId: 3, type: 'replacement_required', severity: 'High', eventId: 2, talentId: 7, timestamp: isoTs(-1, 16), assignedTeamMember: 'Chitrank', resolved: false, requiredAction: 'Hannah Moss declined slot 2 for Fall Sampling — Sunrise North. Review inbox to re-select.' },
  ];
  for (const n of notificationsData) {
    await prisma.notification.create({ data: n });
  }

  // 12. Platform Configs
  await prisma.platformConfig.create({ data: { platform: 'isdemos', baseUrl: 'https://api.isdemos.com', apiKeyRef: 'ISDEMOS_API_KEY', scopes: ['jobs.read', 'jobs.write', 'bookings.write'] } });
  await prisma.platformConfig.create({ data: { platform: 'popbookings', baseUrl: 'https://popbookings.com/api', apiKeyRef: 'POPBOOKINGS_API_KEY', scopes: ['jobs.write'] } });
  await prisma.platformConfig.create({ data: { platform: 'trustedherd', baseUrl: 'https://trustedherd.com/api', apiKeyRef: 'TRUSTEDHERD_API_KEY', scopes: ['jobs.write'] } });

  // 13. Reset Postgres auto-increment sequences to max IDs
  await prisma.$executeRawUnsafe(`SELECT setval('clients_company_id_seq', (SELECT COALESCE(MAX(company_id), 1) FROM clients));`);
  await prisma.$executeRawUnsafe(`SELECT setval('talent_talent_id_seq', (SELECT COALESCE(MAX(talent_id), 1) FROM talent));`);
  await prisma.$executeRawUnsafe(`SELECT setval('events_event_id_seq', (SELECT COALESCE(MAX(event_id), 1) FROM events));`);
  await prisma.$executeRawUnsafe(`SELECT setval('positions_position_id_seq', (SELECT COALESCE(MAX(position_id), 1) FROM positions));`);
  await prisma.$executeRawUnsafe(`SELECT setval('applications_application_id_seq', (SELECT COALESCE(MAX(application_id), 1) FROM applications));`);
  await prisma.$executeRawUnsafe(`SELECT setval('bookings_booking_id_seq', (SELECT COALESCE(MAX(booking_id), 1) FROM bookings));`);
  await prisma.$executeRawUnsafe(`SELECT setval('platform_mappings_id_seq', (SELECT COALESCE(MAX(id), 1) FROM platform_mappings));`);
  await prisma.$executeRawUnsafe(`SELECT setval('confirmation_emails_email_id_seq', (SELECT COALESCE(MAX(email_id), 1) FROM confirmation_emails));`);
  await prisma.$executeRawUnsafe(`SELECT setval('communication_logs_log_id_seq', (SELECT COALESCE(MAX(log_id), 1) FROM communication_logs));`);
  await prisma.$executeRawUnsafe(`SELECT setval('notifications_notification_id_seq', (SELECT COALESCE(MAX(notification_id), 1) FROM notifications));`);
  await prisma.$executeRawUnsafe(`SELECT setval('team_members_user_id_seq', (SELECT COALESCE(MAX(user_id), 1) FROM team_members));`);

  console.log('✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
