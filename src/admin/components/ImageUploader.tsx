import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (max 5 Mo)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    onChange(data.publicUrl);
    toast.success("Image téléversée ✅");
    setUploading(false);
  };

  const onFiles = (files: FileList | null) => {
    if (!files || !files[0]) return;
    upload(files[0]);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition p-4 flex items-center justify-center min-h-[140px] ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" size={24} />
            <span className="text-xs">Téléversement…</span>
          </div>
        ) : value ? (
          <div className="relative w-full">
            <img src={value} alt="Aperçu" className="max-h-40 mx-auto rounded-lg object-contain" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute top-1 right-1 bg-foreground/80 text-background hover:bg-destructive hover:text-destructive-foreground rounded-full p-1.5"
              aria-label="Retirer l'image"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground text-center">
            <Upload size={24} />
            <div className="text-sm">
              <span className="text-primary font-medium">Cliquez</span> ou glissez une image
            </div>
            <div className="text-[11px]">PNG, JPG, WEBP — max 5 Mo</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Ou coller une URL externe</label>
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="https://…"
          className="mt-1 bg-background border-border text-sm"
        />
      </div>
    </div>
  );
}
