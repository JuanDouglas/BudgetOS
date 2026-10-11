import { useState, useRef } from 'react'
import { Upload, X, User, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { uploadsApi } from '../lib/api'
import Modal from './Modal'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export default function PayeeImageEditor({ 
  imageUrl, 
  payeeName, 
  onImageChange,
  size = 'lg'
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }

  // Upload a custom image
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validation
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
      setError(t('payeeImage.unsupportedFormat'))
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(t('payeeImage.tooLarge'))
      return
    }

    setIsUploading(true)
    setError('')

    try {
      const response = await uploadsApi.uploadPayeeImage(file)
      onImageChange(response.data.data.imageUrl)
      setIsOpen(false)
    } catch (err) {
      setError(err.response?.data?.error?.message || t('payeeImage.uploadError'))
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Remove the image
  const removeImage = () => {
    onImageChange(null)
    setIsOpen(false)
  }

  return (
    <div className="relative inline-block">
      {/* Current image */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative group cursor-pointer"
      >
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden border-2 border-gray-200 hover:border-primary-400 transition-colors`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={payeeName || 'Image'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
              <User className="w-1/2 h-1/2" />
            </div>
          )}
        </div>
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Upload className="w-1/3 h-1/3 text-white" />
        </div>
      </button>

      {/* Edit modal */}
      {isOpen && (
        <Modal onClose={() => setIsOpen(false)} className="z-[10000]">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{t('payeeImage.title')}</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Current image */}
              {imageUrl && (
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <img
                    src={imageUrl}
                    alt={t('payeeImage.current')}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">{t('payeeImage.current')}</p>
                  </div>
                  <button
                    onClick={removeImage}
                    className="btn btn-secondary text-sm px-3 py-1"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              )}

              {/* Custom upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Upload className="w-4 h-4 inline mr-1" />
                  {t('payeeImage.upload')}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="payee-image-upload"
                  />
                  <label
                    htmlFor="payee-image-upload"
                    className="cursor-pointer"
                  >
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 mx-auto text-primary-500 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">
                          {t('payeeImage.dropHint')}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {t('payeeImage.formatHint')}
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t">
              <button
                onClick={() => setIsOpen(false)}
                className="btn btn-secondary w-full"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
