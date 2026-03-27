import { useState } from "react";
import { Trash2, Upload, Download, Loader2, Eye, FileCheck, XCircle } from "lucide-react";
import { format } from "date-fns";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";
import { useAuthStore } from "@/store/auth.slice";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import type { AuditLog, ChecklistData } from "@/features/enrollment/hooks/useApplicationDetail";

interface Document {
  id: number;
  documentType: string;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED" | "MISSING";
  fileName: string | null;
  originalName: string | null;
  mimeType: string | null;
  size: number | null;
  verificationNote: string | null;
  isPresentedOnly: boolean;
  uploadedAt: string;
  verifiedAt: string | null;
  uploadedBy?: { id: number; firstName: string; lastName: string; role: string } | null;
}

interface Props {
  applicantId: number;
  documents: Document[];
  checklist?: ChecklistData | null;
  encodedBy?: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
  auditLogs?: AuditLog[];
  onRefresh: () => void;
  hideUpload?: boolean;
}

interface AuditRow {
  type: string;
  label: string;
  status: "Added" | "Removed" | "Pending";
  document: Document | undefined;
  lastModified: string | null;
  modifiedBy: { id: number; firstName: string; lastName: string; role: string } | null;
  action: "Added" | "Removed" | "Pending";
}

const DOCUMENT_TYPES = [
  { value: "PSA_BIRTH_CERTIFICATE", label: "PSA Birth Certificate", checklistKey: "isPsaBirthCertPresented" },
  { value: "SECONDARY_BIRTH_PROOF", label: "Secondary Birth Proof (Brgy Cert, etc.)" },
  { value: "SF9_REPORT_CARD", label: "SF9 / Report Card", checklistKey: "isSf9Submitted" },
  { value: "SF10_PERMANENT_RECORD", label: "SF10 (Permanent Record)", checklistKey: "isSf10Requested" },
  { value: "GOOD_MORAL_CERTIFICATE", label: "Good Moral Certificate", checklistKey: "isGoodMoralPresented" },
  { value: "MEDICAL_CERTIFICATE", label: "Medical Certificate" },
  { value: "MEDICAL_EVALUATION", label: "Medical Evaluation", checklistKey: "isMedicalEvalSubmitted" },
  { value: "PWD_ID", label: "PWD ID" },
  { value: "AFFIDAVIT_OF_UNDERTAKING", label: "Affidavit of Undertaking", checklistKey: "isUndertakingSigned" },
  { value: "CONFIRMATION_SLIP", label: "Confirmation Slip", checklistKey: "isConfirmationSlipReceived" },
];

