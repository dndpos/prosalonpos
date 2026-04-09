import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

var prisma = new PrismaClient();
var pinHash = bcrypt.hashSync('0000', 12);
var pinSha = createHash('sha256').update('0000').digest('hex');

async function main() {
  var salon = await prisma.salon.create({
    data: {
      id: 'salon-01',
      salon_code: '7AVM8Z',
      name: 'Pro Salon POS',
      phone: '(561) 555-0100',
      address1: 'Palm Beach Gardens, FL',
      owner_pin_hash: pinHash,
      owner_pin_sha256: pinSha,
    }
  });

  await prisma.staff.create({
    data: {
      salon_id: salon.id,
      display_name: 'Andy',
      role: 'owner',
      rbac_role: 'owner',
      pin_hash: pinHash,
      pin_sha256: pinSha,
      position: 0,
      tech_turn_eligible: false,
      show_on_calendar: false,
    }
  });

  await prisma.salonSettings.create({
    data: {
      salon_id: salon.id,
      settings: {
        salon_name: 'Pro Salon POS',
        tax_rate_percentage: 7.5,
        tip_presets_array: [18, 20, 25],
        booking_increment_minutes: 15,
        rotation_mode: 'round_robin',
      }
    }
  });

  // ── Provider Owner (ISO account — for Provider Admin Dashboard) ──
  var providerPinHash = bcrypt.hashSync('90706', 12);
  await prisma.providerOwner.create({
    data: {
      id: 'provider-owner-1',
      name: 'Andy Tran',
      email: 'andy@prosalonpos.com',
      pin_hash: providerPinHash,
    }
  });

  console.log('Done! Salon code: 7AVM8Z  Owner PIN: 0000  Provider PIN: 90706');
}

main()
  .then(function() { return prisma.$disconnect(); })
  .catch(function(e) { console.error(e); prisma.$disconnect(); process.exit(1); });
