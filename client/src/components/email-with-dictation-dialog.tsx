import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Mic, 
  MicOff, 
  Send, 
  Loader2, 
  Sparkles, 
  Edit3,
  Square,
  RefreshCw,
  Info,
  CheckCircle2
} from "lucide-react";

interface EmailWithDictationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: "quote" | "invoice";
  documentId: string;
  documentNumber: string;
  clientEmail: string;
  clientName: string;
  prestations: string[];
  technicalDetails?: string;
  onSuccess?: () => void;
}

export function EmailWithDictationDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  documentNumber,
  clientEmail,
  clientName,
  prestations,
  technicalDetails = "",
  onSuccess,
}: EmailWithDictationDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  
  const [recipient, setRecipient] = useState(clientEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sendCopy, setSendCopy] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setRecipient(clientEmail);
      setSubject(
        documentType === "quote"
          ? `Votre devis MyJantes - ${documentNumber}`
          : `Votre facture MyJantes - ${documentNumber}`
      );
      setMessage("");
      setTranscription("");
      setAudioBlob(null);
      setRecordingTime(0);
      setHasGeneratedContent(false);
      setMode("manual");
    }
  }, [open, clientEmail, documentNumber, documentType]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'accéder au microphone. Vérifiez les permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setTranscription("");
    setRecordingTime(0);
    setMessage("");
    setHasGeneratedContent(false);
  };

  const generateEmailFromAudio = async () => {
    if (!audioBlob) return;

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("clientName", clientName);
      formData.append("prestations", JSON.stringify(prestations));
      formData.append("technicalDetails", technicalDetails);
      formData.append("attachments", JSON.stringify([
        documentType === "quote" ? "Devis PDF" : "Facture PDF",
        "Photos"
      ]));
      formData.append("documentType", documentType);
      formData.append("documentNumber", documentNumber);

      const response = await fetch("/api/voice-dictation/generate-email", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la génération");
      }

      const data = await response.json();
      setTranscription(data.transcription);
      setMessage(data.email);
      setHasGeneratedContent(true);
      
      toast({
        title: "Email généré",
        description: "Vérifiez et modifiez le contenu avant envoi.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer l'email",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const endpoint = documentType === "quote"
        ? `/api/admin/quotes/${documentId}/send-email`
        : `/api/admin/invoices/${documentId}/send-email`;
      
      return await apiRequest("POST", endpoint, {
        customRecipient: recipient !== clientEmail ? recipient : undefined,
        customSubject: subject,
        customMessage: message || undefined,
        sendCopy,
      });
    },
    onSuccess: () => {
      toast({
        title: "Email envoyé",
        description: "L'email a été envoyé avec succès au client.",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de l'envoi de l'email",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!recipient) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un destinataire.",
        variant: "destructive",
      });
      return;
    }
    sendEmailMutation.mutate();
  };

  const showDefaultTemplateInfo = mode === "manual" && !message.trim();
  const showAIReadyTosend = mode === "ai" && hasGeneratedContent && message.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base sm:text-lg">
            Envoyer {documentType === "quote" ? "le devis" : "la facture"} par email
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            PDF et photos joints automatiquement.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "manual" | "ai")} className="flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="manual" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Edit3 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Manuel</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Dictée</span>
              <span className="xs:hidden">IA</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-3 sm:mt-4" style={{ maxHeight: "calc(95vh - 220px)" }}>
            <TabsContent value="manual" className="space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="recipient">Destinataire</Label>
                <Input
                  id="recipient"
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="email@exemple.com"
                  data-testid="input-email-recipient"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Objet</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Objet de l'email"
                  data-testid="input-email-subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm">Message personnalisé (optionnel)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Laissez vide pour le modèle par défaut..."
                  rows={4}
                  className="text-sm"
                  data-testid="textarea-email-message"
                />
              </div>

              {showDefaultTemplateInfo && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Sans message personnalisé, un email standard avec le logo MY JANTES, 
                    le détail des prestations et les pièces jointes sera envoyé.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendCopy"
                  checked={sendCopy}
                  onCheckedChange={(checked) => setSendCopy(!!checked)}
                />
                <Label htmlFor="sendCopy" className="text-sm">
                  M'envoyer une copie
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 px-1">
              {prestations.length > 0 && !hasGeneratedContent && (
                <div className="p-3 border rounded-lg bg-muted/20">
                  <Label className="text-xs font-medium">Prestations du document (référence)</Label>
                  <ul className="mt-1 text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                    {prestations.slice(0, 5).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                    {prestations.length > 5 && (
                      <li className="text-muted-foreground/60">
                        +{prestations.length - 5} autres...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {!hasGeneratedContent ? (
                <div className="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6 border rounded-lg bg-muted/30">
                  {!audioBlob ? (
                    <>
                      <div className="text-2xl sm:text-3xl font-mono">{formatTime(recordingTime)}</div>
                      <Button
                        size="lg"
                        variant={isRecording ? "destructive" : "default"}
                        onClick={isRecording ? stopRecording : startRecording}
                        className="h-14 w-14 sm:h-16 sm:w-16 rounded-full"
                        data-testid="button-record"
                      >
                        {isRecording ? (
                          <Square className="h-5 w-5 sm:h-6 sm:w-6" />
                        ) : (
                          <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
                        )}
                      </Button>
                      <p className="text-xs sm:text-sm text-muted-foreground text-center px-2">
                        {isRecording
                          ? "Appuyez pour arrêter"
                          : "Dictez le récapitulatif des travaux"}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <MicOff className="h-4 w-4" />
                        Terminé ({formatTime(recordingTime)})
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetRecording}
                          className="w-full sm:w-auto"
                          data-testid="button-reset-recording"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Recommencer
                        </Button>
                        <Button
                          size="sm"
                          onClick={generateEmailFromAudio}
                          disabled={isGenerating}
                          className="w-full sm:w-auto"
                          data-testid="button-generate-email"
                        >
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          Générer
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      Email généré par l'IA. Vérifiez le contenu avant envoi.
                    </AlertDescription>
                  </Alert>

                  {transcription && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Votre dictée (transcription)</Label>
                      <div className="p-3 bg-muted/50 rounded-lg text-sm italic border border-dashed">
                        "{transcription}"
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="ai-recipient">Destinataire</Label>
                    <Input
                      id="ai-recipient"
                      type="email"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      data-testid="input-ai-email-recipient"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-subject">Objet</Label>
                    <Input
                      id="ai-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      data-testid="input-ai-email-subject"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ai-message">Contenu de l'email (modifiable)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetRecording}
                        className="text-xs h-6"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Recommencer
                      </Button>
                    </div>
                    <Textarea
                      id="ai-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={6}
                      className="font-mono text-xs sm:text-sm"
                      data-testid="textarea-ai-email-message"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ai-sendCopy"
                      checked={sendCopy}
                      onCheckedChange={(checked) => setSendCopy(!!checked)}
                    />
                    <Label htmlFor="ai-sendCopy" className="text-sm">
                      M'envoyer une copie
                    </Label>
                  </div>
                </div>
              )}

              {mode === "ai" && !hasGeneratedContent && !audioBlob && !isRecording && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Enregistrez votre dictée, puis cliquez sur "Générer l'email" pour créer 
                    un message professionnel basé sur vos instructions.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="mt-3 sm:mt-4 flex-col-reverse sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendEmailMutation.isPending || !recipient || (mode === "ai" && !hasGeneratedContent)}
            className="w-full sm:w-auto"
            data-testid="button-send-email"
          >
            {sendEmailMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {mode === "ai" && !hasGeneratedContent ? "Générer d'abord" : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
