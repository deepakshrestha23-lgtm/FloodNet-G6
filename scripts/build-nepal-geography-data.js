/*
 * Build the checked-in Nepal administrative reference data used by FloodNet.
 *
 * The application never fetches geography at runtime. This one-time generator
 * records the source URLs and produces a compact, deterministic seed artifact
 * from the 7-province, 77-district and 753-local-level dataset. The generated
 * ward total is checked against the current national total of 6,743 before the
 * file is written.
 */
const fs = require('fs');
const path = require('path');

const SOURCE_BASE = 'https://raw.githubusercontent.com/sagautam5/local-states-nepal/master/dataset';
const sources = {
  provinces: `${SOURCE_BASE}/provinces/en.json`,
  districts: `${SOURCE_BASE}/districts/en.json`,
  municipalities: `${SOURCE_BASE}/municipalities/en.json`
};

const categoryTypes = {
  1: 'METROPOLITAN_CITY',
  2: 'SUB_METROPOLITAN_CITY',
  3: 'MUNICIPALITY',
  4: 'RURAL_MUNICIPALITY'
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`);
  return response.json();
}

async function main() {
  const [provinces, districts, municipalities] = await Promise.all(
    Object.values(sources).map(fetchJson)
  );

  const wardTotal = municipalities.reduce((total, municipality) => total + Number(municipality.wards), 0);
  if (provinces.length !== 7 || districts.length !== 77 || municipalities.length !== 753 || wardTotal !== 6743) {
    throw new Error(`Unexpected Nepal geography totals: ${provinces.length}/${districts.length}/${municipalities.length}/${wardTotal}`);
  }

  const output = {
    source: {
      name: 'local-states-nepal',
      repository: 'https://github.com/sagautam5/local-states-nepal',
      sources,
      verifiedTotals: { provinces: 7, districts: 77, localLevels: 753, wards: 6743 }
    },
    provinces: provinces.map((province) => ({
      sourceId: province.id,
      code: `NP-P${String(province.id).padStart(2, '0')}`,
      name: province.name,
      sortOrder: province.id
    })),
    districts: districts.map((district) => ({
      sourceId: district.id,
      provinceSourceId: district.province_id,
      code: `NP-D${String(district.id).padStart(2, '0')}`,
      name: district.name,
      sortOrder: district.id
    })),
    localLevels: municipalities.map((municipality) => ({
      sourceId: municipality.id,
      districtSourceId: municipality.district_id,
      code: `NP-LL${String(municipality.id).padStart(3, '0')}`,
      name: municipality.name,
      type: categoryTypes[municipality.category_id],
      wardCount: Number(municipality.wards),
      sortOrder: municipality.id
    }))
  };

  const target = path.join(__dirname, '..', 'server', 'db', 'seeds', 'data', 'nepal-geography.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${target}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
