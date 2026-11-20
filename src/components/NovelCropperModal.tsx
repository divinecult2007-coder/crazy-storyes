import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, ZoomIn, ZoomOut, Move, Check, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface NovelCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCropped: (imageUrl: string) => void;
  initialImageUrl?: string;
}

export const NovelCropperModal: React.FC<NovelCropperModalProps> = ({
  isOpen,
  onClose,
  onCropped,
  initialImageUrl
}) => {
  const { token } = useAuth();
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageUrl || null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  // Reset or load image when modal opens
  useEffect(() => {
    if (isOpen && initialImageUrl) {
      loadImage(initialImageUrl);
    } else if (isOpen) {
      imageObjRef.current = null;
      setImageSrc(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setError(null);
    }
  }, [isOpen, initialImageUrl]);

  const loadImage = (src: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageObjRef.current = img;
      setImageSrc(src);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      drawCanvas();
    };
    img.onerror = () => {
      setError('इमेज लोड करने में असमर्थ। कृपया मान्य इमेज चुनें।');
    };
    img.src = src;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    if (!allowedTypes.has((file.type || '').toLowerCase())) {
      setError('कृपया केवल JPEG, PNG या WebP इमेज फ़ाइल चुनें');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('इमेज का आकार 10 MB से अधिक नहीं होना चाहिए');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageObjRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Calculate scaling to cover 16:9 canvas
    const imgRatio = img.width / img.height;
    const canvasRatio = cw / ch; // 16:9

    let baseWidth = cw;
    let baseHeight = ch;

    if (imgRatio > canvasRatio) {
      baseWidth = ch * imgRatio;
    } else {
      baseHeight = cw / imgRatio;
    }

    const finalWidth = baseWidth * zoom;
    const finalHeight = baseHeight * zoom;

    const drawX = (cw - finalWidth) / 2 + pan.x;
    const drawY = (ch - finalHeight) / 2 + pan.y;

    ctx.drawImage(img, drawX, drawY, finalWidth, finalHeight);
  };

  useEffect(() => {
    if (imageSrc) {
      drawCanvas();
    }
  }, [zoom, pan, imageSrc]);

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support for mobile admin
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleCropAndSave = async () => {
    const img = imageObjRef.current;
    if (!img) {
      setError('कृपया पहले एक इमेज अपलोड करें');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // Create target 1280 x 720 canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 1280;
      exportCanvas.height = 720;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not create 2D canvas context');

      const cw = 1280;
      const ch = 720;
      const imgRatio = img.width / img.height;
      const canvasRatio = cw / ch;

      let baseWidth = cw;
      let baseHeight = ch;
      if (imgRatio > canvasRatio) {
        baseWidth = ch * imgRatio;
      } else {
        baseHeight = cw / imgRatio;
      }

      const finalWidth = baseWidth * zoom;
      const finalHeight = baseHeight * zoom;

      // Scale pan offset to export canvas dimensions (preview canvas is 640x360)
      const scaleFactor = 1280 / 640;
      const drawX = (cw - finalWidth) / 2 + pan.x * scaleFactor;
      const drawY = (ch - finalHeight) / 2 + pan.y * scaleFactor;

      ctx.drawImage(img, drawX, drawY, finalWidth, finalHeight);

      // Convert to high-quality JPEG Blob
      exportCanvas.toBlob(async (blob) => {
        try {
          if (!blob) {
            throw new Error('इमेज एक्सपोर्ट में त्रुटि');
          }
          if (!token) {
            throw new Error('Admin सेशन उपलब्ध नहीं है — कृपया पुनः लॉगिन करें।');
          }

          const formData = new FormData();
          formData.append('image', blob, `novel_cover_16_9_${Date.now()}.jpg`);

          const res = await fetch('/api/admin/upload-image', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.success || data?.storage !== 'supabase' || !data?.url) {
            throw new Error(data?.error || 'Supabase Storage में कवर इमेज अपलोड विफल रहा');
          }

          onCropped(data.url);
          onClose();
        } catch (uploadErr: any) {
          console.error('Save cropped image error:', uploadErr);
          setError(uploadErr?.message || 'इमेज Supabase Storage में सहेजने में विफलता');
        } finally {
          setIsUploading(false);
        }
      }, 'image/jpeg', 0.92);
    } catch (err: any) {
      console.error('Save cropped image error:', err);
      setError(err?.message || 'इमेज सहेजने में विफलता');
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#120722] border border-purple-500/30 p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-900/50">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-600/30 text-purple-300 border border-purple-500/40">
                <ImageIcon className="w-5 h-5" />
              </span>
              <span>16:9 Novel Cover Cropper – यूट्यूब थंबनेल अनुपात</span>
            </h3>
            <p className="text-xs text-purple-300/80 mt-1">
              अनुशंसित आकार: 1280 × 720 पिक्सेल • ड्रैग करके एडजस्ट करें और ज़ूम करें
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-purple-400 hover:text-white hover:bg-purple-900/40 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload or Canvas Section */}
        <div className="mt-4 flex flex-col items-center">
          {!imageSrc ? (
            <label className="w-full aspect-video border-2 border-dashed border-purple-500/40 hover:border-purple-400 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-purple-950/20 hover:bg-purple-950/40 transition p-6 text-center group">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="p-4 rounded-full bg-purple-900/50 text-purple-300 group-hover:scale-110 transition duration-200 mb-3 border border-purple-500/40">
                <Upload className="w-8 h-8" />
              </div>
              <span className="text-base font-semibold text-white">कवर इमेज चुनें (Choose Image)</span>
              <span className="text-xs text-purple-300/70 mt-1">
                JPG, PNG, WebP • 16:9 अनुपात में स्वचालित रूप से फिट होगी
              </span>
            </label>
          ) : (
            <div className="w-full flex flex-col items-center">
              {/* Canvas Preview in 16:9 container */}
              <div className="relative w-full max-w-[640px] aspect-video rounded-xl overflow-hidden border-2 border-purple-500 shadow-xl bg-black">
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={360}
                  className="w-full h-full cursor-move touch-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
                <div className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-purple-500/40 text-[11px] font-mono text-purple-300 flex items-center gap-1.5 pointer-events-none">
                  <Move className="w-3 h-3 text-purple-400" /> 16:9 • 1280×720
                </div>
              </div>

              {/* Controls */}
              <div className="w-full max-w-[640px] mt-4 flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-purple-950/40 border border-purple-500/20">
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <ZoomOut className="w-4 h-4 text-purple-400" />
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <ZoomIn className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-mono text-purple-300 w-10 text-right">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/70 border border-purple-500/30 text-xs font-medium text-purple-200 cursor-pointer transition flex items-center gap-1.5">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Upload className="w-3.5 h-3.5" />
                    <span>दूसरी इमेज बदलें</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/20 text-xs font-medium text-purple-300 transition"
                  >
                    रीसेट
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-6 pt-4 border-t border-purple-900/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-purple-300 hover:text-white hover:bg-purple-900/30 transition"
          >
            रद्द करें (Cancel)
          </button>
          <button
            type="button"
            disabled={!imageSrc || isUploading}
            onClick={handleCropAndSave}
            className="btn-3d btn-3d-primary px-6 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <span>अपलोड हो रहा है...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>क्रॉप करें और सेव करें (Save 16:9 Cover)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
