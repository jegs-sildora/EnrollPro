// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Card } from '@/features/smart/components/ui/card';
import { Button } from '@/features/smart/components/ui/button';
import { Input } from '@/features/smart/components/ui/input';
import { Label } from '@/features/smart/components/ui/label';
import { Badge } from '@/features/smart/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/features/smart/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/features/smart/components/ui/dialog';
import { Upload, FileSpreadsheet, Download, Trash2, Power, Info, AlertCircle, CheckCircle2, Search, RefreshCw, BookOpen, Edit, X } from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

interface ECRTemplate {
  id: string;
  subjectName: string;
  subjectType: string | null;
  description: string | null;
  filePath: string;
  fileName: string;
  fileSize: number;
  placeholders: any;
  instructions: string | null;
  isActive: boolean;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
}

interface BulkUploadItem {
  file: File;
  detectedSubject: string;
  editedSubject: string;
  subjectType: string;
  description: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// Extract subject name from filename
const extractSubjectName = (filename: string): string => {
  // Remove extension
  let name = filename.replace(/\.(xlsx|xls)$/i, '');

  // Remove grade level prefixes like "GRADE 7-10_", "GRADE_7_", etc.
  name = name.replace(/^GRADE[\s_-]*\d+[\s_-]*(?:\d+)?[\s_-]*/i, '');

  // Replace underscores and hyphens with spaces
  name = name.replace(/[_-]/g, ' ');

  // Convert to title case
  name = name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return name.trim();
};

const getFriendlySubjectType = (subjectType: string | null): string => {
  if (!subjectType) return 'Not set yet';
  if (subjectType === 'MATH_SCIENCE') return 'Math & Science';
  if (subjectType === 'MAPEH') return 'MAPEH';
  if (subjectType === 'TLE') return 'TLE';
  if (subjectType === 'CORE') return 'Core Subjects';
  return subjectType;
};

const getFriendlyUploader = (uploadedByName: string): string => {
  if (!uploadedByName || /^\d+$/.test(uploadedByName)) return 'Admin';
  return uploadedByName;
};

export default function ECRTemplateManager() {
  const [templates, setTemplates] = useState<ECRTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ECRTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Upload mode: 'single' or 'bulk'
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');

  // Single upload form state
  const [uploadSubjectName, setUploadSubjectName] = useState('');
  const [uploadSubjectType, setUploadSubjectType] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadInstructions, setUploadInstructions] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [loadError, setLoadError] = useState('');

