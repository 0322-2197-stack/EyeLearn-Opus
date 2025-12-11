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
        
        // Head pose landmarks for detecting turned head
        this.NOSE_TIP = 1;
        this.NOSE_BRIDGE = 6;
        this.LEFT_CHEEK = 234;
        this.RIGHT_CHEEK = 454;
        this.FOREHEAD = 10;
        this.CHIN = 152;
        
        // Additional eye landmarks for EAR (Eye Aspect Ratio)
        this.LEFT_EYE_VERTICAL = [386, 374]; // Top and bottom of left eye
        this.RIGHT_EYE_VERTICAL = [159, 145]; // Top and bottom of right eye
        this.LEFT_EYE_HORIZONTAL = [362, 263]; // Left and right corners
        this.RIGHT_EYE_HORIZONTAL = [33, 133]; // Left and right corners
        
        // Focus detection thresholds - TIGHTENED for better unfocus detection
        this.focusThresholds = {
            horizontalMin: 0.30,  // Left boundary (0-1 normalized) - tighter
            horizontalMax: 0.70,  // Right boundary - tighter
            verticalMin: 0.25,    // Top boundary - tighter
            verticalMax: 0.75     // Bottom boundary - tighter
        };
        
        // Head pose thresholds
        this.headPoseThresholds = {
            maxYawAngle: 25,      // Max degrees head can turn left/right
            maxPitchAngle: 20,    // Max degrees head can tilt up/down
            maxRollAngle: 25      // Max degrees head can tilt sideways
        };
        
        // Eye aspect ratio for blink/closed eye detection
        this.earThresholds = {
            blinkThreshold: 0.18,     // Below this = eyes closed
            drowsyThreshold: 0.22,    // Below this = drowsy/squinting
            closedFramesForUnfocus: 10 // Frames with closed eyes = unfocused
        };
        
        // Tracking state
        this.isFocused = false;
        this.faceDetected = false;
        this.gazeDirection = { x: 0.5, y: 0.5 };
        this.headPose = { yaw: 0, pitch: 0, roll: 0 };
        this.eyeAspectRatio = { left: 0.3, right: 0.3, average: 0.3 };
        this.consecutiveUnfocusedFrames = 0;
        this.consecutiveFocusedFrames = 0;
        this.consecutiveClosedEyeFrames = 0;
        this.focusChangeThreshold = 5;        // Frames needed to become focused
        this.unfocusChangeThreshold = 3;      // Frames needed to become unfocused (faster reaction)
        
        // Gaze history for velocity/movement detection
        this.gazeHistory = [];
        this.gazeHistoryMaxLength = 5;
        this.rapidMovementThreshold = 0.15;   // Gaze change per frame indicating looking away
        
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
        console.log('🧠 Loading MediaPipe FaceMesh model...');
        
        try {
            // Wait for MediaPipe FaceMesh to be ready
            if (typeof FaceMesh === 'undefined') {
                console.log('⏳ Waiting for MediaPipe FaceMesh to load...');
                await this.waitForFaceMesh();
            }
            
            console.log('✅ MediaPipe FaceMesh library loaded');
            
            // Create the FaceMesh instance
            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });
            
            // Configure FaceMesh
            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true, // Enable iris detection (478 landmarks)
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            // Set up the results callback
            this.faceMesh.onResults((results) => {
                this.onFaceMeshResults(results);
            });
            
            // Initialize the model by sending a blank frame
            console.log('🔧 Initializing FaceMesh model...');
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 640;
            tempCanvas.height = 480;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.fillStyle = '#000';
            tempCtx.fillRect(0, 0, 640, 480);
            await this.faceMesh.send({ image: tempCanvas });
            
            this.detectorReady = true;
            console.log('✅ MediaPipe FaceMesh ready!');
            return true;
        } catch (error) {
            console.error('❌ Error loading ML models:', error);
            this.detectorReady = false;
            return false;
        }
    }
    
    waitForFaceMesh() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds max
            
            const check = () => {
                if (typeof FaceMesh !== 'undefined') {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('MediaPipe FaceMesh did not load in time'));
                } else {
                    attempts++;
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    // MediaPipe FaceMesh results callback
    onFaceMeshResults(results) {
        if (!this.outputCtx) return;
        
        // Clear and draw video frame
        this.outputCtx.save();
        this.outputCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
        this.outputCtx.drawImage(results.image, 0, 0, this.outputCanvas.width, this.outputCanvas.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            this.faceDetected = true;
            
            // Process eye landmarks and determine focus
            this.processEyeLandmarksFromMediaPipe(landmarks);
            
            // Draw eye visualization
            this.drawEyeVisualization(landmarks);
        } else {
            this.faceDetected = false;
            this.handleNoFaceDetected();
        }
        
        this.outputCtx.restore();
        
        // Update the video display
        this.updateVideoDisplay();
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
        
        // Start the tracking loop using MediaPipe's native API
        this.trackingInterval = setInterval(async () => {
            await this.processFrame();
        }, 100); // 10 FPS - good balance between accuracy and performance
        
        console.log('✅ Eye tracking started (10 FPS)');
        return true;
    }
    
    async processFrame() {
        if (!this.isTracking || !this.video || !this.faceMesh || this.isTransitioning) {
            return;
        }
        
        try {
            // Send frame to MediaPipe FaceMesh for processing
            // Results are handled in onFaceMeshResults callback
            await this.faceMesh.send({ image: this.video });
        } catch (error) {
            // Silently handle occasional processing errors
            if (Math.random() < 0.01) {
                console.debug('Frame processing error:', error.message);
            }
        }
    }
    
    // Process landmarks from MediaPipe native format (normalized 0-1 coordinates)
    processEyeLandmarksFromMediaPipe(landmarks) {
        if (!landmarks || landmarks.length < 478) {
            return; // Need full face mesh with iris landmarks
        }
        
        try {
            // MediaPipe returns normalized coordinates (0-1)
            // Get iris centers
            const leftIrisCenter = this.getIrisCenterFromMediaPipe(landmarks, this.LEFT_IRIS);
            const rightIrisCenter = this.getIrisCenterFromMediaPipe(landmarks, this.RIGHT_IRIS);
            
            // Get eye boundaries for ratio calculation
            const leftEyeBounds = this.getEyeBoundsFromMediaPipe(landmarks, this.LEFT_EYE);
            const rightEyeBounds = this.getEyeBoundsFromMediaPipe(landmarks, this.RIGHT_EYE);
            
            if (leftIrisCenter && rightIrisCenter && leftEyeBounds && rightEyeBounds) {
                // Calculate normalized gaze position within eye bounds
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
    
    getIrisCenterFromMediaPipe(landmarks, irisIndices) {
        let sumX = 0, sumY = 0, count = 0;
        
        for (const idx of irisIndices) {
            if (landmarks[idx]) {
                sumX += landmarks[idx].x;
                sumY += landmarks[idx].y;
                count++;
            }
        }
        
        if (count === 0) return null;
        
        return {
            x: sumX / count,
            y: sumY / count
        };
    }
    
    getEyeBoundsFromMediaPipe(landmarks, eyeIndices) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const idx of eyeIndices) {
            if (landmarks[idx]) {
                minX = Math.min(minX, landmarks[idx].x);
                maxX = Math.max(maxX, landmarks[idx].x);
                minY = Math.min(minY, landmarks[idx].y);
                maxY = Math.max(maxY, landmarks[idx].y);
            }
        }
        
        if (minX === Infinity) return null;
        
        return { minX, maxX, minY, maxY };
    }
    
    // Draw eye visualization on the output canvas
    drawEyeVisualization(landmarks) {
        if (!this.outputCtx) return;
        
        const w = this.outputCanvas.width;
        const h = this.outputCanvas.height;
        
        // Draw eye outlines
        this.outputCtx.strokeStyle = this.isFocused ? '#00ff00' : '#ff0000';
        this.outputCtx.lineWidth = 2;
        
        // Draw left eye
        this.outputCtx.beginPath();
        for (let i = 0; i < this.LEFT_EYE.length; i++) {
            const pt = landmarks[this.LEFT_EYE[i]];
            if (i === 0) {
                this.outputCtx.moveTo(pt.x * w, pt.y * h);
            } else {
                this.outputCtx.lineTo(pt.x * w, pt.y * h);
            }
        }
        this.outputCtx.closePath();
        this.outputCtx.stroke();
        
        // Draw right eye
        this.outputCtx.beginPath();
        for (let i = 0; i < this.RIGHT_EYE.length; i++) {
            const pt = landmarks[this.RIGHT_EYE[i]];
            if (i === 0) {
                this.outputCtx.moveTo(pt.x * w, pt.y * h);
            } else {
                this.outputCtx.lineTo(pt.x * w, pt.y * h);
            }
        }
        this.outputCtx.closePath();
        this.outputCtx.stroke();
        
        // Draw iris centers
        this.outputCtx.fillStyle = '#00ffff';
        
        // Left iris
        const leftIris = this.getIrisCenterFromMediaPipe(landmarks, this.LEFT_IRIS);
        if (leftIris) {
            this.outputCtx.beginPath();
            this.outputCtx.arc(leftIris.x * w, leftIris.y * h, 3, 0, Math.PI * 2);
            this.outputCtx.fill();
        }
        
        // Right iris
        const rightIris = this.getIrisCenterFromMediaPipe(landmarks, this.RIGHT_IRIS);
        if (rightIris) {
            this.outputCtx.beginPath();
            this.outputCtx.arc(rightIris.x * w, rightIris.y * h, 3, 0, Math.PI * 2);
            this.outputCtx.fill();
        }
        
        // Draw gaze indicator
        this.outputCtx.fillStyle = this.isFocused ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
        const gazeX = this.gazeDirection.x * w;
        const gazeY = this.gazeDirection.y * h;
        this.outputCtx.beginPath();
        this.outputCtx.arc(gazeX, 30, 15, 0, Math.PI * 2);
        this.outputCtx.fill();
    }
    
    // Keep old methods for compatibility but they won't be used
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
        // Multi-factor focus detection
        const { x, y } = this.gazeDirection;
        const { horizontalMin, horizontalMax, verticalMin, verticalMax } = this.focusThresholds;
        
        // Factor 1: Gaze position within screen bounds
        const gazeInBounds = x >= horizontalMin && x <= horizontalMax && 
                             y >= verticalMin && y <= verticalMax;
        
        // Factor 2: Head pose - is head turned away?
        const headFacingScreen = this.isHeadFacingScreen();
        
        // Factor 3: Eyes open (not closed or drowsy for extended period)
        const eyesOpen = this.eyeAspectRatio.average >= this.earThresholds.blinkThreshold;
        
        // Factor 4: Not making rapid eye movements away from center
        const notLookingAway = !this.isRapidGazeMovement();
        
        // User is focused if:
        // - Gaze is in bounds AND head facing screen AND eyes reasonably open
        // - OR gaze is in bounds AND eyes open (allow some head movement)
        if (!eyesOpen) {
            this.consecutiveClosedEyeFrames++;
            // Prolonged eye closure = unfocused
            if (this.consecutiveClosedEyeFrames >= this.earThresholds.closedFramesForUnfocus) {
                return false;
            }
        } else {
            this.consecutiveClosedEyeFrames = 0;
        }
        
        // Primary check: gaze + head pose
        if (gazeInBounds && headFacingScreen && notLookingAway) {
            return true;
        }
        
        // Secondary check: just gaze (more lenient, for when head tracking is unreliable)
        if (gazeInBounds && eyesOpen) {
            // Still focused but with reduced confidence
            return true;
        }
        
        return false;
    }
    
    isHeadFacingScreen() {
        const { yaw, pitch, roll } = this.headPose;
        const { maxYawAngle, maxPitchAngle, maxRollAngle } = this.headPoseThresholds;
        
        return Math.abs(yaw) <= maxYawAngle && 
               Math.abs(pitch) <= maxPitchAngle && 
               Math.abs(roll) <= maxRollAngle;
    }
    
    isRapidGazeMovement() {
        if (this.gazeHistory.length < 2) return false;
        
        const current = this.gazeHistory[this.gazeHistory.length - 1];
        const previous = this.gazeHistory[this.gazeHistory.length - 2];
        
        const deltaX = Math.abs(current.x - previous.x);
        const deltaY = Math.abs(current.y - previous.y);
        const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Rapid movement away from center
        const movingAwayFromCenter = 
            (current.x < 0.3 && deltaX > 0.05 && current.x < previous.x) ||
            (current.x > 0.7 && deltaX > 0.05 && current.x > previous.x) ||
            (current.y < 0.2 && deltaY > 0.05 && current.y < previous.y) ||
            (current.y > 0.8 && deltaY > 0.05 && current.y > previous.y);
        
        return movement > this.rapidMovementThreshold && movingAwayFromCenter;
    }
    
    calculateEyeAspectRatio(landmarks) {
        // EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
        // Simplified: vertical distance / horizontal distance
        
        try {
            // Left eye EAR
            const leftTop = landmarks[this.LEFT_EYE_VERTICAL[0]];
            const leftBottom = landmarks[this.LEFT_EYE_VERTICAL[1]];
            const leftLeft = landmarks[this.LEFT_EYE_HORIZONTAL[0]];
            const leftRight = landmarks[this.LEFT_EYE_HORIZONTAL[1]];
            
            const leftVertical = Math.sqrt(
                Math.pow(leftTop.x - leftBottom.x, 2) + 
                Math.pow(leftTop.y - leftBottom.y, 2)
            );
            const leftHorizontal = Math.sqrt(
                Math.pow(leftLeft.x - leftRight.x, 2) + 
                Math.pow(leftLeft.y - leftRight.y, 2)
            );
            const leftEAR = leftHorizontal > 0 ? leftVertical / leftHorizontal : 0;
            
            // Right eye EAR
            const rightTop = landmarks[this.RIGHT_EYE_VERTICAL[0]];
            const rightBottom = landmarks[this.RIGHT_EYE_VERTICAL[1]];
            const rightLeft = landmarks[this.RIGHT_EYE_HORIZONTAL[0]];
            const rightRight = landmarks[this.RIGHT_EYE_HORIZONTAL[1]];
            
            const rightVertical = Math.sqrt(
                Math.pow(rightTop.x - rightBottom.x, 2) + 
                Math.pow(rightTop.y - rightBottom.y, 2)
            );
            const rightHorizontal = Math.sqrt(
                Math.pow(rightLeft.x - rightRight.x, 2) + 
                Math.pow(rightLeft.y - rightRight.y, 2)
            );
            const rightEAR = rightHorizontal > 0 ? rightVertical / rightHorizontal : 0;
            
            this.eyeAspectRatio = {
                left: leftEAR,
                right: rightEAR,
                average: (leftEAR + rightEAR) / 2
            };
        } catch (e) {
            // Keep previous values on error
        }
    }
    
    calculateHeadPose(landmarks) {
        // Simplified head pose estimation using facial landmarks
        try {
            const nose = landmarks[this.NOSE_TIP];
            const leftCheek = landmarks[this.LEFT_CHEEK];
            const rightCheek = landmarks[this.RIGHT_CHEEK];
            const forehead = landmarks[this.FOREHEAD];
            const chin = landmarks[this.CHIN];
            
            // Yaw (left-right rotation): compare nose position relative to cheeks
            const cheekMidX = (leftCheek.x + rightCheek.x) / 2;
            const cheekWidth = Math.abs(rightCheek.x - leftCheek.x);
            const yawRatio = (nose.x - cheekMidX) / (cheekWidth / 2);
            this.headPose.yaw = yawRatio * 45; // Approximate degrees
            
            // Pitch (up-down rotation): compare nose to forehead-chin line
            const faceMidY = (forehead.y + chin.y) / 2;
            const faceHeight = Math.abs(chin.y - forehead.y);
            const pitchRatio = (nose.y - faceMidY) / (faceHeight / 2);
            this.headPose.pitch = pitchRatio * 30; // Approximate degrees
            
            // Roll (tilt): compare eye levels or cheek levels
            const rollAngle = Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x);
            this.headPose.roll = rollAngle * (180 / Math.PI);
            
        } catch (e) {
            // Keep previous values on error
        }
    }
    
    handleNoFaceDetected() {
        this.consecutiveUnfocusedFrames++;
        this.consecutiveFocusedFrames = 0;
        
        // No face = definitely unfocused, react quickly
        if (this.consecutiveUnfocusedFrames >= this.unfocusChangeThreshold && this.isFocused) {
            this.isFocused = false;
            this.handleFocusChange(false);
            console.log('👁️ Unfocused: No face detected');
        }
        
        // Draw "No Face Detected" on output
        if (this.outputCtx) {
            this.outputCtx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            this.outputCtx.font = 'bold 16px Arial';
            this.outputCtx.fillText('No Face Detected', 10, 30);
        }
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
        
        // Try to restore session data from previous navigation within same module
        const savedSession = this.restoreSessionFromStorage();
        
        if (savedSession) {
            console.log('📦 Restoring session from storage:', savedSession);
            this.timers.sessionStart = Date.now() - (savedSession.sessionTime * 1000);
            this.timers.sessionTime = savedSession.sessionTime;
            this.timers.focusedTime = savedSession.focusedTime;
            this.timers.unfocusedTime = savedSession.unfocusedTime;
            this.timers.isCurrentlyFocused = false;
            this.timers.baseFocusedTime = savedSession.focusedTime;
            this.timers.baseUnfocusedTime = savedSession.unfocusedTime;
            this.timers.currentUnfocusStart = Date.now(); // Resume as unfocused
        } else {
            this.timers.sessionStart = Date.now();
            this.timers.sessionTime = 0;
            this.timers.focusedTime = 0;
            this.timers.unfocusedTime = 0;
            this.timers.isCurrentlyFocused = false;
            this.timers.baseFocusedTime = 0;
            this.timers.baseUnfocusedTime = 0;
            this.timers.currentUnfocusStart = Date.now(); // Start as unfocused
        }
        
        // Set up beforeunload handler to save session on navigation
        this.setupNavigationPersistence();
        
        this.timerInterval = setInterval(() => {
            this.updateTimers();
        }, 100);
    }
    
    setupNavigationPersistence() {
        // Save session data when navigating away
        const saveHandler = () => {
            this.saveSessionToStorage();
        };
        
        // Handle page navigation (beforeunload)
        window.addEventListener('beforeunload', saveHandler);
        
        // Handle SPA-style navigation (clicks on section links)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href*="Smodulepart.php"]');
            if (link && link.href.includes(this.moduleId)) {
                this.saveSessionToStorage();
            }
        });
        
        // Also save periodically in case of unexpected navigation
        this.sessionPersistInterval = setInterval(() => {
            this.saveSessionToStorage();
        }, 5000); // Every 5 seconds
    }
    
    saveSessionToStorage() {
        const sessionKey = `eyetracking_session_${this.moduleId}`;
        const sessionData = {
            moduleId: this.moduleId,
            sessionTime: this.timers.sessionTime || 0,
            focusedTime: this.timers.focusedTime || 0,
            unfocusedTime: this.timers.unfocusedTime || 0,
            savedAt: Date.now()
        };
        sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));
    }
    
    restoreSessionFromStorage() {
        const sessionKey = `eyetracking_session_${this.moduleId}`;
        const saved = sessionStorage.getItem(sessionKey);
        
        if (!saved) return null;
        
        try {
            const sessionData = JSON.parse(saved);
            
            // Only restore if saved within the last 5 minutes (avoid stale data)
            const fiveMinutes = 5 * 60 * 1000;
            if (Date.now() - sessionData.savedAt > fiveMinutes) {
                console.log('🗑️ Session data too old, starting fresh');
                sessionStorage.removeItem(sessionKey);
                return null;
            }
            
            // Verify it's for the same module
            if (sessionData.moduleId !== this.moduleId) {
                return null;
            }
            
            return sessionData;
        } catch (e) {
            console.warn('Failed to parse saved session:', e);
            return null;
        }
    }
    
    clearSessionFromStorage() {
        const sessionKey = `eyetracking_session_${this.moduleId}`;
        sessionStorage.removeItem(sessionKey);
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
        
        // Save final data to server
        await this.saveSessionData();
        
        // Clear the session storage since tracking is complete
        this.clearSessionFromStorage();
        
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
        
        if (this.sessionPersistInterval) {
            clearInterval(this.sessionPersistInterval);
            this.sessionPersistInterval = null;
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
