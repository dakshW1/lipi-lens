import { useRef, useState, type DragEvent } from 'react'

/** Hidden camera + upload inputs, and drag-and-drop handlers for any drop zone. */
export function useImagePicker(onPick: (file: File) => void) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handle = (files: FileList | null | undefined) => {
    const f = files?.[0]
    if (f && f.type.startsWith('image/')) onPick(f)
  }

  const inputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handle(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          handle(e.target.files)
          e.target.value = ''
        }}
      />
    </>
  )

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handle(e.dataTransfer.files)
    },
  }

  return {
    inputs,
    dropProps,
    dragging,
    openCamera: () => cameraRef.current?.click(),
    openUpload: () => uploadRef.current?.click(),
  }
}
