import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import fs from "fs";
import path from "path";

export async function upload(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const { documentType } = req.body;

    if (!Number.isInteger(applicantId) || applicantId <= 0) {
      return res.status(400).json({ message: "Invalid applicant id" });
    }

    if (!documentType) {
      return res.status(400).json({ message: "documentType is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });

    if (!applicant) {
      // Remove the uploaded file if applicant not found
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.warn(
          "[DocumentUpload] Failed to remove orphaned file:",
          unlinkError,
        );
      }
      return res.status(404).json({ message: "Applicant not found" });
    }

    // Backend restriction: No uploads for Early Registration stage (ELIGIBLE to PRE_REGISTERED)
    // except for SYSTEM_ADMIN
    const earlyRegStatuses = [
      "ELIGIBLE",
      "ASSESSMENT_SCHEDULED",
      "ASSESSMENT_TAKEN",
      "PRE_REGISTERED",
    ];
    if (
      earlyRegStatuses.includes(applicant.status) &&
      req.user?.role !== "SYSTEM_ADMIN"
    ) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
      return res.status(403).json({
        message:
          "Document upload is restricted during this stage of Early Registration.",
      });
    }

    const document = await prisma.document.create({
      data: {
        applicantId,
        documentType,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedById: req.user!.userId,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "DOCUMENT_UPLOADED",
      description: `Uploaded ${documentType} for ${applicant.firstName} ${applicant.lastName} (#${applicantId})`,
      subjectType: "Applicant",
      recordId: applicantId,
      req,
    });

    res.status(201).json(document);
  } catch (error: any) {
    console.error("[DocumentUpload]", error);
    res.status(500).json({ message: error.message });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const documentId = parseInt(String(req.params.docId));

    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ message: "Invalid document id" });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { applicant: true },
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Backend restriction: No deletion for Early Registration stage
    const earlyRegStatuses = [
      "ELIGIBLE",
      "ASSESSMENT_SCHEDULED",
      "ASSESSMENT_TAKEN",
      "PRE_REGISTERED",
    ];
    if (
      earlyRegStatuses.includes(document.applicant.status) &&
      req.user?.role !== "SYSTEM_ADMIN"
    ) {
      return res.status(403).json({
        message:
          "Document deletion is restricted during this stage of Early Registration.",
      });
    }

    // Delete file from filesystem
    if (document.fileName) {
      const filePath = path.resolve("uploads", document.fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.document.delete({
      where: { id: documentId },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "DOCUMENT_DELETED",
      description: `Deleted document ${document.documentType} for ${document.applicant.firstName} ${document.applicant.lastName} (#${document.applicantId})`,
      subjectType: "Applicant",
      recordId: document.applicantId,
      req,
    });

    res.json({ message: "Document deleted successfully" });
  } catch (error: any) {
    console.error("[DocumentDelete]", error);
    res.status(500).json({ message: error.message });
  }
}
