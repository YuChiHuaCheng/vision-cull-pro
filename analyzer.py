import sys
import json
import cv2
import mediapipe as mp
import math
import os

# Suppress verbose TF/MediaPipe logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

def calculate_ear(eye_points):
    # Compute the euclidean distances between the two sets of vertical eye landmarks
    A = math.dist(eye_points[1], eye_points[5])
    B = math.dist(eye_points[2], eye_points[4])
    # Compute the euclidean distance between the horizontal eye landmarks
    C = math.dist(eye_points[0], eye_points[3])
    # Compute the eye aspect ratio
    if C == 0: return 0
    ear = (A + B) / (2.0 * C)
    return ear

def process_image(img_path, blur_threshold):
    # Read the image
    img = cv2.imread(img_path)
    if img is None:
        return {"keep": False, "reason": "无法读取图片文件"}

    # Blur Detection
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    fm = cv2.Laplacian(gray, cv2.CV_64F).var()
    # Use dynamic threshold for stricter or looser blur detection
    if fm < blur_threshold:
        return {"keep": False, "reason": f"检测到图片模糊 (方差: {fm:.2f} < {blur_threshold})"}

    # Blink/Eye-closed Detection
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    mp_face_mesh = mp.solutions.face_mesh
    with mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=3,
        refine_landmarks=True,
        min_detection_confidence=0.5) as face_mesh:
        
        results = face_mesh.process(img_rgb)
        
        if not results.multi_face_landmarks:
            # If no faces are found, we don't consider it closed-eye. Keep it (already passed blur).
            return {"keep": True, "reason": "未检测到人脸，清晰度合格"}

        # Define landmark indices for left and right eyes (MediaPipe standard)
        LEFT_EYE = [362, 385, 387, 263, 373, 380]
        RIGHT_EYE = [33, 160, 158, 133, 153, 144]

        h, w, _ = img.shape
        
        for face_landmarks in results.multi_face_landmarks:
            # Extract left eye points
            left_eye_pts = []
            for idx in LEFT_EYE:
                lm = face_landmarks.landmark[idx]
                left_eye_pts.append((lm.x * w, lm.y * h))
                
            # Extract right eye points
            right_eye_pts = []
            for idx in RIGHT_EYE:
                lm = face_landmarks.landmark[idx]
                right_eye_pts.append((lm.x * w, lm.y * h))
                
            left_EAR = calculate_ear(left_eye_pts)
            right_EAR = calculate_ear(right_eye_pts)
            
            avg_EAR = (left_EAR + right_EAR) / 2.0
            
            if avg_EAR < 0.20:
                return {"keep": False, "reason": f"检测到人物闭眼 (EAR: {avg_EAR:.2f} < 0.20)"}
                
    return {"keep": True, "reason": "清晰度及人物眼部状态均合格"}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"keep": False, "reason": "未提供图片路径"}))
        return

    img_path = sys.argv[1]
    blur_threshold = 200.0
    if len(sys.argv) >= 3:
        try:
            blur_threshold = float(sys.argv[2])
        except ValueError:
            pass
    
    try:
        result = process_image(img_path, blur_threshold)
    except Exception as e:
        result = {"keep": False, "reason": f"处理出错: {str(e)}"}
        
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
