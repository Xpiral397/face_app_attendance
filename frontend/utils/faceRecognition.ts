import { apiClient } from './api'

export interface FaceRecognitionResult {
  success: boolean;
  confidence?: number;
  error?: string;
  imageData?: string;
}

export class FaceRecognitionService {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;

  async startCamera(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      return true;
    } catch (error) {
      console.error('Error accessing camera:', error);
      return false;
    }
  }

  async stopCamera(): Promise<void> {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  setVideoElement(video: HTMLVideoElement): void {
    this.video = video;
    if (this.stream) {
      this.video.srcObject = this.stream;
    }
  }

  captureImage(): string | null {
    if (!this.video || !this.canvas) return null;

    const canvas = this.canvas;
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    context.drawImage(this.video, 0, 0);

    return canvas.toDataURL('image/jpeg', 0.8);
  }

  setCanvasElement(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  async verifyFace(capturedImageData: string): Promise<FaceRecognitionResult> {
    try {
      const response = await apiClient.post('/face/verify-attendance/', {
        captured_image: capturedImageData
      });

      return {
        success: response.verified,
        confidence: response.confidence,
        imageData: capturedImageData
      };
    } catch (error: any) {
      console.error('Face verification error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Face verification failed'
      };
    }
  }
} 