"use client";
import { useRef, useState } from "react";
import { UploadCloud, LoaderCircle } from "lucide-react";

export function ImageUpload({
  label,
  multiple = false,
  disabled = false,
  progress,
  error,
  message,
  onFiles,
}: {
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  progress?: string;
  error?: string;
  message?: string;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`image-upload${dragging && !disabled ? " dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled && e.dataTransfer.files.length)
          onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        ref={input}
        type="file"
        hidden
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.currentTarget.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <button
        type="button"
        aria-label={label}
        className="image-upload-button"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {progress ? (
          <LoaderCircle
            size={30}
            className="upload-spinner"
            aria-hidden="true"
          />
        ) : (
          <UploadCloud size={32} aria-hidden="true" />
        )}
        <strong>{progress || label}</strong>
        <span>
          {progress
            ? "Espera aquí hasta que termine la carga."
            : `Arrastra ${multiple ? "tus fotos" : "una imagen"} aquí o pulsa para elegir ${multiple ? "varias a la vez" : "un archivo"}.`}
        </span>
        <small>JPG, PNG o WebP · máximo 8 MB por imagen</small>
      </button>
      {error && (
        <p className="upload-feedback error" role="alert">
          {error}
        </p>
      )}
      {message && !error && (
        <p className="upload-feedback" role="status">
          {message}
        </p>
      )}
      {progress && (
        <p className="upload-feedback" role="status" aria-live="polite">
          {progress}
        </p>
      )}
    </div>
  );
}
