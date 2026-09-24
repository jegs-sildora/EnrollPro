-- Bacolod is presented under Negros Occidental by the application's
-- cascading address selector. Repair records created by the former
-- submission override so they can be resolved correctly when prefilling.
UPDATE "application_addresses"
SET "province" = 'NEGROS OCCIDENTAL'
WHERE UPPER(TRIM("city_municipality")) = 'CITY OF BACOLOD'
  AND UPPER(TRIM("province")) = 'CITY OF BACOLOD';
