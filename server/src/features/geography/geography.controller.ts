import { Request, Response } from "express";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

export const getRegions = async (req: Request, res: Response) => {
  try {
    const regions = await prisma.region.findMany({
      orderBy: { name: "asc" },
    });
    res.json(regions);
  } catch (error) {
    console.error("Error fetching regions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getProvinces = async (req: Request, res: Response): Promise<void> => {
  try {
    const regionCode = req.query.regionCode as string;
    if (!regionCode) {
      res.status(400).json({ error: "regionCode is required" });
      return;
    }
    const provinces = await prisma.province.findMany({
      where: { regionCode },
      orderBy: { name: "asc" },
    });
    res.json(provinces);
  } catch (error) {
    console.error("Error fetching provinces:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCitiesMunicipalities = async (req: Request, res: Response): Promise<void> => {
  try {
    const provinceCode = req.query.provinceCode as string;
    if (!provinceCode) {
      res.status(400).json({ error: "provinceCode is required" });
      return;
    }
    const cities = await prisma.cityMunicipality.findMany({
      where: { provinceCode },
      orderBy: { name: "asc" },
    });
    res.json(cities);
  } catch (error) {
    console.error("Error fetching cities/municipalities:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getBarangays = async (req: Request, res: Response): Promise<void> => {
  try {
    const cityMunicipalityCode = req.query.cityMunicipalityCode as string;
    if (!cityMunicipalityCode) {
      res.status(400).json({ error: "cityMunicipalityCode is required" });
      return;
    }
    const barangays = await prisma.barangay.findMany({
      where: { cityMunicipalityCode },
      orderBy: { name: "asc" },
    });
    res.json(barangays);
  } catch (error) {
    console.error("Error fetching barangays:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
