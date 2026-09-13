-- CreateTable
CREATE TABLE "clients" (
    "company_id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "events" (
    "event_id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "program" TEXT NOT NULL,
    "site_number" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "pay_rate" DECIMAL(10,2) NOT NULL,
    "positions_required" INTEGER NOT NULL,
    "requirements" TEXT,
    "dress_code" TEXT,
    "instructions" TEXT,
    "job_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "positions" (
    "position_id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "slot_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "assigned_talent_id" INTEGER,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("position_id")
);

-- CreateTable
CREATE TABLE "talent" (
    "talent_id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "home_market" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "source" TEXT,
    "pb_profile_url" TEXT,
    "th_profile_url" TEXT,
    "is_demos_staff_id" INTEGER,
    "no_show_count" INTEGER NOT NULL DEFAULT 0,
    "completed_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "last_contacted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_pkey" PRIMARY KEY ("talent_id")
);

-- CreateTable
CREATE TABLE "applications" (
    "application_id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "position_id" INTEGER NOT NULL,
    "talent_id" INTEGER NOT NULL,
    "platform_source" TEXT NOT NULL,
    "external_application_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Applied',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("application_id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "booking_id" SERIAL NOT NULL,
    "position_id" INTEGER NOT NULL,
    "talent_id" INTEGER NOT NULL,
    "is_demos_shift_id" INTEGER,
    "external_booking_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Confirmed',
    "payment_agreement_required" BOOLEAN NOT NULL DEFAULT false,
    "payment_agreement_accepted" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("booking_id")
);

-- CreateTable
CREATE TABLE "platform_mappings" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "external_id" TEXT,
    "post_status" TEXT NOT NULL DEFAULT 'Pending',
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmation_emails" (
    "email_id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivery_status" TEXT NOT NULL DEFAULT 'Sent',

    CONSTRAINT "confirmation_emails_pkey" PRIMARY KEY ("email_id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "log_id" SERIAL NOT NULL,
    "talent_id" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "team_member" TEXT,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "event_id" INTEGER,
    "talent_id" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_team_member" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "required_action" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "user_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Ops',
    "permissions" JSONB,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "platform_configs" (
    "platform" TEXT NOT NULL,
    "api_key_ref" TEXT,
    "base_url" TEXT,
    "scopes" JSONB,

    CONSTRAINT "platform_configs_pkey" PRIMARY KEY ("platform")
);

-- CreateIndex
CREATE UNIQUE INDEX "talent_email_key" ON "talent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "talent_phone_key" ON "talent"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_position_id_key" ON "bookings"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_mappings_event_id_platform_key" ON "platform_mappings"("event_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_email_key" ON "team_members"("email");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "clients"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_assigned_talent_id_fkey" FOREIGN KEY ("assigned_talent_id") REFERENCES "talent"("talent_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("position_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talent"("talent_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("position_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talent"("talent_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_mappings" ADD CONSTRAINT "platform_mappings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmation_emails" ADD CONSTRAINT "confirmation_emails_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talent"("talent_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talent"("talent_id") ON DELETE SET NULL ON UPDATE CASCADE;
