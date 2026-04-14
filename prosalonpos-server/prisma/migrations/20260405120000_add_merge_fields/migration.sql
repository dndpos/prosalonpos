-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "merged_into" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "display_number" TEXT;
ALTER TABLE "TicketItem" ADD COLUMN "client_id" TEXT;
