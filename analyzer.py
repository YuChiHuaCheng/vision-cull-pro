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

def process_image(img_path, blur_threshold, face_mesh):
    # Read the image
    img = cv2.imread(img_path)
    if img is None:
        return {"keep": False, "reason": "无法读取图片文件"}

    h, w, _ = img.shape
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    results = face_mesh.process(img_rgb)
    
    if results.multi_face_landmarks:
        faces_clear = False
        face_fms = []
        closed_eyes_detected = False
        
        # Define landmark indices for left and right eyes (MediaPipe standard)
        LEFT_EYE = [362, 385, 387, 263, 373, 380]
        RIGHT_EYE = [33, 160, 158, 133, 153, 144]
        
        for face_landmarks in results.multi_face_landmarks:
            # 1. Blur Detection exclusively on the Face ROI (Resolves Bokeh background blur issues rejecting clear portraits)
            x_coords = [lm.x for lm in face_landmarks.landmark]
            y_coords = [lm.y for lm in face_landmarks.landmark]
            
            x_min, x_max = int(min(x_coords) * w), int(max(x_coords) * w)
            y_min, y_max = int(min(y_coords) * h), int(max(y_coords) * h)
            
            # Add 20% padding around the face bounding box
            pad_x = int((x_max - x_min) * 0.2)
            pad_y = int((y_max - y_min) * 0.2)
            
            x1 = max(0, x_min - pad_x)
            y1 = max(0, y_min - pad_y)
            x2 = min(w, x_max + pad_x)
            y2 = min(h, y_max + pad_y)
            
            face_roi = gray[y1:y2, x1:x2]
            if face_roi.size > 0:
                fm = cv2.Laplacian(face_roi, cv2.CV_64F).var()
                face_fms.append(fm)
                if fm >= blur_threshold:
                    faces_clear = True
                    
            # 2. Blink/Eye-closed Detection
            left_eye_pts = [(face_landmarks.landmark[idx].x * w, face_landmarks.landmark[idx].y * h) for idx in LEFT_EYE]
            right_eye_pts = [(face_landmarks.landmark[idx].x * w, face_landmarks.landmark[idx].y * h) for idx in RIGHT_EYE]
            
            left_EAR = calculate_ear(left_eye_pts)
            right_EAR = calculate_ear(right_eye_pts)
            avg_EAR = (left_EAR + right_EAR) / 2.0
            
            # Lowered from 0.20 to 0.15 to avoid incorrectly rejecting smiling faces
            if avg_EAR < 0.15:
                closed_eyes_detected = True

        max_fm = max(face_fms) if face_fms else 0
        
        if not faces_clear and face_fms:
            return {"keep": False, "reason": f"人物面部未对焦或模糊 (人脸方差: {max_fm:.0f} < {blur_threshold})"}
            
        if closed_eyes_detected:
            return {"keep": False, "reason": f"检测到人物闭眼 (请检查是否包含闭眼者)"}
            
        return {"keep": True, "reason": f"人物对焦清晰且未闭眼 (人脸方差: {max_fm:.0f})"}
    
    else:
        # Fallback to whole image blur detection if no faces are found (Scenery, objects)
        fm = cv2.Laplacian(gray, cv2.CV_64F).var()
        if fm < blur_threshold:
            return {"keep": False, "reason": f"无人物且全局画面模糊 (全局方差: {fm:.0f} < {blur_threshold})"}
            
        return {"keep": True, "reason": f"未检测到人脸，全局清晰 (方差: {fm:.0f})"}

def main():
    # Signal that Python is ready by printing a known keyword if needed (Electron can wait for it)
    print("READY", flush=True)

    mp_face_mesh = mp.solutions.face_mesh
    
    # Initialize the heavy model ONCE before the infinite loop
    with mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=3,
        refine_landmarks=True,
        min_detection_confidence=0.5) as face_mesh:

        # Infinite daemon loop
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
                
            if line == "exit":
                break

            try:
                data = json.loads(line)
                img_path = data.get("file")
                blur_threshold = float(data.get("threshold", 200.0))
                
                if not img_path:
                    result = {"keep": False, "reason": "未提供图片路径"}
                else:
                    result = process_image(img_path, blur_threshold, face_mesh)
                    
            except json.JSONDecodeError:
                result = {"keep": False, "reason": "JSON格式无法解析"}
            except Exception as e:
                result = {"keep": False, "reason": f"处理出错: {str(e)}"}
                
            # Must flush otherwise Electron might not see it until buffer is full
            print(json.dumps(result, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
