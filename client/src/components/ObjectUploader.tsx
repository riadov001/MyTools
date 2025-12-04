import { useState, useCallback, useRef, useId } from "react";
import { Upload, X, FileImage, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface UploadedFile {
  key: string;
  type: string;
  name: string;
}

interface ObjectUploaderProps {
  onUploadComplete: (files: UploadedFile[]) => void;
  accept?: Record<string, string[]>;
  "data-testid"?: string;
}

export function ObjectUploader({
  onUploadComplete,
  accept = { 'image/*': [], 'video/*': [] },
  "data-testid": testId,
}: ObjectUploaderProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('media', file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.details || errorData.error || `Échec de l'upload (${response.status})`);
        }
        
        const result = await response.json();

        newFiles.push({
          key: result.objectPath,
          type: file.type,
          name: file.name,
        });
      }

      const allFiles = [...uploadedFiles, ...newFiles];
      setUploadedFiles(allFiles);
      onUploadComplete(allFiles);

      toast({
        title: "Succès",
        description: `${newFiles.length} fichier(s) téléchargé(s)`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur de téléchargement",
        description: error instanceof Error ? error.message : "Échec du téléchargement",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, [uploadedFiles, onUploadComplete, toast]);

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onUploadComplete(newFiles);
  };

  const acceptString = Object.keys(accept).join(',');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="file"
          id={inputId}
          accept={acceptString}
          multiple
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
          data-testid={testId}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full"
          data-testid="button-select-files"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Téléchargement..." : "Sélectionner des fichiers"}
        </Button>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {uploadedFiles.length} fichier(s) téléchargé(s)
          </p>
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-1">
                {file.type.startsWith('image/') ? (
                  <FileImage className="h-3 w-3" />
                ) : (
                  <FileVideo className="h-3 w-3" />
                )}
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="ml-1 rounded-full p-0.5 hover-elevate active-elevate-2"
                  data-testid={`button-remove-file-${index}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
