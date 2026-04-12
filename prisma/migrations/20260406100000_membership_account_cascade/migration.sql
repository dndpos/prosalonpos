-- AlterTable: Add CASCADE delete to MembershipAccount.plan_id
ALTER TABLE "MembershipAccount" DROP CONSTRAINT IF EXISTS "MembershipAccount_plan_id_fkey";
ALTER TABLE "MembershipAccount" ADD CONSTRAINT "MembershipAccount_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
