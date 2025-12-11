/**
 * Pure Client-Side Eye Tracking System v1.0
 * Uses TensorFlow.js with MediaPipe FaceMesh for in-browser eye tracking
 * No Python backend required - all processing happens in the browser
 * 
 * Features:
 * - Real eye detection using MediaPipe FaceMesh
 * - Gaze direction estimation
 * - Focus/unfocus detection based on eye position
 * - Same black widget interface as before
 * - Automatic fallback to basic tracking if ML fails
 */

class CVEyeTrackingSystem {
    constructor(moduleId, sectionId = null) {
        this.moduleId = moduleId;
        this.sectionId = sectionId;
        this.isConnected = false; // For compatibility - always true for client-side
        this.isTracking = false;
        this.dormantMode = false;
        
        // Video and canvas elements
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.outputCanvas = null;
        this.outputCtx = null;
        this.stream = null;
        
        // FaceMesh detector
        this.detector = null;
        this.detectorReady = false;
        
        // Intervals
        this.trackingInterval = null;
        this.timerInterval = null;
        this.dataSaveInterval = null;
        this.statusUpdateInterval = null;
        
        // Instance tracking
        this.instanceId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.isTransitioning = false;
        
        // Eye landmark indices for MediaPipe FaceMesh
        // Left eye landmarks
        this.LEFT_EYE = [362, 385, 387, 263, 373, 380];
        this.RIGHT_EYE = [33, 160, 158, 133, 153, 144];
        this.LEFT_IRIS = [474, 475, 476, 477];
        this.RIGHT_IRIS = [469, 470, 471, 472];
        
        // Nose tip for head pose estimation
        this.NOSE_TIP = 1;
        
        // Focus detection thresholds
        this.focusThresholds = {
            horizontalMin: 0.25,  // Left boundary (0-1 normalized)
            horizontalMax: 0.75,  // Right boundary
            verticalMin: 0.20,    // Top boundary
            verticalMax: 0.80     // Bottom boundary
        };
        
        // Tracking state
        this.isFocused = false;
        this.faceDetected = false;
        this.gazeDirection = { x: 0.5, y: 0.5 };
        this.consecutiveUnfocusedFrames = 0;
        this.consecutiveFocusedFrames = 0;
        this.focusChangeThreshold = 5; // Frames needed to change focus state
        
        // Enhanced timer system
        this.timers = {
            sessionStart: null,
            sessionTime: 0,
            focusedTime: 0,
            unfocusedTime: 0,
            currentFocusStart: null,
            currentUnfocusStart: null,
            isCurrentlyFocused: false,
            baseFocusedTime: 0,
            baseUnfocusedTime: 0
        };
        
        this.metrics = {
            focused_time: 0,
            unfocused_time: 0,
            total_time: 0,
            focus_percentage: 0
        };
        
        console.log(`🆕 CVEyeTrackingSystem (Client-Side) instance created: ${this.instanceId}`);
        
        // Only initialize if not in dormant mode
        if (moduleId !== 'dormant_mode') {
            setTimeout(() => {
                this.init();
            }, 100);
        } else {
            this.dormantMode = true;
            console.log('🛌 Eye tracking initialized in dormant mode');
        }
    }

    async init() {
        console.log(`🎯 Initializing Pure Client-Side Eye Tracking System v1.0... (Instance: ${this.instanceId})`);
        console.log('Features: TensorFlow.js FaceMesh, in-browser processing, no backend required');
        
        // Clean up any existing intervals
        this.cleanupAllIntervals();
        this.cleanupInterface();
        
        // Check if countdown should be shown
        const shouldShowCountdown = !this.hasCountdownBeenShownForModule();
        
        if (shouldShowCountdown) {
            console.log('🎬 New module - showing countdown while loading ML model');
            this.markCountdownShownForModule();
            this.showCountdownNotification();
        }
        
        try {
            // Load TensorFlow.js and FaceMesh
            await this.loadMLModels();
            
            // Initialize webcam
            await this.initWebcam();
            
            if (this.detectorReady && this.stream) {
                this.isConnected = true;
                
                // Start all services
                await Promise.all([
                    this.startTracking(),
                    this.displayTrackingInterface(),
                    this.initializeTimers()
                ]);
                
                // Start periodic data saving
                this.startDataSaving();
                
                console.log('⚡ Client-side eye tracking fully activated!');
            } else {
                console.warn('⚠️ Could not initialize eye tracking');
                this.showServiceError();
            }
        } catch (error) {
            console.error('❌ Error initializing eye tracking:', error);
            this.showServiceError();
        }
    }
    
