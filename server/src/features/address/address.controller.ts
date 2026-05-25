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
  const data = await prisma.province.findMany({
    where: { regionCode },
    orderBy: { name: "asc" },
  });
  res.json({ data });
}

export async function listCities(req: Request, res: Response): Promise<void> {
  const provinceCode = req.params.provinceCode as string;
  const data = await prisma.cityMunicipality.findMany({
    where: { provinceCode },
    orderBy: { name: "asc" },
  });
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
