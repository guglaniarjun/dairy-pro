import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, Upload, Trash2, FileText, Image, Music, Video, Loader2, AlertCircle, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  storageUrl: string;
  createdAt: string;
}

interface AttachmentUploaderProps {
  entityType: string;
  entityId: string;
  maxFiles?: number;
  onUploadComplete?: (attachment: Attachment) => void;
  onDeleteComplete?: (attachmentId: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case "image":
      return <Image className="w-5 h-5" />;
    case "audio":
      return <Music className="w-5 h-5" />;
    case "video":
      return <Video className="w-5 h-5" />;
    case "document":
      return <FileText className="w-5 h-5" />;
    default:
      return <Paperclip className="w-5 h-5" />;
  }
}

export function AttachmentUploader({
  entityType,
  entityId,
  maxFiles = 10,
  onUploadComplete,
  onDeleteComplete,
}: AttachmentUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: storageStatus } = useQuery<{ configured: boolean; provider: string }>({
    queryKey: ["/api/storage/status"],
  });

  const { data: attachments, isLoading } = useQuery<Attachment[]>({
    queryKey: ["/api/attachments", entityType, entityId],
    enabled: !!entityId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/attachments/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attachments", entityType, entityId] });
      toast({ title: "Attachment deleted" });
      onDeleteComplete?.(id);
    },
    onError: () => {
      toast({ title: "Failed to delete attachment", variant: "destructive" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    if (file.size > MAX_FILE_SIZE) {
      toast({ 
        title: "File too large", 
        description: "Maximum file size is 10 MB",
        variant: "destructive" 
      });
      return;
    }

    if (attachments && attachments.length >= maxFiles) {
      toast({
        title: "Maximum files reached",
        description: `You can only attach up to ${maxFiles} files`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);

      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const attachment = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/attachments", entityType, entityId] });
      toast({ title: "File uploaded successfully" });
      onUploadComplete?.(attachment);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  if (!storageStatus?.configured) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertCircle className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            File attachments not available. Storage not configured.
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-file-upload"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          data-testid="button-upload-attachment"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Attach File
            </>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">Max 10 MB</span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading attachments...
        </div>
      )}

      {attachments && attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-2 rounded-md bg-muted/30 group"
              data-testid={`attachment-${attachment.id}`}
            >
              {getFileIcon(attachment.fileType)}
              <div className="flex-1 min-w-0">
                <a
                  href={attachment.storageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium truncate block hover:underline"
                  data-testid={`link-attachment-${attachment.id}`}
                >
                  {attachment.fileName}
                </a>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.fileSize)}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setDeleteId(attachment.id)}
                data-testid={`button-delete-attachment-${attachment.id}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this attachment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function AttachmentList({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const { data: attachments, isLoading } = useQuery<Attachment[]>({
    queryKey: ["/api/attachments", entityType, entityId],
    enabled: !!entityId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center gap-3 p-2 rounded-md bg-muted/30"
        >
          {getFileIcon(attachment.fileType)}
          <a
            href={attachment.storageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium truncate hover:underline"
          >
            {attachment.fileName}
          </a>
          <span className="text-xs text-muted-foreground ml-auto">
            {formatFileSize(attachment.fileSize)}
          </span>
        </div>
      ))}
    </div>
  );
}