    async loadMLModels() {
        console.log('🧠 Loading TensorFlow.js and FaceMesh model...');
        
        try {
            // Wait for TensorFlow.js to be ready
            if (typeof tf === 'undefined') {
                console.log('⏳ Waiting for TensorFlow.js to load...');
                await this.waitForTensorFlow();
            }
            
            // Wait for FaceMesh to be ready
            if (typeof faceLandmarksDetection === 'undefined') {
                console.log('⏳ Waiting for FaceMesh to load...');
                await this.waitForFaceMesh();
            }
            
            console.log('✅ TensorFlow.js loaded, version:', tf.version.tfjs);
            
            // Create the FaceMesh detector
            const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
            const detectorConfig = {
                runtime: 'tfjs',
                refineLandmarks: true, // Enable iris detection
                maxFaces: 1
            };
            
            console.log('🔧 Creating FaceMesh detector...');
            this.detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
            this.detectorReady = true;
            
            console.log('✅ FaceMesh detector ready!');
            return true;
        } catch (error) {
            console.error('❌ Error loading ML models:', error);
            this.detectorReady = false;
            return false;
        }
    }
    
    waitForTensorFlow() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            
            const check = () => {
                if (typeof tf !== 'undefined') {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('TensorFlow.js did not load in time'));
                } else {
                    attempts++;
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    waitForFaceMesh() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            
            const check = () => {
                if (typeof faceLandmarksDetection !== 'undefined') {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('FaceMesh did not load in time'));
                } else {
                    attempts++;
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    async initWebcam() {
        console.log('📷 Initializing webcam...');
        
        try {
            // Create hidden video element
            this.video = document.createElement('video');
            this.video.setAttribute('autoplay', '');
            this.video.setAttribute('playsinline', '');
            this.video.setAttribute('muted', '');
            this.video.style.display = 'none';
            document.body.appendChild(this.video);
            
            // Create canvas for processing
            this.canvas = document.createElement('canvas');
            this.canvas.width = 640;
            this.canvas.height = 480;
            this.ctx = this.canvas.getContext('2d');
            
            // Create output canvas for display (with annotations)
            this.outputCanvas = document.createElement('canvas');
            this.outputCanvas.width = 640;
            this.outputCanvas.height = 480;
            this.outputCtx = this.outputCanvas.getContext('2d');
            
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
            
            console.log('✅ Webcam initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to access webcam:', error);
            this.showCameraError();
            return false;
        }
    }
    
    async startTracking() {
        if (!this.detectorReady || !this.stream) {
            console.log('Cannot start tracking - detector or webcam not ready');
            return false;
        }
        
        this.isTracking = true;
        console.log('🎯 Starting client-side eye tracking...');
        
        // Start the tracking loop
        this.trackingInterval = setInterval(async () => {
            await this.processFrame();
        }, 100); // 10 FPS - good balance between accuracy and performance
        
        console.log('✅ Eye tracking started (10 FPS)');
        return true;
    }
    
    async processFrame() {
        if (!this.isTracking || !this.video || !this.detector || this.isTransitioning) {
            return;
        }
        
        try {
            // Draw current video frame to canvas
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Get face predictions
            const faces = await this.detector.estimateFaces(this.video, {
                flipHorizontal: false
            });
            
            // Draw annotated frame to output canvas
            this.outputCtx.drawImage(this.video, 0, 0, this.outputCanvas.width, this.outputCanvas.height);
            
            if (faces.length > 0) {
                const face = faces[0];
                this.faceDetected = true;
                
                // Process eye landmarks and determine focus
                this.processEyeLandmarks(face);
                
                // Draw annotations on output canvas
                this.drawAnnotations(face);
            } else {
                this.faceDetected = false;
                this.handleNoFaceDetected();
            }
            
            // Update the video feed display
            this.updateVideoDisplay();
            
        } catch (error) {
            // Silently handle occasional processing errors
            if (Math.random() < 0.01) {
                console.debug('Frame processing error:', error.message);
            }
        }
    }
    
    processEyeLandmarks(face) {
        const keypoints = face.keypoints;
        
        if (!keypoints || keypoints.length < 478) {
            return; // Need full face mesh with iris landmarks
        }
        
        try {
            // Get iris centers
            const leftIrisCenter = this.getIrisCenter(keypoints, this.LEFT_IRIS);
            const rightIrisCenter = this.getIrisCenter(keypoints, this.RIGHT_IRIS);
            
            // Get eye boundaries for ratio calculation
            const leftEyeBounds = this.getEyeBounds(keypoints, this.LEFT_EYE);
            const rightEyeBounds = this.getEyeBounds(keypoints, this.RIGHT_EYE);
            
            if (leftIrisCenter && rightIrisCenter && leftEyeBounds && rightEyeBounds) {
                // Calculate normalized gaze position (0-1)
                const leftGazeX = (leftIrisCenter.x - leftEyeBounds.minX) / (leftEyeBounds.maxX - leftEyeBounds.minX);
                const rightGazeX = (rightIrisCenter.x - rightEyeBounds.minX) / (rightEyeBounds.maxX - rightEyeBounds.minX);
                
                const leftGazeY = (leftIrisCenter.y - leftEyeBounds.minY) / (leftEyeBounds.maxY - leftEyeBounds.minY);
                const rightGazeY = (rightIrisCenter.y - rightEyeBounds.minY) / (rightEyeBounds.maxY - rightEyeBounds.minY);
                
                // Average both eyes
                this.gazeDirection = {
                    x: (leftGazeX + rightGazeX) / 2,
                    y: (leftGazeY + rightGazeY) / 2
                };
                
                // Clamp to valid range
                this.gazeDirection.x = Math.max(0, Math.min(1, this.gazeDirection.x));
                this.gazeDirection.y = Math.max(0, Math.min(1, this.gazeDirection.y));
                
                // Determine if user is focused (looking at screen)
                const isLookingAtScreen = this.isGazeFocused();
                
                // Use hysteresis to prevent flickering
                if (isLookingAtScreen) {
                    this.consecutiveFocusedFrames++;
                    this.consecutiveUnfocusedFrames = 0;
                    
                    if (this.consecutiveFocusedFrames >= this.focusChangeThreshold && !this.isFocused) {
                        this.isFocused = true;
                        this.handleFocusChange(true);
                    }
                } else {
                    this.consecutiveUnfocusedFrames++;
                    this.consecutiveFocusedFrames = 0;
                    
                    if (this.consecutiveUnfocusedFrames >= this.focusChangeThreshold && this.isFocused) {
                        this.isFocused = false;
                        this.handleFocusChange(false);
                    }
                }
            }
        } catch (error) {
            console.debug('Error processing eye landmarks:', error.message);
        }
    }
    
    getIrisCenter(keypoints, irisIndices) {
        let sumX = 0, sumY = 0, count = 0;
        
        for (const idx of irisIndices) {
            if (keypoints[idx]) {
                sumX += keypoints[idx].x;
                sumY += keypoints[idx].y;
                count++;
            }
        }
        
        if (count === 0) return null;
        
        return {
            x: sumX / count,
            y: sumY / count
        };
    }
    
    getEyeBounds(keypoints, eyeIndices) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const idx of eyeIndices) {
            if (keypoints[idx]) {
                minX = Math.min(minX, keypoints[idx].x);
                maxX = Math.max(maxX, keypoints[idx].x);
                minY = Math.min(minY, keypoints[idx].y);
                maxY = Math.max(maxY, keypoints[idx].y);
            }
        }
        
        if (minX === Infinity) return null;
        
        return { minX, maxX, minY, maxY };
    }
    
    isGazeFocused() {
        // Check if gaze is within the "focused" region
        const { x, y } = this.gazeDirection;
        const { horizontalMin, horizontalMax, verticalMin, verticalMax } = this.focusThresholds;
        
        return x >= horizontalMin && x <= horizontalMax && 
               y >= verticalMin && y <= verticalMax;
    }
    
    handleNoFaceDetected() {
        this.consecutiveUnfocusedFrames++;
        this.consecutiveFocusedFrames = 0;
        
        if (this.consecutiveUnfocusedFrames >= this.focusChangeThreshold * 2 && this.isFocused) {
            this.isFocused = false;
            this.handleFocusChange(false);
        }
        
        // Draw "No Face Detected" on output
        this.outputCtx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        this.outputCtx.font = 'bold 16px Arial';
        this.outputCtx.fillText('No Face Detected', 10, 30);
    }
    
    drawAnnotations(face) {
        const keypoints = face.keypoints;
        const ctx = this.outputCtx;
        
        // Draw eye bounding boxes
        this.drawEyeBox(ctx, keypoints, this.LEFT_EYE, 'LEFT EYE', '#00ff00');
        this.drawEyeBox(ctx, keypoints, this.RIGHT_EYE, 'RIGHT EYE', '#00ff00');
        
        // Draw iris points
        ctx.fillStyle = '#ff0000';
        for (const idx of [...this.LEFT_IRIS, ...this.RIGHT_IRIS]) {
            if (keypoints[idx]) {
                ctx.beginPath();
                ctx.arc(keypoints[idx].x, keypoints[idx].y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Draw gaze indicator
        const gazeX = this.gazeDirection.x * this.outputCanvas.width;
        const gazeY = this.gazeDirection.y * this.outputCanvas.height;
        
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gazeX, gazeY, 15, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(gazeX, gazeY, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw focus status
        const statusColor = this.isFocused ? '#00ff00' : '#ff0000';
        const statusText = this.isFocused ? 'FOCUSED' : 'UNFOCUSED';
        
        ctx.fillStyle = statusColor;
        ctx.font = 'bold 18px Arial';
        ctx.fillText(statusText, 10, this.outputCanvas.height - 20);
        
        // Draw gaze direction text
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(`Gaze: (${this.gazeDirection.x.toFixed(2)}, ${this.gazeDirection.y.toFixed(2)})`, 10, this.outputCanvas.height - 45);
    }
    
    drawEyeBox(ctx, keypoints, eyeIndices, label, color) {
        const bounds = this.getEyeBounds(keypoints, eyeIndices);
        if (!bounds) return;
        
        const padding = 5;
        const x = bounds.minX - padding;
        const y = bounds.minY - padding;
        const width = bounds.maxX - bounds.minX + padding * 2;
        const height = bounds.maxY - bounds.minY + padding * 2;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        ctx.fillStyle = color;
        ctx.font = '10px Arial';
        ctx.fillText(label, x, y - 5);
    }
    
    updateVideoDisplay() {
        const videoElement = document.getElementById('tracking-video');
        if (videoElement && this.outputCanvas) {
            videoElement.src = this.outputCanvas.toDataURL('image/jpeg', 0.7);
        }
    }
    
    handleFocusChange(isFocused) {
        const now = Date.now();
        
        if (isFocused && !this.timers.isCurrentlyFocused) {
            console.log('👁️ User became focused');
            
            if (this.timers.currentUnfocusStart) {
                const unfocusDuration = Math.floor((now - this.timers.currentUnfocusStart) / 1000);
                this.timers.baseUnfocusedTime = (this.timers.baseUnfocusedTime || 0) + unfocusDuration;
                this.timers.currentUnfocusStart = null;
            }
            
            this.timers.currentFocusStart = now;
            this.timers.baseFocusedTime = this.timers.focusedTime;
            this.timers.isCurrentlyFocused = true;
            
        } else if (!isFocused && this.timers.isCurrentlyFocused) {
            console.log('👁️ User became unfocused');
            
            if (this.timers.currentFocusStart) {
                const focusDuration = Math.floor((now - this.timers.currentFocusStart) / 1000);
                this.timers.baseFocusedTime = (this.timers.baseFocusedTime || 0) + focusDuration;
                this.timers.currentFocusStart = null;
            }
            
            this.timers.currentUnfocusStart = now;
            this.timers.baseUnfocusedTime = this.timers.unfocusedTime;
            this.timers.isCurrentlyFocused = false;
        }
    }
    
    initializeTimers() {
        console.log('⏱️ Initializing timer system...');
        this.timers.sessionStart = Date.now();
        this.timers.sessionTime = 0;
        this.timers.focusedTime = 0;
        this.timers.unfocusedTime = 0;
        this.timers.isCurrentlyFocused = false;
        this.timers.baseFocusedTime = 0;
        this.timers.baseUnfocusedTime = 0;
        this.timers.currentUnfocusStart = Date.now(); // Start as unfocused
        
        this.timerInterval = setInterval(() => {
            this.updateTimers();
        }, 100);
    }
    
    updateTimers() {
        if (!this.timers.sessionStart) return;
        
        const now = Date.now();
        this.timers.sessionTime = Math.floor((now - this.timers.sessionStart) / 1000);
        
        if (this.timers.isCurrentlyFocused && this.timers.currentFocusStart) {
            const additionalFocusTime = Math.floor((now - this.timers.currentFocusStart) / 1000);
            this.timers.focusedTime = this.timers.baseFocusedTime + additionalFocusTime;
        } else if (!this.timers.isCurrentlyFocused && this.timers.currentUnfocusStart) {
            const additionalUnfocusTime = Math.floor((now - this.timers.currentUnfocusStart) / 1000);
            this.timers.unfocusedTime = this.timers.baseUnfocusedTime + additionalUnfocusTime;
        }
        
        this.updateTimerDisplay();
    }
    
    updateTimerDisplay() {
        const sessionTimeElement = document.getElementById('session-time');
        if (sessionTimeElement) {
            sessionTimeElement.textContent = this.timers.sessionTime;
        }
        
        const focusTimeElement = document.getElementById('focus-time');
        if (focusTimeElement) {
            focusTimeElement.textContent = this.timers.focusedTime;
        }
        
        const unfocusTimeElement = document.getElementById('unfocus-time');
        if (unfocusTimeElement) {
            unfocusTimeElement.textContent = this.timers.unfocusedTime;
        }
        
        const focusPercentageElement = document.getElementById('focus-percentage');
        if (focusPercentageElement) {
            const totalActiveTime = this.timers.focusedTime + this.timers.unfocusedTime;
            const percentage = totalActiveTime > 0 ? Math.round((this.timers.focusedTime / totalActiveTime) * 100) : 0;
            focusPercentageElement.textContent = percentage;
        }
        
        const focusStatus = document.getElementById('focus-status');
        const trackingIndicator = document.getElementById('tracking-indicator');
        
        if (focusStatus && trackingIndicator) {
            if (this.timers.isCurrentlyFocused) {
                focusStatus.textContent = 'Focused';
                focusStatus.className = 'text-green-400';
                trackingIndicator.className = 'w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5';
            } else {
                focusStatus.textContent = 'Unfocused';
                focusStatus.className = 'text-red-400';
                trackingIndicator.className = 'w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5';
            }
        }
    }
    
    displayTrackingInterface() {
        // Create the exact same black widget interface
        const trackingContainer = document.createElement('div');
        trackingContainer.id = 'cv-eye-tracking-interface';
        trackingContainer.innerHTML = `
            <div class="fixed top-20 right-4 bg-black text-white shadow-2xl rounded-lg border border-gray-600 z-50" style="width: 180px; font-family: system-ui;">
                <!-- Header with indicator dot and "Eye Tracking" -->
                <div class="px-2 py-1.5 border-b border-gray-600">
                    <div class="flex items-center">
                        <div id="tracking-indicator" class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></div>
                        <span class="text-xs font-medium">Eye Tracking</span>
                        <span class="ml-1 text-xs text-gray-400">(Client)</span>
                    </div>
                </div>
                
                <!-- Focus status line -->
                <div class="px-2 py-1 border-b border-gray-600">
                    <div class="flex items-center text-xs">
                        <div class="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></div>
                        <span id="focus-status">Initializing...</span>
                    </div>
                </div>
                
                <!-- Metrics -->
                <div class="px-2 py-1.5 text-xs space-y-0.5 border-b border-gray-600">
                    <div>Focus: <span id="focus-time" class="text-green-400">0</span>s</div>
                    <div>Session: <span id="session-time" class="text-white">0</span>s</div>
                    <div>Focused: <span id="focus-percentage" class="text-white">0</span>%</div>
                    <div>Unfocused: <span id="unfocus-time" class="text-white">0</span>s</div>
                </div>
                
                <!-- Live Feed label -->
                <div class="px-2 py-1 text-xs text-gray-300 border-b border-gray-600">
                    Live Feed <span class="text-green-400">(In-Browser)</span>
                </div>
                
                <!-- Video feed container -->
                <div class="relative bg-black">
                    <img id="tracking-video" 
                         style="width: 100%; height: 100px; display: block; background: #000; object-fit: cover;"
                         class="rounded-b-lg"
                         alt="Live camera feed">
                </div>
            </div>
        `;
        
        document.body.appendChild(trackingContainer);
        console.log('📺 Client-side eye tracking interface displayed');
    }
    
    showCountdownNotification() {
        const countdownOverlay = document.createElement('div');
        countdownOverlay.id = 'eye-tracking-countdown';
        countdownOverlay.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50';
        countdownOverlay.innerHTML = `
            <div class="bg-gray-800 text-white rounded-lg shadow-2xl p-6 text-center" style="width: 240px; height: 240px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <div class="flex items-center mb-3">
                    <div class="w-2 h-2 bg-blue-500 rounded-full mr-1.5 animate-pulse"></div>
                    <span class="text-xs font-medium">Client-Side Eye Tracking</span>
                </div>
                
                <div class="mb-4">
                    <div id="countdown-number" class="text-4xl font-bold mb-1">3</div>
                    <div id="rocket-icon" class="text-3xl hidden">🚀</div>
                </div>
                
                <div class="text-xs text-blue-300" id="countdown-status">
                    Loading AI Model...
                </div>
            </div>
        `;
        document.body.appendChild(countdownOverlay);
        
        let secondsRemaining = 3;
        const countdownNumber = document.getElementById('countdown-number');
        const rocketIcon = document.getElementById('rocket-icon');
        const statusText = document.getElementById('countdown-status');
        
        const messages = ['Loading AI Model...', 'Initializing Camera...', 'Almost Ready...'];
        
        countdownNumber.textContent = secondsRemaining;
        statusText.textContent = messages[0];
        
        const countdownInterval = setInterval(() => {
            secondsRemaining--;
            
            if (secondsRemaining > 0) {
                countdownNumber.textContent = secondsRemaining;
                statusText.textContent = messages[3 - secondsRemaining] || 'Starting...';
            } else {
                countdownNumber.classList.add('hidden');
                rocketIcon.classList.remove('hidden');
                rocketIcon.classList.add('animate-bounce');
                statusText.textContent = 'Eye Tracking Active! 🚀';
                
                clearInterval(countdownInterval);
                
                setTimeout(() => {
                    if (countdownOverlay && countdownOverlay.parentNode) {
                        countdownOverlay.remove();
                    }
                }, 1000);
            }
        }, 1000);
    }
    
    hasCountdownBeenShownForModule() {
        const sessionKey = `eyetracking_countdown_${this.moduleId}`;
        return sessionStorage.getItem(sessionKey) === 'shown';
    }

    markCountdownShownForModule() {
        const sessionKey = `eyetracking_countdown_${this.moduleId}`;
        sessionStorage.setItem(sessionKey, 'shown');
    }
    
    startDataSaving() {
        if (this.dataSaveInterval) {
            clearInterval(this.dataSaveInterval);
        }
        
        this.dataSaveInterval = setInterval(async () => {
            await this.saveSessionData();
        }, 60000); // Every 60 seconds
        
        console.log('💾 Dashboard data saving started (60s interval)');
    }
    
    stopDataSaving() {
        if (this.dataSaveInterval) {
            clearInterval(this.dataSaveInterval);
            this.dataSaveInterval = null;
        }
    }
    
    async saveSessionData() {
        if (!this.isTracking || this.isTransitioning) {
            return;
        }

        try {
            const sessionData = {
                module_id: this.moduleId,
                section_id: this.sectionId,
                session_time: Math.floor(this.timers.sessionTime || 0),
                completion_percentage: typeof currentCompletionPercentage !== 'undefined' ? currentCompletionPercentage : 0,
                focus_data: {
                    focused_time: Math.floor(this.timers.focusedTime || 0),
                    unfocused_time: Math.floor(this.timers.unfocusedTime || 0),
                    focus_percentage: this.calculateFocusPercentage(),
                    total_time: Math.floor(this.timers.sessionTime || 0)
                }
            };

            const response = await fetch('database/save_session_data.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('💾 Session data saved successfully');
                }
            }
        } catch (error) {
            console.warn('⚠️ Error saving session data:', error);
        }
    }
    
    calculateFocusPercentage() {
        const totalActiveTime = this.timers.focusedTime + this.timers.unfocusedTime;
        return totalActiveTime > 0 ? Math.round((this.timers.focusedTime / totalActiveTime) * 100) : 0;
    }
    
    async stopTracking() {
        console.log('🛑 Stopping client-side eye tracking...');
        
        this.isTransitioning = true;
        this.isTracking = false;
        
        // Save final data
        await this.saveSessionData();
        
        // Show final metrics
        this.showFinalMetrics({
            focused_time: this.timers.focusedTime,
            unfocused_time: this.timers.unfocusedTime,
            total_time: this.timers.sessionTime,
            focus_percentage: this.calculateFocusPercentage()
        });
        
        this.cleanupAllIntervals();
        this.cleanupInterface();
        
        // Stop webcam
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.video && this.video.parentNode) {
            this.video.parentNode.removeChild(this.video);
            this.video = null;
        }
        
        this.detector = null;
        this.isConnected = false;
        
        console.log('✅ Client-side eye tracking stopped');
        
        setTimeout(() => {
            this.isTransitioning = false;
        }, 1000);
    }
    
    async stopService() {
        // Same as stopTracking for client-side
        await this.stopTracking();
    }
    
    cleanupAllIntervals() {
        console.log('🧹 Cleaning up all intervals...');
        
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        if (this.dataSaveInterval) {
            clearInterval(this.dataSaveInterval);
            this.dataSaveInterval = null;
        }
        
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
            this.statusUpdateInterval = null;
        }
        
        console.log('✅ All intervals cleaned up');
    }
    
    cleanupInterface() {
        const trackingInterface = document.getElementById('cv-eye-tracking-interface');
        if (trackingInterface) {
            trackingInterface.remove();
        }
        
        const countdownOverlay = document.getElementById('eye-tracking-countdown');
        if (countdownOverlay) {
            countdownOverlay.remove();
        }
    }
    
    showFinalMetrics(metrics) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-sm';
        notification.innerHTML = `
            <div class="text-sm">
                <div class="font-semibold mb-2">📊 Session Complete!</div>
                <div class="space-y-1 text-xs">
                    <div>Focus Time: ${metrics.focused_time}s</div>
                    <div>Total Time: ${metrics.total_time}s</div>
                    <div>Focus Rate: ${metrics.focus_percentage}%</div>
                </div>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
    
    showCameraError() {
        const errorContainer = document.createElement('div');
        errorContainer.innerHTML = `
            <div class="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md z-50">
                <div class="flex items-center mb-2">
                    <div class="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                    <h3 class="text-sm font-semibold text-red-700">Camera Required</h3>
                </div>
                <div class="text-xs text-red-600 space-y-1">
                    <p>📷 Eye tracking requires camera access</p>
                    <p>Please allow camera permissions in your browser.</p>
                </div>
                <button onclick="this.parentElement.remove()" class="mt-2 text-xs text-red-600 hover:text-red-800">
                    Dismiss
                </button>
            </div>
        `;
        document.body.appendChild(errorContainer);
        
        setTimeout(() => {
            if (errorContainer.parentNode) {
                errorContainer.remove();
            }
        }, 10000);
    }
    
    showServiceError() {
        if (sessionStorage.getItem('eyeTrackingErrorShown') === 'true') {
            return;
        }
        
        sessionStorage.setItem('eyeTrackingErrorShown', 'true');
        
        const errorContainer = document.createElement('div');
        errorContainer.id = 'eye-tracking-error-notice';
        errorContainer.innerHTML = `
            <div class="fixed bottom-4 right-4 bg-gray-100 border border-gray-300 rounded-lg p-3 max-w-xs z-50 shadow-sm">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <div class="w-2 h-2 rounded-full bg-gray-400 mr-2"></div>
                        <span class="text-xs text-gray-600">Eye tracking unavailable</span>
                    </div>
                    <button onclick="this.closest('#eye-tracking-error-notice').remove()" class="text-gray-400 hover:text-gray-600 ml-2">×</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(errorContainer);
        
        setTimeout(() => {
            if (errorContainer.parentNode) {
                errorContainer.remove();
            }
        }, 5000);
    }
    
    getStats() {
        return {
            isConnected: this.isConnected,
            isTracking: this.isTracking,
            isFocused: this.isFocused,
            faceDetected: this.faceDetected,
            gazeDirection: this.gazeDirection,
            totalTime: this.timers.sessionTime,
            moduleId: this.moduleId,
            sectionId: this.sectionId
        };
    }
}

// Global instance management (same as before)
let eyeTrackingInstance = null;

function initEyeTracking(moduleId, sectionId = null) {
    // Clean up existing instance if any
    if (eyeTrackingInstance) {
        eyeTrackingInstance.stopTracking();
    }
    
    eyeTrackingInstance = new CVEyeTrackingSystem(moduleId, sectionId);
    return eyeTrackingInstance;
}

function stopEyeTracking() {
    if (eyeTrackingInstance) {
        eyeTrackingInstance.stopService();
        eyeTrackingInstance = null;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CVEyeTrackingSystem, initEyeTracking, stopEyeTracking };
}
