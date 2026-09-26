// DRAFT — NOT RUN. Printed for review only, same gate as the
// BcciAssociationReference model itself (prisma/schema.prisma) — do not
// run this until there's an explicit go-ahead, and not before that model
// has actually been pushed to the target database (it currently has not).
//
// Seeds the real, canonical list of 36 BCCI full/associate member state
// and UT cricket associations (docs/AthlasX_Legal_Consent_and_Association_Research.md)
// into BcciAssociationReference — reference/lookup data only, so
// association names entered elsewhere in the system can be checked
// against real entities. Deliberately does NOT create rows in the
// operational `Association` model — this would fabricate 36 fake tenants
// (with no staff, no trial cycles, nothing real behind them), which is
// not what this data is for.
//
// Run with: npx tsx prisma/seed-bcci-associations.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const BCCI_ASSOCIATIONS: { name: string; state_or_ut: string }[] = [
  { name: 'Andhra Cricket Association', state_or_ut: 'Andhra Pradesh' },
  { name: 'Arunachal Cricket Association', state_or_ut: 'Arunachal Pradesh' },
  { name: 'Assam Cricket Association', state_or_ut: 'Assam' },
  { name: 'Bihar Cricket Association', state_or_ut: 'Bihar' },
  { name: 'Chhattisgarh State Cricket Sangh', state_or_ut: 'Chhattisgarh' },
  { name: 'Delhi & District Cricket Association', state_or_ut: 'Delhi' },
  { name: 'Goa Cricket Association', state_or_ut: 'Goa' },
  { name: 'Gujarat Cricket Association', state_or_ut: 'Gujarat' },
  { name: 'Baroda Cricket Association', state_or_ut: 'Gujarat' },
  { name: 'Saurashtra Cricket Association', state_or_ut: 'Gujarat' },
  { name: 'Haryana Cricket Association', state_or_ut: 'Haryana' },
  { name: 'Himachal Pradesh Cricket Association', state_or_ut: 'Himachal Pradesh' },
  { name: 'Jammu & Kashmir Cricket Association', state_or_ut: 'Jammu & Kashmir' },
  { name: 'Jharkhand State Cricket Association', state_or_ut: 'Jharkhand' },
  { name: 'Karnataka State Cricket Association', state_or_ut: 'Karnataka' },
  { name: 'Kerala Cricket Association', state_or_ut: 'Kerala' },
  { name: 'Madhya Pradesh Cricket Association', state_or_ut: 'Madhya Pradesh' },
  { name: 'Maharashtra Cricket Association', state_or_ut: 'Maharashtra' },
  { name: 'Mumbai Cricket Association', state_or_ut: 'Maharashtra' },
  { name: 'Vidarbha Cricket Association', state_or_ut: 'Maharashtra' },
  { name: 'Manipur Cricket Association', state_or_ut: 'Manipur' },
  { name: 'Meghalaya Cricket Association', state_or_ut: 'Meghalaya' },
  { name: 'Cricket Association of Mizoram', state_or_ut: 'Mizoram' },
  { name: 'Nagaland Cricket Association', state_or_ut: 'Nagaland' },
  { name: 'Odisha Cricket Association', state_or_ut: 'Odisha' },
  { name: 'Punjab Cricket Association', state_or_ut: 'Punjab' },
  { name: 'Rajasthan Cricket Association', state_or_ut: 'Rajasthan' },
  { name: 'Sikkim Cricket Association', state_or_ut: 'Sikkim' },
  { name: 'Tamil Nadu Cricket Association', state_or_ut: 'Tamil Nadu' },
  { name: 'Hyderabad Cricket Association', state_or_ut: 'Telangana' },
  { name: 'Tripura Cricket Association', state_or_ut: 'Tripura' },
  { name: 'Uttar Pradesh Cricket Association', state_or_ut: 'Uttar Pradesh' },
  { name: 'Cricket Association of Uttarakhand', state_or_ut: 'Uttarakhand' },
  { name: 'Cricket Association of Bengal', state_or_ut: 'West Bengal' },
  { name: 'Union Territory Cricket Association', state_or_ut: 'Chandigarh' },
  { name: 'Cricket Association of Pondicherry', state_or_ut: 'Puducherry' },
  { name: 'Railways Sports Promotion Board', state_or_ut: 'National (Institutional)' },
  { name: 'Services Sports Control Board', state_or_ut: 'National (Institutional)' },
]

async function main() {
  for (const a of BCCI_ASSOCIATIONS) {
    await db.bcciAssociationReference.upsert({
      where: { name: a.name },
      update: {},
      create: a,
    })
  }
  console.log(`Seeded ${BCCI_ASSOCIATIONS.length} BCCI-affiliated association reference rows.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
