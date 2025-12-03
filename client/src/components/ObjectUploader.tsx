// Reference: javascript_object_storage blueprint
import { useState, useCallback, useRef, useId } from "react";
import { Upload, X, FileImage, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ObjectUploaderProps {
  onUploadComplete: (files: Array<{key: string; type: string; name: string}>) => void;
  accept?: Record<string, string[]>;
  "data-testid"?: string;
  mediaEndpoint?: string;
}

export function ObjectUploader({
  onUploadComplete,
  accept = { 'image/*': [], 'video/*': [] },
  "data-testid": testId,
  mediaEndpoint = "/api/quote-media",
}: ObjectUploaderProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{key: string; type: string; name: string}>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newFiles: Array<{key: string; type: string; name: string}> = [];

    try {
      for (const file of Array.from(files)) {
        // Get upload URL from backend
        const response = await fetch("/api/objects/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || "Échec de génération de l'URL");
        }
        
        const { uploadURL } = await response.json();

        // Upload file to object storage
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Échec de l'upload du fichier (${uploadResponse.status})`);
        }

        // Set ACL policy
        const aclResponse = await fetch(mediaEndpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaURL: uploadURL }),
          credentials: "include",
        });
        
        if (!aclResponse.ok) {
          const errorData = await aclResponse.json();
          throw new Error(errorData.error || "Échec de configuration des permissions");
        }
        
        const { objectPath } = await aclResponse.json();

        newFiles.push({
          key: objectPath,
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
      // Reset input
      e.target.value = '';
    }
  }, [uploadedFiles, onUploadComplete, toast, mediaEndpoint]);

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
                  className="ml-1 hover-elevate active-elevate-2 rounded-full p-0.5"
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
