import { useState } from "react";
import { FileText, Trash2, Upload, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import api from "@/api/axiosInstance";
import { toastApiError } from "@/hooks/useApiToast";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
}

interface Props {
  applicantId: number;
  documents: Document[];
  onRefresh: () => void;
  hideUpload?: boolean;
}

const DOCUMENT_TYPES = [
  { value: "PSA_BIRTH_CERTIFICATE", label: "PSA Birth Certificate" },
  { value: "SECONDARY_BIRTH_PROOF", label: "Secondary Birth Proof (Brgy Cert, etc.)" },
  { value: "SF9_REPORT_CARD", label: "SF9 / Report Card" },
  { value: "SF10_PERMANENT_RECORD", label: "SF10 / Permanent Record" },
  { value: "GOOD_MORAL_CERTIFICATE", label: "Good Moral Certificate" },
  { value: "MEDICAL_CERTIFICATE", label: "Medical Certificate" },
  { value: "MEDICAL_EVALUATION", label: "Medical Evaluation (for LWD)" },
  { value: "PEPT_AE_CERTIFICATE", label: "PEPT / A&E Certificate" },
  { value: "PWD_ID", label: "PWD ID" },
  { value: "PSA_MARRIAGE_CERTIFICATE", label: "PSA Marriage Certificate" },
  { value: "AFFIDAVIT_OF_UNDERTAKING", label: "Affidavit of Undertaking" },
  { value: "CONFIRMATION_SLIP", label: "Confirmation Slip" },
  { value: "OTHERS", label: "Other Supporting Documents" },
];

export function DocumentManagement({ applicantId, documents, onRefresh, hideUpload = false }: Props) {
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

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getDocLabel = (type: string) => {
    return DOCUMENT_TYPES.find((t) => t.value === type)?.label || type;
  };

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
            <p className='text-[10px] text-muted-foreground mt-2'>
              Accepted formats: PDF, JPEG, PNG.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-bold uppercase tracking-wider'>
            Submitted Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Name</TableHead>
                <TableHead>Modified By</TableHead>
                <TableHead>Last Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-center py-10 text-muted-foreground'>
                    No documents uploaded yet.
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className='font-bold text-xs'>
                      {getDocLabel(doc.documentType)}
                    </TableCell>
                    <TableCell className='max-w-[200px] truncate text-xs'>
                      <div className='flex items-center gap-2'>
                        <FileText className='h-3 w-3 text-blue-500' />
                        <span title={doc.originalName || ""}>{doc.originalName || "Unnamed"}</span>
                      </div>
                    </TableCell>
                    <TableCell className='text-xs'>
                      {formatSize(doc.size || 0)}
                    </TableCell>
                    <TableCell className='text-xs'>
                      {format(new Date(doc.uploadedAt), "MM/dd/yyyy")}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8 text-blue-600'
                          asChild>
                          <a
                            href={`${import.meta.env.VITE_API_BASE_URL || "/api"}/../../uploads/${doc.fileName}`}
                            target='_blank'
                            rel='noreferrer'>
                            <Download className='h-4 w-4' />
                          </a>
                        </Button>
                        {!hideUpload && (
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8 text-red-600'
                            onClick={() => handleDelete(doc.id)}>
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        )}
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
