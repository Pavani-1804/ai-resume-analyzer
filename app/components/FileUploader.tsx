import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

interface FileUploaderProps {
  onFileSelect?: (file: File | null) => void
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}

const FileUploader = ({
                        onFileSelect,
                      }: FileUploaderProps) => {
  const [file, setFile] = useState<File | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const selectedFile = acceptedFiles[0] || null

      setFile(selectedFile)

      onFileSelect?.(selectedFile)
    },
    [onFileSelect]
  )

  const {
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: 20 * 1024 * 1024,
  })

  return (
    <div className="w-full gradient-border">
      <div
        {...getRootProps()}
        className="p-10 rounded-2xl border-2 border-dashed border-gray-300 bg-white cursor-pointer text-center"
      >
        <input {...getInputProps()} />

        <div className="space-y-4 cursor-pointer">
          {file ? (
            <div className="uploader-selected-file" onClick={((e)=>e.stopPropagation())}>
            <div className="flex items-center space-x-3">
              <img src="/images/pdf.png" alt="pdf" className="size-10" />
              <div>
                <p className=" text-sm text-gray-700 font-medium truncate max-w-xs">
                  {file.name}
                </p>

                <p className="text-gray-500">{formatSize(file.size)}</p>
              </div>
            </div>
              <button className="p-2 cursor-pointer" onClick={(e)=>{
                onFileSelect?.(null)
              }}>
                <img src="/icons/cross.svg" alt="remove" className="w-4 h-4"/>
              </button>
            </div>
          ) : (
            <div>
              <div className="mx-auto w-16 h-16 flex items-center justify-center mb-2">
                <img src="/icons/info.svg" alt="upload" className="size-20" />
              </div>
              <p className="text-lg text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag
                and drop
              </p>

              <p className="text-lg text-gray-500">PDF (max 20 MB)</p>
            </div>
          )}

          {isDragActive && (
            <p className="text-blue-500 font-medium">Drop the file here...</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileUploader