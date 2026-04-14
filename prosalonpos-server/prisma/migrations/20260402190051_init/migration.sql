-- CreateTable
CREATE TABLE "Salon" (
    "id" TEXT NOT NULL,
    "salon_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "owner_name" TEXT,
    "owner_phone" TEXT,
    "owner_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan_tier" TEXT NOT NULL DEFAULT 'basic',
    "station_count" INTEGER NOT NULL DEFAULT 1,
    "license_key" TEXT,
    "processing_rate" DOUBLE PRECISION NOT NULL DEFAULT 2.49,
    "monthly_software_fee_cents" INTEGER NOT NULL DEFAULT 7900,
    "signup_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trial_end_date" TIMESTAMP(3),
    "assigned_agent_id" TEXT,
    "features_enabled" JSONB,
    "owner_pin_hash" TEXT,
    "owner_pin_sha256" TEXT,

    CONSTRAINT "Salon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "photo_url" TEXT,
    "role" TEXT NOT NULL DEFAULT 'technician',
    "rbac_role" TEXT NOT NULL DEFAULT 'tech',
    "pin_hash" TEXT NOT NULL,
    "pin_sha256" TEXT,
    "pin_plain" TEXT,
    "badge_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tech_turn_eligible" BOOLEAN NOT NULL DEFAULT true,
    "pay_type" TEXT NOT NULL DEFAULT 'commission',
    "commission_pct" INTEGER NOT NULL DEFAULT 0,
    "daily_guarantee_cents" INTEGER NOT NULL DEFAULT 0,
    "hourly_rate_cents" INTEGER,
    "commission_bonus_enabled" BOOLEAN NOT NULL DEFAULT false,
    "salary_amount_cents" INTEGER,
    "salary_period" TEXT,
    "payout_check_pct" INTEGER NOT NULL DEFAULT 100,
    "payout_bonus_pct" INTEGER NOT NULL DEFAULT 0,
    "category_commission_rates" JSONB,
    "permission_overrides" JSONB,
    "permissions" JSONB,
    "schedule" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calendar_color" TEXT NOT NULL DEFAULT '#3B82F6',
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCatalog" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calendar_color" TEXT NOT NULL DEFAULT '#3B82F6',
    "default_duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "product_cost_cents" INTEGER NOT NULL DEFAULT 0,
    "open_price" BOOLEAN NOT NULL DEFAULT false,
    "requires_room" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "online_booking_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ServiceCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCatalogCategory" (
    "id" TEXT NOT NULL,
    "service_catalog_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceCatalogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceStaffAssignment" (
    "id" TEXT NOT NULL,
    "service_catalog_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,

    CONSTRAINT "ServiceStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryStaffAssignment" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,

    CONSTRAINT "CategoryStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "phone_digits" TEXT,
    "email" TEXT,
    "outstanding_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "promo_opt_out" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "client_id" TEXT,
    "client_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'staff',
    "booking_group_id" TEXT,
    "requested" BOOLEAN NOT NULL DEFAULT false,
    "deposit_cents" INTEGER NOT NULL DEFAULT 0,
    "deposit_status" TEXT NOT NULL DEFAULT 'none',
    "walk_in" BOOLEAN NOT NULL DEFAULT false,
    "checked_in_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLine" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "service_catalog_id" TEXT,
    "staff_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "calendar_color" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "client_name" TEXT,
    "service_name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ServiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedTime" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "dur" INTEGER NOT NULL,
    "start_min" INTEGER NOT NULL,
    "end_min" INTEGER NOT NULL,
    "block_type" TEXT NOT NULL DEFAULT 'blocked',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "BlockedTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "ticket_number" INTEGER NOT NULL DEFAULT 0,
    "appointment_id" TEXT,
    "client_id" TEXT,
    "client_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "tip_cents" INTEGER NOT NULL DEFAULT 0,
    "surcharge_cents" INTEGER NOT NULL DEFAULT 0,
    "deposit_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "payment_method" TEXT,
    "cashier_id" TEXT,
    "cashier_name" TEXT,
    "tip_distributions" JSONB,
    "void_reason" TEXT,
    "void_by" TEXT,
    "void_at" TIMESTAMP(3),
    "refund_cents" INTEGER NOT NULL DEFAULT 0,
    "refund_reason" TEXT,
    "refund_by" TEXT,
    "refund_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketItem" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'service',
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "original_price_cents" INTEGER NOT NULL DEFAULT 0,
    "tech_id" TEXT,
    "tech_name" TEXT,
    "service_id" TEXT,
    "product_id" TEXT,
    "color" TEXT,

    CONSTRAINT "TicketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPayment" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "gc_id" TEXT,
    "gc_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonSettings" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalonSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'physical',
    "initial_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "balance_cents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "client_id" TEXT,
    "client_name" TEXT,
    "purchased_by_client_id" TEXT,
    "purchased_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardTransaction" (
    "id" TEXT NOT NULL,
    "gift_card_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "balance_after_cents" INTEGER NOT NULL,
    "staff_id" TEXT,
    "staff_name" TEXT,
    "ticket_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "points_per_dollar" INTEGER NOT NULL DEFAULT 1,
    "points_name" TEXT NOT NULL DEFAULT 'points',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_points" INTEGER NOT NULL DEFAULT 0,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyReward" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "points_required" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'discount',
    "value_cents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT,
    "ticket_id" TEXT,
    "reward_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "billing_interval" TEXT NOT NULL DEFAULT 'monthly',
    "included_services" JSONB,
    "discount_pct" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPerk" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'discount',
    "value" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MembershipPerk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipAccount" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "start_date" TIMESTAMP(3) NOT NULL,
    "next_billing" TIMESTAMP(3),
    "frozen_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MembershipAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "low_stock_qty" INTEGER NOT NULL DEFAULT 5,
    "supplier_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "staff_id" TEXT,
    "applies_to" TEXT NOT NULL DEFAULT 'service',
    "scope" TEXT NOT NULL DEFAULT 'flat',
    "category_id" TEXT,
    "service_catalog_id" TEXT,
    "product_id" TEXT,
    "percentage" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionTier" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "staff_id" TEXT,
    "min_revenue_cents" INTEGER NOT NULL DEFAULT 0,
    "percentage" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CommissionTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClockPunch" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClockPunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'sms',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLogEntry" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "client_id" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderOwner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "pin_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "pin_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'support',
    "visibility" TEXT NOT NULL DEFAULT 'assigned',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderSalonNote" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSalonNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderBillingRecord" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "method" TEXT NOT NULL DEFAULT 'N/A',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderBillingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderAuditLog" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "salon_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePackage" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "expiration_enabled" BOOLEAN NOT NULL DEFAULT false,
    "expiration_days" INTEGER,
    "transferable" BOOLEAN NOT NULL DEFAULT false,
    "refundable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePackageItem" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ServicePackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPackage" (
    "id" TEXT NOT NULL,
    "salon_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "package_name" TEXT NOT NULL,
    "price_paid_cents" INTEGER NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "transferable" BOOLEAN NOT NULL DEFAULT false,
    "refundable" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sold_by_staff_id" TEXT,
    "sold_by_staff_name" TEXT,

    CONSTRAINT "ClientPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPackageItem" (
    "id" TEXT NOT NULL,
    "client_package_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "total_quantity" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,

    CONSTRAINT "ClientPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageRedemption" (
    "id" TEXT NOT NULL,
    "client_package_id" TEXT NOT NULL,
    "client_package_item_id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "service_redeemed_id" TEXT NOT NULL,
    "service_redeemed_name" TEXT NOT NULL,
    "package_service_id" TEXT NOT NULL,
    "package_service_name" TEXT NOT NULL,
    "upgrade_difference_cents" INTEGER NOT NULL DEFAULT 0,
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staff_id" TEXT,
    "staff_name" TEXT,

    CONSTRAINT "PackageRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Salon_salon_code_key" ON "Salon"("salon_code");

-- CreateIndex
CREATE UNIQUE INDEX "Salon_license_key_key" ON "Salon"("license_key");

-- CreateIndex
CREATE INDEX "Staff_salon_id_idx" ON "Staff"("salon_id");

-- CreateIndex
CREATE INDEX "Staff_salon_id_active_idx" ON "Staff"("salon_id", "active");

-- CreateIndex
CREATE INDEX "ServiceCategory_salon_id_idx" ON "ServiceCategory"("salon_id");

-- CreateIndex
CREATE INDEX "ServiceCatalog_salon_id_idx" ON "ServiceCatalog"("salon_id");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalogCategory_service_catalog_id_category_id_key" ON "ServiceCatalogCategory"("service_catalog_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceStaffAssignment_service_catalog_id_staff_id_key" ON "ServiceStaffAssignment"("service_catalog_id", "staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryStaffAssignment_category_id_staff_id_key" ON "CategoryStaffAssignment"("category_id", "staff_id");

-- CreateIndex
CREATE INDEX "Client_salon_id_idx" ON "Client"("salon_id");

-- CreateIndex
CREATE INDEX "Client_salon_id_phone_digits_idx" ON "Client"("salon_id", "phone_digits");

-- CreateIndex
CREATE INDEX "Client_salon_id_last_name_idx" ON "Client"("salon_id", "last_name");

-- CreateIndex
CREATE INDEX "Appointment_salon_id_idx" ON "Appointment"("salon_id");

-- CreateIndex
CREATE INDEX "Appointment_salon_id_status_idx" ON "Appointment"("salon_id", "status");

-- CreateIndex
CREATE INDEX "ServiceLine_appointment_id_idx" ON "ServiceLine"("appointment_id");

-- CreateIndex
CREATE INDEX "ServiceLine_staff_id_starts_at_idx" ON "ServiceLine"("staff_id", "starts_at");

-- CreateIndex
CREATE INDEX "ServiceLine_starts_at_idx" ON "ServiceLine"("starts_at");

-- CreateIndex
CREATE INDEX "BlockedTime_salon_id_staff_id_idx" ON "BlockedTime"("salon_id", "staff_id");

-- CreateIndex
CREATE INDEX "Ticket_salon_id_idx" ON "Ticket"("salon_id");

-- CreateIndex
CREATE INDEX "Ticket_salon_id_created_at_idx" ON "Ticket"("salon_id", "created_at");

-- CreateIndex
CREATE INDEX "Ticket_salon_id_ticket_number_idx" ON "Ticket"("salon_id", "ticket_number");

-- CreateIndex
CREATE INDEX "TicketItem_ticket_id_idx" ON "TicketItem"("ticket_id");

-- CreateIndex
CREATE INDEX "TicketPayment_ticket_id_idx" ON "TicketPayment"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "SalonSettings_salon_id_key" ON "SalonSettings"("salon_id");

-- CreateIndex
CREATE INDEX "GiftCard_salon_id_idx" ON "GiftCard"("salon_id");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_salon_id_code_key" ON "GiftCard"("salon_id", "code");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_gift_card_id_idx" ON "GiftCardTransaction"("gift_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyProgram_salon_id_key" ON "LoyaltyProgram"("salon_id");

-- CreateIndex
CREATE INDEX "LoyaltyTier_program_id_idx" ON "LoyaltyTier"("program_id");

-- CreateIndex
CREATE INDEX "LoyaltyReward_program_id_idx" ON "LoyaltyReward"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_client_id_key" ON "LoyaltyAccount"("client_id");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_salon_id_idx" ON "LoyaltyAccount"("salon_id");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_salon_id_idx" ON "LoyaltyTransaction"("salon_id");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_client_id_idx" ON "LoyaltyTransaction"("client_id");

-- CreateIndex
CREATE INDEX "MembershipPlan_salon_id_idx" ON "MembershipPlan"("salon_id");

-- CreateIndex
CREATE INDEX "MembershipPerk_plan_id_idx" ON "MembershipPerk"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipAccount_client_id_key" ON "MembershipAccount"("client_id");

-- CreateIndex
CREATE INDEX "ProductCategory_salon_id_idx" ON "ProductCategory"("salon_id");

-- CreateIndex
CREATE INDEX "Product_salon_id_idx" ON "Product"("salon_id");

-- CreateIndex
CREATE INDEX "Supplier_salon_id_idx" ON "Supplier"("salon_id");

-- CreateIndex
CREATE INDEX "CommissionRule_salon_id_idx" ON "CommissionRule"("salon_id");

-- CreateIndex
CREATE INDEX "CommissionTier_salon_id_idx" ON "CommissionTier"("salon_id");

-- CreateIndex
CREATE INDEX "ClockPunch_staff_id_timestamp_idx" ON "ClockPunch"("staff_id", "timestamp");

-- CreateIndex
CREATE INDEX "MessageTemplate_salon_id_type_idx" ON "MessageTemplate"("salon_id", "type");

-- CreateIndex
CREATE INDEX "MessageLogEntry_salon_id_sent_at_idx" ON "MessageLogEntry"("salon_id", "sent_at");

-- CreateIndex
CREATE INDEX "ProviderSalonNote_salon_id_idx" ON "ProviderSalonNote"("salon_id");

-- CreateIndex
CREATE INDEX "ProviderBillingRecord_salon_id_idx" ON "ProviderBillingRecord"("salon_id");

-- CreateIndex
CREATE INDEX "ProviderAuditLog_salon_id_idx" ON "ProviderAuditLog"("salon_id");

-- CreateIndex
CREATE INDEX "ProviderAuditLog_actor_id_idx" ON "ProviderAuditLog"("actor_id");

-- CreateIndex
CREATE INDEX "ServicePackage_salon_id_idx" ON "ServicePackage"("salon_id");

-- CreateIndex
CREATE INDEX "ServicePackage_location_id_idx" ON "ServicePackage"("location_id");

-- CreateIndex
CREATE INDEX "ServicePackageItem_package_id_idx" ON "ServicePackageItem"("package_id");

-- CreateIndex
CREATE INDEX "ClientPackage_salon_id_idx" ON "ClientPackage"("salon_id");

-- CreateIndex
CREATE INDEX "ClientPackage_client_id_idx" ON "ClientPackage"("client_id");

-- CreateIndex
CREATE INDEX "ClientPackage_package_id_idx" ON "ClientPackage"("package_id");

-- CreateIndex
CREATE INDEX "ClientPackageItem_client_package_id_idx" ON "ClientPackageItem"("client_package_id");

-- CreateIndex
CREATE INDEX "PackageRedemption_client_package_id_idx" ON "PackageRedemption"("client_package_id");

-- CreateIndex
CREATE INDEX "PackageRedemption_client_package_item_id_idx" ON "PackageRedemption"("client_package_item_id");

-- AddForeignKey
ALTER TABLE "Salon" ADD CONSTRAINT "Salon_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "ProviderAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCatalog" ADD CONSTRAINT "ServiceCatalog_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCatalogCategory" ADD CONSTRAINT "ServiceCatalogCategory_service_catalog_id_fkey" FOREIGN KEY ("service_catalog_id") REFERENCES "ServiceCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCatalogCategory" ADD CONSTRAINT "ServiceCatalogCategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaffAssignment" ADD CONSTRAINT "ServiceStaffAssignment_service_catalog_id_fkey" FOREIGN KEY ("service_catalog_id") REFERENCES "ServiceCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaffAssignment" ADD CONSTRAINT "ServiceStaffAssignment_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryStaffAssignment" ADD CONSTRAINT "CategoryStaffAssignment_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryStaffAssignment" ADD CONSTRAINT "CategoryStaffAssignment_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLine" ADD CONSTRAINT "ServiceLine_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLine" ADD CONSTRAINT "ServiceLine_service_catalog_id_fkey" FOREIGN KEY ("service_catalog_id") REFERENCES "ServiceCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLine" ADD CONSTRAINT "ServiceLine_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedTime" ADD CONSTRAINT "BlockedTime_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketItem" ADD CONSTRAINT "TicketItem_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPayment" ADD CONSTRAINT "TicketPayment_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonSettings" ADD CONSTRAINT "SalonSettings_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "GiftCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPerk" ADD CONSTRAINT "MembershipPerk_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipAccount" ADD CONSTRAINT "MembershipAccount_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipAccount" ADD CONSTRAINT "MembershipAccount_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionTier" ADD CONSTRAINT "CommissionTier_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockPunch" ADD CONSTRAINT "ClockPunch_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLogEntry" ADD CONSTRAINT "MessageLogEntry_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSalonNote" ADD CONSTRAINT "ProviderSalonNote_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderBillingRecord" ADD CONSTRAINT "ProviderBillingRecord_salon_id_fkey" FOREIGN KEY ("salon_id") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "ServicePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "ServicePackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPackageItem" ADD CONSTRAINT "ClientPackageItem_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "ClientPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "ClientPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRedemption" ADD CONSTRAINT "PackageRedemption_client_package_item_id_fkey" FOREIGN KEY ("client_package_item_id") REFERENCES "ClientPackageItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