  // Bulk upload state
  const [bulkUploadItems, setBulkUploadItems] = useState<BulkUploadItem[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch =
        !searchQuery.trim() ||
        template.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.uploadedByName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && template.isActive) ||
        (statusFilter === 'INACTIVE' && !template.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [templates, searchQuery, statusFilter]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${SERVER_URL}/api/ecr-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch ECR templates:', error);
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.response?.data?.error;
      if (status === 401 || status === 403) {
        setLoadError('Session expired or invalid token. Please log out and log in again, then refresh this page.');
      } else {
        setLoadError(message || 'Failed to load ECR templates from server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadSubjectName.trim() || !uploadFile) {
      setUploadError('Please provide subject name and select a file');
      return;
    }

    // Check for existing template
    if (templates.some(t => t.subjectName.toLowerCase() === uploadSubjectName.trim().toLowerCase())) {
      const confirmed = window.confirm(
        `WARNING: An ECR template for "${uploadSubjectName}" already exists.\n\n` +
        `Please delete the existing template first if you want to replace it.`
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setUploading(true);
      setUploadError('');
      setUploadSuccess('');

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('subjectName', uploadSubjectName.trim());
      if (uploadSubjectType) formData.append('subjectType', uploadSubjectType);
      if (uploadDescription) formData.append('description', uploadDescription);
      if (uploadInstructions) formData.append('instructions', uploadInstructions);

      const token = sessionStorage.getItem('token');
      const response = await axios.post(`${SERVER_URL}/api/ecr-templates/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadSuccess(response.data.message || 'ECR template uploaded successfully');

      // Refresh template list
      await fetchTemplates();

      // Reset form
      setTimeout(() => {
        setUploadDialogOpen(false);
        setUploadSubjectName('');
        setUploadSubjectType('');
        setUploadDescription('');
        setUploadInstructions('');
        setUploadFile(null);
        setUploadSuccess('');
      }, 2000);

    } catch (error: any) {
      console.error('Upload failed:', error);
      const errorMessage = error.response?.data?.error || 'Failed to upload ECR template';
      setUploadError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Handle bulk file selection
  const handleBulkFilesSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const items: BulkUploadItem[] = Array.from(files).map(file => ({
      file,
      detectedSubject: extractSubjectName(file.name),
      editedSubject: extractSubjectName(file.name),
      subjectType: '',
      description: '',
      status: 'pending'
    }));

    setBulkUploadItems(items);
    setUploadError('');
    setUploadSuccess('');
  };

  // Update bulk upload item
  const updateBulkUploadItem = (index: number, field: 'editedSubject' | 'subjectType' | 'description', value: string) => {
    setBulkUploadItems(prev =>
      prev.map((item, i) => i === index ? { ...item, [field]: value } : item)
    );
  };

  // Remove bulk upload item
  const removeBulkUploadItem = (index: number) => {
    setBulkUploadItems(prev => prev.filter((_, i) => i !== index));
  };

  // Handle bulk upload
  const handleBulkUpload = async () => {
    if (bulkUploadItems.length === 0) {
      setUploadError('Please select files to upload');
      return;
    }

    // Validate all items have subject names
    const invalidItems = bulkUploadItems.filter(item => !item.editedSubject.trim());
    if (invalidItems.length > 0) {
      setUploadError('All templates must have a subject name');
      return;
    }

    try {
      setBulkUploading(true);
      setUploadError('');
      setUploadSuccess('');

      const token = sessionStorage.getItem('token');
      let successCount = 0;
      let errorCount = 0;

      // Upload each file sequentially
      for (let i = 0; i < bulkUploadItems.length; i++) {
        const item = bulkUploadItems[i];

        // Update status to uploading
        setBulkUploadItems(prev =>
          prev.map((it, idx) => idx === i ? { ...it, status: 'uploading' as const } : it)
        );

        try {
          const formData = new FormData();
          formData.append('file', item.file);
          formData.append('subjectName', item.editedSubject.trim());
          if (item.subjectType) formData.append('subjectType', item.subjectType);
          if (item.description) formData.append('description', item.description);

          await axios.post(`${SERVER_URL}/api/ecr-templates/upload`, formData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          });

          // Update status to success
          setBulkUploadItems(prev =>
            prev.map((it, idx) => idx === i ? { ...it, status: 'success' as const } : it)
          );
          successCount++;
        } catch (error: any) {
          // Update status to error
          const errorMessage = error.response?.data?.error || 'Upload failed';
          setBulkUploadItems(prev =>
            prev.map((it, idx) => idx === i ? { ...it, status: 'error' as const, error: errorMessage } : it)
          );
          errorCount++;
        }
      }

      // Show summary
      if (errorCount === 0) {
        setUploadSuccess(`Successfully uploaded ${successCount} template(s)`);
      } else {
        setUploadError(`Uploaded ${successCount} template(s), ${errorCount} failed`);
      }

      // Refresh template list
      await fetchTemplates();

      // Close dialog after delay if all successful
      if (errorCount === 0) {
        setTimeout(() => {
          setUploadDialogOpen(false);
          setBulkUploadItems([]);
          setUploadSuccess('');
        }, 2000);
      }

    } catch (error: any) {
      console.error('Bulk upload failed:', error);
      setUploadError('Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const handleToggleActive = async (template: ECRTemplate) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${SERVER_URL}/api/ecr-templates/${template.id}`,
        { isActive: !template.isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchTemplates();
    } catch (error: any) {
      console.error('Failed to toggle template status:', error);
      alert(error.response?.data?.error || 'Failed to update template status');
    }
  };

  const handleDelete = async (template: ECRTemplate) => {
    if (!confirm(`Are you sure you want to delete the ECR template for ${template.subjectName}?`)) {
      return;
    }

    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(`${SERVER_URL}/api/ecr-templates/${template.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchTemplates();
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      alert(error.response?.data?.error || 'Failed to delete template');
    }
  };

  const handleDownload = async (template: ECRTemplate) => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${SERVER_URL}/api/ecr-templates/${template.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const cleanFileName = `ECR_${template.subjectName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}.xlsx`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', cleanFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      console.error('Failed to download template:', error);
      alert('Failed to download template');
    }
  };

  const showInfo = (template: ECRTemplate) => {
    setSelectedTemplate(template);
    setInfoDialogOpen(true);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">ECR Template Manager</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage Electronic Class Record templates for teachers
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload ECR Template
        </Button>
      </div>

      {/* Benefits Card */}
      <Card className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-white shadow-sm">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-extrabold text-blue-900 mb-2">What are ECR Templates?</h3>
            <p className="text-sm text-blue-800 mb-3">
              Electronic Class Record (ECR) templates are Excel files that automatically fill in student names,
              grades, sections, and other class information for teachers. This saves time and ensures consistency
              across all subjects.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                <p className="text-xs font-semibold text-blue-900 mb-1">✓ Time Saver</p>
                <p className="text-xs text-blue-700">Teachers don't manually type student names</p>
              </div>
              <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                <p className="text-xs font-semibold text-blue-900 mb-1">✓ Standardized</p>
                <p className="text-xs text-blue-700">All teachers use the same format</p>
              </div>
              <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                <p className="text-xs font-semibold text-blue-900 mb-1">✓ Auto-Fill</p>
                <p className="text-xs text-blue-700">Student data pre-populated automatically</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters and Actions */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by subject, filename, or uploader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border rounded-md text-sm bg-white"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
          <Button variant="outline" onClick={fetchTemplates} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Templates Table */}
      <Card className="p-6">
        {loadError && (
          <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Could not load ECR templates</p>
              <p>{loadError}</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            ECR Templates ({filteredTemplates.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-sm text-slate-600">Loading ECR templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-20">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-sm text-slate-600 mb-2">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No templates match your filters'
                : 'No ECR templates uploaded yet'}
            </p>
            <Button variant="outline" size="sm" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload First Template
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Uploaded At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        <span className=" text-slate-900">{template.subjectName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {template.subjectType ? (
                        <Badge variant="outline" className="text-xs">
                          {getFriendlySubjectType(template.subjectType)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Not set yet</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{template.fileName}</TableCell>
                    <TableCell className="text-sm text-slate-600">{formatFileSize(template.fileSize)}</TableCell>
                    <TableCell className="text-sm text-slate-600">{getFriendlyUploader(template.uploadedByName)}</TableCell>
                    <TableCell className="text-sm text-slate-600">{formatDate(template.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={template.isActive ? 'default' : 'secondary'}>
                        {template.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => showInfo(template)}
                          title="View Details"
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(template)}
                          title="Download Template"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(template)}
                          title={template.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power className={`w-4 h-4 ${template.isActive ? 'text-green-600' : 'text-slate-400'}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template)}
                          title="Delete Template"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) {
          // Reset on close
          setUploadMode('single');
          setBulkUploadItems([]);
          setUploadSubjectName('');
          setUploadSubjectType('');
          setUploadDescription('');
          setUploadInstructions('');
          setUploadFile(null);
          setUploadError('');
          setUploadSuccess('');
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload ECR Template</DialogTitle>
            <DialogDescription>
              Upload Excel templates for subjects. Teachers will be able to download auto-filled versions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {uploadError && (
              <div className="p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{uploadError}</p>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 rounded-md border border-green-200 bg-green-50 text-green-700 text-sm flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{uploadSuccess}</p>
              </div>
            )}

            {/* Mode Selector */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => {
                  setUploadMode('single');
                  setBulkUploadItems([]);
                  setUploadError('');
                }}
                className={`flex-1 px-4 py-2 rounded-md text-sm  transition-colors ${uploadMode === 'single'
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
                disabled={uploading || bulkUploading}
              >
                Single Upload
              </button>
              <button
                onClick={() => {
                  setUploadMode('bulk');
                  setUploadFile(null);
                  setUploadSubjectName('');
                  setUploadError('');
                }}
                className={`flex-1 px-4 py-2 rounded-md text-sm  transition-colors ${uploadMode === 'bulk'
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
                disabled={uploading || bulkUploading}
              >
                Bulk Upload (Auto-detect)
              </button>
            </div>

            {uploadMode === 'single' ? (
              // Single Upload Form
              <>
                <div className="space-y-2">
                  <Label htmlFor="subjectName">Subject Name *</Label>
                  <Input
                    id="subjectName"
                    placeholder="e.g., Mathematics, English, Science"
                    value={uploadSubjectName}
                    onChange={(e) => setUploadSubjectName(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    The subject name must match exactly with subjects in the system
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subjectType">Subject Type / Category</Label>
                  <select
                    id="subjectType"
                    value={uploadSubjectType}
                    onChange={(e) => setUploadSubjectType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="">— None (use subject name match only) —</option>
                    <option value="CORE">CORE — English, Filipino, AP, EsP (30% WW / 50% PT / 20% QA)</option>
                    <option value="MATH_SCIENCE">Math &amp; Science (40% WW / 40% PT / 20% QA)</option>
                    <option value="MAPEH">MAPEH — Music, Arts, PE, Health (20% WW / 60% PT / 20% QA)</option>
                    <option value="TLE">TLE / Home Economics (20% WW / 60% PT / 20% QA)</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    Tag this template so it is automatically used for all subjects of this type when no exact name match is found.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of this template"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Instructions (Optional)</Label>
                  <textarea
                    id="instructions"
                    placeholder="How to use this template..."
                    value={uploadInstructions}
                    onChange={(e) => setUploadInstructions(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Excel Template File *</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-slate-500">
                    Supported formats: .xlsx, .xls (Max 15MB)
                  </p>
                </div>
              </>
            ) : (
              // Bulk Upload Form
              <>
                <div className="space-y-2">
                  <Label htmlFor="bulkFiles">Select Multiple Excel Files *</Label>
                  <Input
                    id="bulkFiles"
                    type="file"
                    accept=".xlsx,.xls"
                    multiple
                    onChange={handleBulkFilesSelect}
                  />
                  <p className="text-xs text-slate-500">
                    Select multiple .xlsx or .xls files. Subject names will be auto-detected from filenames.
                  </p>
                </div>

                {bulkUploadItems.length > 0 && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-900">
                        Templates to Upload ({bulkUploadItems.length})
                      </h4>
                      <p className="text-xs text-slate-500">
                        Review and edit detected subject names
                      </p>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {bulkUploadItems.map((item, index) => (
                        <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              {item.status === 'pending' && <FileSpreadsheet className="w-5 h-5 text-slate-400" />}
                              {item.status === 'uploading' && <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />}
                              {item.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                              {item.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">File</p>
                                <p className="text-sm  text-slate-900">{item.file.name}</p>
                              </div>
                              <div>
                                <Label className="text-xs">Subject Name *</Label>
                                <Input
                                  value={item.editedSubject}
                                  onChange={(e) => updateBulkUploadItem(index, 'editedSubject', e.target.value)}
                                  placeholder="Subject name"
                                  className="text-sm"
                                  disabled={item.status !== 'pending'}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Subject Type</Label>
                                <select
                                  value={item.subjectType}
                                  onChange={(e) => updateBulkUploadItem(index, 'subjectType', e.target.value)}
                                  className="w-full px-2 py-1.5 border rounded-md text-sm bg-white mt-1"
                                  disabled={item.status !== 'pending'}
                                >
                                  <option value="">— None —</option>
                                  <option value="CORE">CORE (English, Filipino, AP, EsP)</option>
                                  <option value="MATH_SCIENCE">Math &amp; Science</option>
                                  <option value="MAPEH">MAPEH</option>
                                  <option value="TLE">TLE / Home Economics</option>
                                </select>
                              </div>
                              <div>
                                <Label className="text-xs">Description (Optional)</Label>
                                <Input
                                  value={item.description}
                                  onChange={(e) => updateBulkUploadItem(index, 'description', e.target.value)}
                                  placeholder="Description"
                                  className="text-sm"
                                  disabled={item.status !== 'pending'}
                                />
                              </div>
                              {item.error && (
                                <p className="text-xs text-red-600">{item.error}</p>
                              )}
                            </div>
                            {item.status === 'pending' && (
                              <button
                                onClick={() => removeBulkUploadItem(index)}
                                className="flex-shrink-0 p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}

            {/* Placeholders Info */}
            <Card className="p-3 bg-blue-50 border-blue-200">
              <p className="text-xs font-semibold text-blue-900 mb-2">Available Placeholders:</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-blue-800">
                <div><code className="bg-white px-1 rounded">{'{{SCHOOL_NAME}}'}</code></div>
                <div><code className="bg-white px-1 rounded">{'{{TEACHER_NAME}}'}</code></div>
                <div><code className="bg-white px-1 rounded">{'{{SUBJECT}}'}</code></div>
                <div><code className="bg-white px-1 rounded">{'{{GRADE_LEVEL}}'}</code></div>
                <div><code className="bg-white px-1 rounded">{'{{SECTION}}'}</code></div>
                <div><code className="bg-white px-1 rounded">{'{{SCHOOL_YEAR}}'}</code></div>
                <div className="col-span-2"><code className="bg-white px-1 rounded">{'{{STUDENT_LIST}}'}</code> - Insert students here</div>
              </div>
            </Card>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploading || bulkUploading}
            >
              Cancel
            </Button>
            {uploadMode === 'single' ? (
              <Button
                onClick={handleUpload}
                disabled={uploading || !uploadSubjectName || !uploadFile}
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleBulkUpload}
                disabled={bulkUploading || bulkUploadItems.length === 0}
              >
                {bulkUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Uploading {bulkUploadItems.filter(i => i.status === 'success').length}/{bulkUploadItems.length}...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload All ({bulkUploadItems.length})
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Dialog */}
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ECR Template Details</DialogTitle>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-1">Subject</p>
                  <p className="font-semibold text-slate-900">{selectedTemplate.subjectName}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Subject Type</p>
                  {selectedTemplate.subjectType ? (
                    <Badge variant="outline">
                      {selectedTemplate.subjectType === 'MATH_SCIENCE' ? 'Math & Science' : selectedTemplate.subjectType}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-500">Not set (name-only match)</span>
                  )}
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Status</p>
                  <Badge variant={selectedTemplate.isActive ? 'default' : 'secondary'}>
                    {selectedTemplate.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">File Name</p>
                  <p className="text-slate-900">{selectedTemplate.fileName}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">File Size</p>
                  <p className="text-slate-900">{formatFileSize(selectedTemplate.fileSize)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Uploaded By</p>
                  <p className="text-slate-900">{selectedTemplate.uploadedByName}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Uploaded At</p>
                  <p className="text-slate-900">{formatDate(selectedTemplate.createdAt)}</p>
                </div>
              </div>

              {selectedTemplate.description && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Description</p>
                  <p className="text-sm text-slate-900">{selectedTemplate.description}</p>
                </div>
              )}

              {selectedTemplate.instructions && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Instructions</p>
                  <p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedTemplate.instructions}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setInfoDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
