import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

export async function listRegions(_req: Request, res: Response): Promise<void> {
  const data = await prisma.region.findMany({ orderBy: { name: "asc" } });
  res.json({ data });
}

export async function listProvinces(
  req: Request,
  res: Response,
): Promise<void> {
  const regionCode = req.params.regionCode as string;
  let data = await prisma.province.findMany({
    where: { regionCode },
    orderBy: { name: "asc" },
  });

  if (regionCode === "1800000000") {
    // Hide the generic INDEPENDENT / HIGHLY URBANIZED CITIES
    data = data.filter((p) => p.code !== "180000000P");
  }

  res.json({ data });
}

export async function listCities(req: Request, res: Response): Promise<void> {
  const provinceCode = req.params.provinceCode as string;

  if (provinceCode === "1830200000") {
    // If the pseudo-province Bacolod City is selected, return it as the only city
    res.json({
      data: [
        {
          code: "1830200000",
          name: "City of Bacolod",
          provinceCode: "1830200000",
        },
      ],
    });
    return;
  }

  const data = await prisma.cityMunicipality.findMany({
    where: { provinceCode },
    orderBy: { name: "asc" },
  });

  if (provinceCode === "1804500000") {
    // Inject Bacolod City into Negros Occidental's list of cities
    data.push({
      code: "1830200000",
      name: "City of Bacolod",
      provinceCode: "1804500000", // Logically grouped here
    });
    data.sort((a, b) => a.name.localeCompare(b.name));
  }

  res.json({ data });
}

export async function listBarangays(
  req: Request,
  res: Response,
): Promise<void> {
  const cityCode = req.params.cityCode as string;
  const data = await prisma.barangay.findMany({
    where: { cityMunicipalityCode: cityCode },
    orderBy: { name: "asc" },
  });
  res.json({ data });
}
