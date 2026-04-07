-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "display_number" TEXT,
ADD COLUMN     "merged_into" TEXT;

-- AlterTable
ALTER TABLE "TicketItem" ADD COLUMN     "client_id" TEXT;
