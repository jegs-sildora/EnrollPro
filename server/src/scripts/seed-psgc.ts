import "dotenv/config";
import * as pg from "pg";
import axios from "axios";

const PSGC_URL =
  "https://raw.githubusercontent.com/bendlikeabamboo/barangay/main/barangay/data/barangay_flat.json";

interface PSGCNode {
  name: string;
  type: string;
  psgc_id: string;
  parent_psgc_id: string;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function seedPSGC() {
  console.log(`🌱 Fetching PSGC Master Dataset from: ${PSGC_URL}`);
  let data: PSGCNode[];

  try {
    const response = await axios.get<PSGCNode[]>(PSGC_URL);
    data = response.data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to fetch dataset. Error: ${message}`);
    process.exit(1);
  }

  const regionsMap = new Map<string, string>();
  const provincesMap = new Map<string, { name: string; regionCode: string }>();
  const citiesMap = new Map<string, { name: string; provinceCode: string }>();
  const barangaysMap = new Map<string, { name: string; cityMunicipalityCode: string }>();

  // Helper maps for resolution
  const typeMap = new Map<string, string>();
  const parentMap = new Map<string, string>();

  for (const row of data) {
    typeMap.set(row.psgc_id, row.type.toLowerCase());
    parentMap.set(row.psgc_id, row.parent_psgc_id);
  }

  // 1. Regions
  for (const row of data) {
    if (row.type.toLowerCase() === "region") {
      regionsMap.set(row.psgc_id, row.name);
    }
  }

  // 2. Provinces (and Pseudo-Provinces for NCR/HUCs)
  for (const row of data) {
    const type = row.type.toLowerCase();
    if (type === "province" || type === "special_geographic_area" || (type === "city" && row.name.includes("(Not a Province)"))) {
      let name = row.name;
      // Intercept the HUC grouping code
      if (row.psgc_id === "1830000000") {
        name = "INDEPENDENT / HIGHLY URBANIZED CITIES";
      }
      provincesMap.set(row.psgc_id, { name, regionCode: row.parent_psgc_id });
    }
  }

  // 3. Cities and Municipalities
  for (const row of data) {
    const type = row.type.toLowerCase();
    if ((type === "city" || type === "municipality" || type === "highly_urbanized_city" || type === "independent_component_city") && !row.name.includes("(Not a Province)")) {
      let provinceCode = row.parent_psgc_id;
      const parentType = typeMap.get(provinceCode);

      // If the parent is a region (e.g., NCR cities), create a pseudo-province
      if (parentType === "region") {
        const regionName = regionsMap.get(provinceCode) || "Unknown Region";
        const pseudoProvinceCode = provinceCode.slice(0, 9) + "P";
        if (!provincesMap.has(pseudoProvinceCode)) {
          provincesMap.set(pseudoProvinceCode, {
            name: "INDEPENDENT / HIGHLY URBANIZED CITIES",
            regionCode: provinceCode,
          });
        }
        provinceCode = pseudoProvinceCode;
      }
      
      // Handle the specific HUC placeholder 1830000000 if it exists in the data
      if (provinceCode === "1830000000") {
        if (!provincesMap.has("1830000000")) {
          provincesMap.set("1830000000", {
            name: "INDEPENDENT / HIGHLY URBANIZED CITIES",
            regionCode: "1800000000" // NIR
          });
        }
      }

      citiesMap.set(row.psgc_id, { name: row.name, provinceCode });
    }
  }

  // 4. Barangays
  for (const row of data) {
    const type = row.type.toLowerCase();
    if (type === "barangay") {
      let cityCode = row.parent_psgc_id;
      let parentType = typeMap.get(cityCode);

      // If parent is a sub-municipality, traverse up to find the city
      if (parentType === "submunicipality") {
        cityCode = parentMap.get(cityCode) || cityCode;
      }

      if (citiesMap.has(cityCode)) {
        barangaysMap.set(row.psgc_id, { name: row.name, cityMunicipalityCode: cityCode });
      } else {
        // Fallback for barangays whose parent is missing or direct to province/region
        // (Unlikely in PSGC but just in case)
      }
    }
  }

  console.log(`Found:
  - ${regionsMap.size} Regions
  - ${provincesMap.size} Provinces (including pseudo-provinces)
  - ${citiesMap.size} Cities/Municipalities
  - ${barangaysMap.size} Barangays`);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    console.log("🧹 Clearing existing PSGC data...");
    await client.query("DELETE FROM regions;");

    console.log("📥 Inserting Regions...");
    for (const [code, name] of regionsMap.entries()) {
      await client.query(
        "INSERT INTO regions (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING",
        [code, name]
      );
    }

    console.log("📥 Inserting Provinces...");
    for (const [code, { name, regionCode }] of provincesMap.entries()) {
      await client.query(
        "INSERT INTO provinces (code, name, region_code) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING",
        [code, name, regionCode]
      );
    }

    console.log("📥 Inserting Cities and Municipalities...");
    for (const [code, { name, provinceCode }] of citiesMap.entries()) {
      await client.query(
        "INSERT INTO cities_municipalities (code, name, province_code) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING",
        [code, name, provinceCode]
      );
    }

    console.log("📥 Inserting Barangays in chunks...");
    const barangayEntries = Array.from(barangaysMap.entries());
    const CHUNK_SIZE = 2000;

    for (let i = 0; i < barangayEntries.length; i += CHUNK_SIZE) {
      const chunk = barangayEntries.slice(i, i + CHUNK_SIZE);
      const values: string[] = [];
      const flatParams: string[] = [];
      let paramIndex = 1;

      for (const [code, { name, cityMunicipalityCode }] of chunk) {
        values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        flatParams.push(code, name, cityMunicipalityCode);
      }

      if (values.length > 0) {
        const query = `
          INSERT INTO barangays (code, name, city_municipality_code) 
          VALUES ${values.join(", ")} 
          ON CONFLICT (code) DO NOTHING
        `;
        await client.query(query, flatParams);
        process.stdout.write(`\rInserted ${Math.min(i + chunk.length, barangayEntries.length)} / ${barangayEntries.length} Barangays`);
      }
    }
    console.log();

    await client.query("COMMIT");
    console.log("✅ PSGC Seeding completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error during seeding, transaction rolled back.");
    throw err;
  } finally {
    client.release();
  }
}

seedPSGC()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
