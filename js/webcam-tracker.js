/**
 * Client-side Webcam Eye Tracking Module
 * Captures frames from user's webcam and sends to cloud server for processing
 */

class WebcamTracker {
    constructor(options = {}) {
        this.serverUrl = options.serverUrl || 'http://localhost:5000';
        this.sessionId = options.sessionId || this.generateSessionId();
        this.userId = options.userId;
        this.moduleId = options.moduleId;
        this.sectionId = options.sectionId;
        
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        
        this.isTracking = false;
        this.frameInterval = null;
        this.frameRate = options.frameRate || 10; // frames per second
        
        this.onFocusChange = options.onFocusChange || (() => {});
        this.onMetricsUpdate = options.onMetricsUpdate || (() => {});
        this.onFrameProcessed = options.onFrameProcessed || (() => {});
        this.onError = options.onError || console.error;
        this.onCountdownUpdate = options.onCountdownUpdate || (() => {});
        
        this.lastFocusState = null;
        this.metrics = null;
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async init() {
        try {
            // Create video element
            this.video = document.createElement('video');
            this.video.setAttribute('autoplay', '');
            this.video.setAttribute('playsinline', '');
            this.video.setAttribute('muted', '');
            this.video.style.display = 'none';
            document.body.appendChild(this.video);
            
            // Create canvas for frame capture
            this.canvas = document.createElement('canvas');
            this.canvas.width = 640;
            this.canvas.height = 480;
            this.ctx = this.canvas.getContext('2d');
            
            // Request webcam access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
            
            this.video.srcObject = this.stream;
            await this.video.play();
            
            console.log('Webcam initialized successfully');
            return true;
        } catch (error) {
            this.onError('Failed to access webcam: ' + error.message);
            return false;
        }
    }
    
    async startTracking() {
        if (!this.stream) {
            const initialized = await this.init();
            if (!initialized) return false;
        }
        
        if (!this.userId || !this.moduleId) {
            this.onError('User ID and Module ID are required');
            return false;
        }
        
        try {
            // Start session on server
            const response = await fetch(`${this.serverUrl}/api/start_tracking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    user_id: this.userId,
                    module_id: this.moduleId,
                    section_id: this.sectionId
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                this.onError('Failed to start tracking: ' + data.error);
                return false;
            }
            
            this.isTracking = true;
            
            // Start sending frames
            const intervalMs = 1000 / this.frameRate;
            this.frameInterval = setInterval(() => this.captureAndSendFrame(), intervalMs);
            
            console.log('Tracking started with session:', this.sessionId);
            return true;
        } catch (error) {
            this.onError('Error starting tracking: ' + error.message);
            return false;
        }
    }
    
    async captureAndSendFrame() {
        if (!this.isTracking || !this.video || !this.ctx) return;
        
        try {
            // Capture frame from video
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Convert to base64 JPEG
            const frameData = this.canvas.toDataURL('image/jpeg', 0.7);
            
            // Send to server
            const response = await fetch(`${this.serverUrl}/api/process_frame`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    frame: frameData
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Handle focus change
                if (result.is_focused !== this.lastFocusState) {
                    this.lastFocusState = result.is_focused;
                    this.onFocusChange(result.is_focused);
                }
                
                // Update metrics
                if (result.metrics) {
                    this.metrics = result.metrics;
                    this.onMetricsUpdate(result.metrics);
                }
                
                // Countdown update
                if (result.countdown_active) {
                    this.onCountdownUpdate(result.countdown_remaining);
                }
                
                // Pass annotated frame if available
                this.onFrameProcessed({
                    annotatedFrame: result.annotated_frame,
                    isFocused: result.is_focused,
                    trackingState: result.tracking_state,
                    metrics: result.metrics
                });
            }
        } catch (error) {
            // Silently handle network errors to avoid spamming console
            console.debug('Frame processing error:', error.message);
        }
    }
    
    async stopTracking() {
        this.isTracking = false;
        
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }
        
        try {
            const response = await fetch(`${this.serverUrl}/api/stop_tracking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: this.sessionId })
            });
            
            const data = await response.json();
            console.log('Tracking stopped. Final metrics:', data.final_metrics);
            return data.final_metrics;
        } catch (error) {
            this.onError('Error stopping tracking: ' + error.message);
            return this.metrics;
        }
    }
    
    destroy() {
        this.stopTracking();
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.video && this.video.parentNode) {
            this.video.parentNode.removeChild(this.video);
        }
        
        this.video = null;
        this.canvas = null;
        this.ctx = null;
    }
    
    getVideoElement() {
        return this.video;
    }
    
    getMetrics() {
        return this.metrics;
    }
    
    isActive() {
        return this.isTracking;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebcamTracker;
}