export function DocumentManagement({
  applicantId,
  documents,
  checklist,
  encodedBy,
  auditLogs,
  onRefresh,
  hideUpload = false,
}: Props) {
  const { user: sessionUser } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedType || !selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("document", selectedFile);
    formData.append("documentType", selectedType);

    try {
      await api.post(`/applications/${applicantId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      sileo.success({
        title: "Success",
        description: "Document uploaded successfully.",
      });
      setSelectedType("");
      setSelectedFile(null);
      // Reset input
      const input = document.getElementById("file-upload") as HTMLInputElement;
      if (input) input.value = "";
      onRefresh();
    } catch (error: unknown) {
      toastApiError(error as never);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await api.delete(`/applications/documents/${docId}`);
      sileo.success({
        title: "Deleted",
        description: "Document has been removed.",
      });
      onRefresh();
    } catch (error: unknown) {
      toastApiError(error as never);
    }
  };

  // Merge checklist items and documents into audit rows
  // Showing only requirements that have been acted upon (uploaded, checked, or logged)
  const auditRows = DOCUMENT_TYPES.map((type) => {
    const doc = documents.find((d) => d.documentType === type.value);
    const isChecked = type.checklistKey ? !!(checklist as ChecklistData)?.[type.checklistKey as keyof ChecklistData] : false;
    
    // FIND RELEVANT AUDIT LOG
    // We prioritize the most recent log that matches this document type or checklist label
    const relevantLog = auditLogs?.find((log) => {
      const desc = log.description.toUpperCase();
      const typeVal = type.value.toUpperCase();
      const labelVal = type.label.toUpperCase();
      
      if (desc.includes(typeVal)) return true;
      if (desc.includes(labelVal)) return true;
      if (type.value === "SF10_PERMANENT_RECORD" && desc.includes("SF10 (PERMANENT RECORD)")) return true;
      
      return false;
    });

    // Determine if we should even show this row
    // It must have a physical document, be currently checked, or have a historical audit log
    if (!doc && !isChecked && !relevantLog) return null;

    // Status for internal UI logic (Added/Removed/Pending)
    let status: "Added" | "Removed" | "Pending" = "Pending";
    if (doc || isChecked) {
      status = "Added";
    } else if (relevantLog) {
      status = "Removed";
    }

    return {
      type: type.value,
      label: type.label,
      status,
      document: doc,
      lastModified: relevantLog?.createdAt || doc?.uploadedAt || (status === "Added" || status === "Removed" ? checklist?.updatedAt : null),
      modifiedBy: relevantLog?.user || doc?.uploadedBy || (status === "Added" || status === "Removed" ? checklist?.updatedBy : encodedBy) || sessionUser,
      action: relevantLog 
        ? (["DOCUMENT_REMOVED", "DOCUMENT_DELETED"].includes(relevantLog.actionType) ? "Removed" : "Added")
        : status,
    };
  })
    .filter((row): row is AuditRow => row !== null)
    .sort((a, b) => {
      const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return dateB - dateA;
    });

  return (
    <div className='space-y-6'>
      {!hideUpload && (
        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-bold uppercase tracking-wider'>
              Upload New Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 items-end'>
              <div className='space-y-2'>
                <Label htmlFor='doc-type'>Document Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger id='doc-type'>
                    <SelectValue placeholder='Select type...' />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='file-upload'>File (Max 5MB)</Label>
                <Input
                  id='file-upload'
                  type='file'
                  accept='.pdf,.jpg,.jpeg,.png'
                  onChange={handleFileChange}
                />
              </div>
              <Button
                onClick={handleUpload}
                disabled={isUploading || !selectedType || !selectedFile}
                className='flex items-center gap-2'>
                {isUploading ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Upload className='h-4 w-4' />
                )}
                {isUploading ? "Uploading..." : "Upload Document"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-bold uppercase tracking-wider'>
            Submitted Documents ({auditRows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[30%]'>Document Name</TableHead>
                <TableHead className='w-[30%]'>Modified By</TableHead>
                <TableHead className='w-[30%]'>Last Modified</TableHead>
                <TableHead className='w-[10%]'>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-center py-10 text-muted-foreground'>
                    No activity recorded.
                  </TableCell>
                </TableRow>
              ) : (
                auditRows.map((row) => (
                  <TableRow key={row.type}>
                    <TableCell className='flex justify-center items-center font-bold text-xs h-24'>
                      <div className='flex items-center gap-2 text-[12px]'>
                        {row.status === "Added" ? (
                          row.document ? (
                            <Eye className='h-4 w-4 text-blue-500' />
                          ) : (
                            <FileCheck className='h-4 w-4 text-green-500' />
                          )
                        ) : (
                          <XCircle className='h-4 w-4 text-muted-foreground' />
                        )}
                        <div className='flex flex-col'>
                          <span
                            className={
                              row.status === "Removed"
                                ? "text-muted-foreground line-through decoration-1"
                                : ""
                            }>
                            {row.label}
                          </span>
                          {row.document?.originalName && (
                            <span className='text-sm text-muted-foreground font-normal truncate max-w-[200px]'>
                              {row.document.originalName}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='text-xs text-center'>
                      <div className='flex flex-col gap-1'>
                        <span className='font-bold'>
                          {row.modifiedBy
                            ? `${row.modifiedBy.firstName} ${row.modifiedBy.lastName}`
                            : "N/A"}
                        </span>
                        <div className='flex items-center justify-center'>
                          <Badge
                            variant='outline'
                            className='text-[8px] h-4 px-1 uppercase tracking-tighter'>
                            {row.modifiedBy?.role || "USER"}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='text-xs'>
                      {row.lastModified
                        ? format(
                            new Date(row.lastModified),
                            "MMM dd, yyyy - hh:mm a",
                          )
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {row.action === "Added" && (
                        <Badge
                          variant='success'
                          className='text-[9px] font-bold uppercase'>
                          Added
                        </Badge>
                      )}
                      {row.action === "Removed" && (
                        <Badge
                          variant='destructive'
                          className='text-[9px] font-bold uppercase'>
                          Removed
                        </Badge>
                      )}
                      {row.action === "Pending" && (
                        <Badge
                          variant='outline'
                          className='text-[9px] font-bold uppercase'>
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        {row.document ? (
                          <div className='flex gap-1'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7 text-blue-600'
                              asChild>
                              <a
                                href={`${import.meta.env.VITE_API_BASE_URL || "/api"}/../../uploads/${row.document.fileName}`}
                                target='_blank'
                                rel='noreferrer'>
                                <Download className='h-4 w-4' />
                              </a>
                            </Button>
                            {!hideUpload && (
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-7 w-7 text-red-600'
                                onClick={() => handleDelete(row.document!.id)}>
                                <Trash2 className='h-4 w-4' />
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
