import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';

declare const Hands: any;
declare const Camera: any;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
})
export class HomePage implements AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  private hands: any;
  private camera: any;

  ngAfterViewInit() {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d')!;

    this.hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    this.hands.onResults((results: any) => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          for (const p of landmarks) {
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#00ff88';
            ctx.fill();
          }
        }
      }
    });

    this.camera = new Camera(video, {
      onFrame: async () => {
        await this.hands.send({ image: video });
      },
      width: 1280,
      height: 720,
    });
    this.camera.start();
  }

  ngOnDestroy() {
    this.camera?.stop();
    this.hands?.close();
  }
}