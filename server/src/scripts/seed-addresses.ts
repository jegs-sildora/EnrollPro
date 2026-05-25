/**
 * One-time seeder: fetches PSGC data from GitHub and populates the
 * regions, provinces, cities_municipalities, and barangays tables.
 *
 * Run with: pnpm --filter server exec tsx src/scripts/seed-addresses.ts
 */

import { prisma } from "../lib/prisma.js";

const URLS = {
  regions:
    "https://raw.githubusercontent.com/isaacdarcilla/philippine-addresses/master/region.json",
  provinces:
    "https://raw.githubusercontent.com/isaacdarcilla/philippine-addresses/master/province.json",
  cities:
    "https://raw.githubusercontent.com/isaacdarcilla/philippine-addresses/master/city.json",
  barangays:
    "https://raw.githubusercontent.com/isaacdarcilla/philippine-addresses/master/barangay.json",
};

async function fetchJson<T>(url: string): Promise<T> {
  console.log(`  Fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

async function main() {
  console.log("=== Philippine Address Seeder ===\n");

  const [rawRegions, rawProvinces, rawCities, rawBarangays] = await Promise.all(
    [
      fetchJson<Record<string, string>[]>(URLS.regions),
      fetchJson<Record<string, string>[]>(URLS.provinces),
      fetchJson<Record<string, string>[]>(URLS.cities),
      fetchJson<Record<string, string>[]>(URLS.barangays),
    ],
  );

  console.log(
    `\nDownloaded: ${rawRegions.length} regions, ${rawProvinces.length} provinces, ` +
      `${rawCities.length} cities, ${rawBarangays.length} barangays`,
  );
  console.log("\nSeeding inside a transaction...");

  await prisma.$transaction(
    async (tx) => {
      // 1. Regions
      const regions = rawRegions.map((r) => ({
        code: r.region_code,
        name: r.region_name,
      }));
      const regionResult = await tx.region.createMany({
        data: regions,
        skipDuplicates: true,
      });
      console.log(`  ✓ Regions: ${regionResult.count} inserted`);

      // 2. Provinces
      const provinces = rawProvinces.map((p) => ({
        code: p.province_code,
        name: p.province_name,
        regionCode: p.region_code,
      }));
      const provResult = await tx.province.createMany({
        data: provinces,
        skipDuplicates: true,
      });
      console.log(`  ✓ Provinces: ${provResult.count} inserted`);

      // 3. Cities / Municipalities
      const cities = rawCities.map((c) => ({
        code: c.city_code,
        name: c.city_name,
        provinceCode: c.province_code,
      }));
      const cityResult = await tx.cityMunicipality.createMany({
        data: cities,
        skipDuplicates: true,
      });
      console.log(`  ✓ Cities/Municipalities: ${cityResult.count} inserted`);

      // 4. Barangays — chunked to avoid exceeding Postgres parameter limit
      const CHUNK = 5000;
      let brgyTotal = 0;
      for (let i = 0; i < rawBarangays.length; i += CHUNK) {
        const chunk = rawBarangays.slice(i, i + CHUNK).map((b) => ({
          code: b.brgy_code,
          name: b.brgy_name,
          cityMunicipalityCode: b.city_code,
        }));
        const r = await tx.barangay.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        brgyTotal += r.count;
        process.stdout.write(
          `\r  ✓ Barangays: ${brgyTotal} / ${rawBarangays.length} inserted`,
        );
      }
      console.log(); // newline after progress line
    },
    { timeout: 120_000 },
  );

  console.log("\n=== Seeding complete ===");
}

main()
  .catch((err) => {
    console.error("\nSeeder failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
