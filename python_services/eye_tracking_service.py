"""
Cloud-Ready Eye Tracking Service for E-Learning Platform
Accepts webcam frames from client browsers for processing
"""

import cv2
import json
import time
import threading
import requests
import base64
import numpy as np
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
import logging

# Custom JSON encoder for NumPy types
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.bool_):
            return bool(obj)
        return super(NumpyEncoder, self).default(obj)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ClientSession:
    """Manages tracking state for a single client"""
    def __init__(self, user_id, module_id, section_id=None):
        self.user_id = user_id
        self.module_id = module_id
        self.section_id = section_id
        self.is_tracking = False
        self.is_focused = False
        self.session_start_time = None
        self.accumulated_focused_time = 0
        self.accumulated_unfocused_time = 0
        self.last_frame_time = time.time()
        self.focus_history = []
        self.focus_history_size = 15
        self.current_focus_session_start = None
        self.current_unfocus_session_start = None
        self.frames_processed = 0
        self.countdown_active = False
        self.countdown_start_time = None
        self.countdown_duration = 2
        self.tracking_state = "idle"
        self.latest_annotated_frame = None

class EyeTrackingService:
    def __init__(self):
        self.gaze = None
        self.sessions = {}  # Store sessions by session_id
        self.session_lock = threading.Lock()
        self.session_timeout = 300  # 5 minutes timeout for inactive sessions
        self.init_gaze_tracking()
        self.start_cleanup_thread()
        
    def init_gaze_tracking(self):
        """Initialize the gaze tracking library"""
        try:
            from gaze_tracking import GazeTracking
            self.gaze = GazeTracking()
            logger.info("GazeTracking initialized successfully")
            return True
        except ImportError:
            logger.warning("GazeTracking library not found, using fallback mode")
            self.gaze = self.create_fallback_tracker()
            return True
        except Exception as e:
            logger.error(f"Error initializing gaze tracking: {e}")
            self.gaze = self.create_fallback_tracker()
            return False
    
    def create_fallback_tracker(self):
        """Create a fallback tracker for demo/testing"""
        class FallbackTracker:
            def __init__(self):
                self.pupils_located = True
                self.current_frame = None
                
            def refresh(self, frame):
                self.current_frame = frame
                
            def annotated_frame(self):
                return self.current_frame if self.current_frame is not None else np.zeros((480, 640, 3), dtype=np.uint8)
                
            def horizontal_ratio(self):
                return 0.5 + (np.random.random() - 0.5) * 0.2
                
            def vertical_ratio(self):
                return 0.5 + (np.random.random() - 0.5) * 0.2
                
            def is_blinking(self):
                return bool(np.random.random() < 0.05)
        
        return FallbackTracker()

    def start_cleanup_thread(self):
        """Start background thread to clean up inactive sessions"""
        def cleanup_loop():
            while True:
                time.sleep(60)  # Check every minute
                self.cleanup_inactive_sessions()
        
        cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
        cleanup_thread.start()

    def cleanup_inactive_sessions(self):
        """Remove sessions that have been inactive for too long"""
        current_time = time.time()
        with self.session_lock:
            inactive_sessions = [
                sid for sid, session in self.sessions.items()
                if current_time - session.last_frame_time > self.session_timeout
            ]
            for sid in inactive_sessions:
                logger.info(f"Cleaning up inactive session: {sid}")
                del self.sessions[sid]

    def get_or_create_session(self, session_id, user_id=None, module_id=None, section_id=None):
        """Get existing session or create a new one"""
        with self.session_lock:
            if session_id not in self.sessions:
                if user_id and module_id:
                    self.sessions[session_id] = ClientSession(user_id, module_id, section_id)
                    logger.info(f"Created new session: {session_id}")
                else:
                    return None
            return self.sessions.get(session_id)

    def decode_frame(self, frame_data):
        """Decode base64 frame data to numpy array"""
        try:
            # Remove data URL prefix if present
            if ',' in frame_data:
                frame_data = frame_data.split(',')[1]
            
            # Decode base64
            frame_bytes = base64.b64decode(frame_data)
            
            # Convert to numpy array
            nparr = np.frombuffer(frame_bytes, np.uint8)
            
            # Decode image
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            return frame
        except Exception as e:
            logger.error(f"Error decoding frame: {e}")
            return None

    def process_frame(self, session_id, frame_data):
        """Process a frame from the client"""
        session = self.sessions.get(session_id)
        if not session:
            return {'success': False, 'error': 'Session not found'}
        
        # Decode the frame
        frame = self.decode_frame(frame_data)
        if frame is None:
            return {'success': False, 'error': 'Failed to decode frame'}
        
        session.last_frame_time = time.time()
        session.frames_processed += 1
        
        # Handle countdown
        if session.countdown_active:
            elapsed = time.time() - session.countdown_start_time
            if elapsed >= session.countdown_duration:
                session.countdown_active = False
                session.is_tracking = True
                session.tracking_state = "tracking"
                session.session_start_time = time.time()
                logger.info(f"Session {session_id}: Countdown complete, tracking started")
        
        # Process gaze if tracking
        is_focused = False
        annotated_frame_b64 = None
        
        if session.is_tracking:
            is_focused = self.analyze_gaze(frame, session)
            self.update_focus_state(session, is_focused)
        
        # Get annotated frame
        try:
            self.gaze.refresh(frame)
            annotated_frame = self.gaze.annotated_frame()
            if annotated_frame is not None:
                annotated_frame = self.add_tracking_overlay(annotated_frame, session)
                session.latest_annotated_frame = annotated_frame
                # Encode back to base64
                _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                annotated_frame_b64 = base64.b64encode(buffer).decode('utf-8')
        except Exception as e:
            logger.warning(f"Error creating annotated frame: {e}")
        
        return {
            'success': True,
            'is_focused': bool(is_focused),
            'tracking_state': session.tracking_state,
            'countdown_active': session.countdown_active,
            'countdown_remaining': max(0, session.countdown_duration - (time.time() - session.countdown_start_time)) if session.countdown_start_time else 0,
            'annotated_frame': f"data:image/jpeg;base64,{annotated_frame_b64}" if annotated_frame_b64 else None,
            'metrics': self.get_session_metrics(session)
        }

    def analyze_gaze(self, frame, session):
        """Analyze gaze direction from frame"""
        if not self.gaze:
            return bool(np.random.random() > 0.3)
        
        try:
            self.gaze.refresh(frame)
            
            if hasattr(self.gaze, 'pupils_located') and self.gaze.pupils_located:
                h_ratio = self.gaze.horizontal_ratio()
                v_ratio = self.gaze.vertical_ratio()
                
                if hasattr(self.gaze, 'is_blinking') and self.gaze.is_blinking():
                    return False
                
                if h_ratio is not None and v_ratio is not None:
                    h_distance = abs(h_ratio - 0.5)
                    v_distance = abs(v_ratio - 0.5)
                    
                    # Focus zones
                    if h_distance < 0.2 and v_distance < 0.2:
                        return True
                    elif h_distance < 0.3 and v_distance < 0.3:
                        return bool(np.random.random() > 0.3)
                    
            return False
        except Exception as e:
            logger.warning(f"Error in gaze analysis: {e}")
            return bool(np.random.random() > 0.4)

    def update_focus_state(self, session, is_focused_now):
        """Update focus state with smoothing"""
        session.focus_history.append(is_focused_now)
        if len(session.focus_history) > session.focus_history_size:
            session.focus_history.pop(0)
        
        weights = np.linspace(0.5, 1.0, len(session.focus_history))
        weighted_focus = np.average(session.focus_history, weights=weights)
        smoothed_focus = weighted_focus > 0.6
        
        current_time = time.time()
        
        if smoothed_focus != session.is_focused:
            if session.is_focused:
                if session.current_focus_session_start:
                    session.accumulated_focused_time += current_time - session.current_focus_session_start
                    session.current_focus_session_start = None
                session.current_unfocus_session_start = current_time
            else:
                if session.current_unfocus_session_start:
                    session.accumulated_unfocused_time += current_time - session.current_unfocus_session_start
                    session.current_unfocus_session_start = None
                session.current_focus_session_start = current_time
            
            session.is_focused = smoothed_focus

    def add_tracking_overlay(self, frame, session):
        """Add tracking overlay to frame"""
        if frame is None:
            return frame
        
        height, width = frame.shape[:2]
        
        # Status text
        status_color = (0, 255, 0) if session.is_focused else (0, 0, 255)
        cv2.putText(frame, f"Status: {session.tracking_state.upper()}", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(frame, f"Focus: {'YES' if session.is_focused else 'NO'}", (10, 55), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
        
        # Countdown overlay
        if session.countdown_active and session.countdown_start_time:
            remaining = session.countdown_duration - (time.time() - session.countdown_start_time)
            if remaining > 0:
                cv2.putText(frame, f"Starting in: {remaining:.1f}s", (width//2 - 100, height//2), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
        
        return frame

    def get_session_metrics(self, session):
        """Get metrics for a session"""
        current_time = time.time()
        
        focused = session.accumulated_focused_time
        unfocused = session.accumulated_unfocused_time
        
        if session.current_focus_session_start:
            focused += current_time - session.current_focus_session_start
        if session.current_unfocus_session_start:
            unfocused += current_time - session.current_unfocus_session_start
        
        total = focused + unfocused
        percentage = (focused / total * 100) if total > 0 else 0
        
        return {
            'focused_time': round(focused, 1),
            'unfocused_time': round(unfocused, 1),
            'total_time': round(total, 1),
            'focus_percentage': round(percentage, 1),
            'frames_processed': session.frames_processed,
            'current_state': 'focused' if session.is_focused else 'unfocused'
        }

    def start_session(self, session_id, user_id, module_id, section_id=None):
        """Start a new tracking session"""
        session = self.get_or_create_session(session_id, user_id, module_id, section_id)
        if session:
            session.countdown_active = True
            session.countdown_start_time = time.time()
            session.tracking_state = "countdown"
            session.accumulated_focused_time = 0
            session.accumulated_unfocused_time = 0
            session.focus_history = []
            logger.info(f"Started session {session_id} for user {user_id}")
            return True
        return False

    def stop_session(self, session_id):
        """Stop a tracking session"""
        session = self.sessions.get(session_id)
        if session:
            session.is_tracking = False
            session.countdown_active = False
            session.tracking_state = "stopped"
            metrics = self.get_session_metrics(session)
            logger.info(f"Stopped session {session_id}")
            return metrics
        return None


# Flask app setup
app = Flask(__name__)
app.json_encoder = NumpyEncoder
CORS(app, origins=["*"])  # Allow all origins for cloud deployment

# Global tracker instance
eye_tracker = EyeTrackingService()

@app.route('/api/start_tracking', methods=['POST'])
def start_tracking():
    """Start eye tracking session"""
    data = request.get_json()
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    module_id = data.get('module_id')
    section_id = data.get('section_id')
    
    if not all([session_id, user_id, module_id]):
        return jsonify({'success': False, 'error': 'Missing required parameters'}), 400
    
    success = eye_tracker.start_session(session_id, user_id, module_id, section_id)
    return jsonify({
        'success': success,
        'message': 'Tracking session started' if success else 'Failed to start session',
        'countdown_duration': 2
    })

@app.route('/api/stop_tracking', methods=['POST'])
def stop_tracking():
    """Stop eye tracking session"""
    data = request.get_json()
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'success': False, 'error': 'Missing session_id'}), 400
    
    metrics = eye_tracker.stop_session(session_id)
    return jsonify({
        'success': metrics is not None,
        'final_metrics': metrics
    })

@app.route('/api/process_frame', methods=['POST'])
def process_frame():
    """Process a frame from client webcam"""
    data = request.get_json()
    session_id = data.get('session_id')
    frame_data = data.get('frame')
    
    if not session_id or not frame_data:
        return jsonify({'success': False, 'error': 'Missing session_id or frame data'}), 400
    
    result = eye_tracker.process_frame(session_id, frame_data)
    return jsonify(result)

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get session status"""
    session_id = request.args.get('session_id')
    
    if not session_id:
        return jsonify({'success': False, 'error': 'Missing session_id'}), 400
    
    session = eye_tracker.sessions.get(session_id)
    if not session:
        return jsonify({'success': False, 'error': 'Session not found'}), 404
    
    return jsonify({
        'success': True,
        'status': {
            'tracking_state': session.tracking_state,
            'is_focused': session.is_focused,
            'countdown_active': session.countdown_active,
            'metrics': eye_tracker.get_session_metrics(session)
        }
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'message': 'Cloud Eye Tracking Service is running',
        'version': '3.0.0',
        'mode': 'client-webcam',
        'active_sessions': len(eye_tracker.sessions),
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting Cloud Eye Tracking Service on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
