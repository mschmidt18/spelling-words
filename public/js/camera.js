// Camera module for image capture
const CameraModule = (function() {
    let videoElement = null;
    let canvasElement = null;
    let captureButton = null;
    let fileUpload = null;
    let stream = null;
    let onCaptureCallback = null;
    let onErrorCallback = null;

    function init(onCapture, onError) {
        onCaptureCallback = onCapture;
        onErrorCallback = onError;

        videoElement = document.getElementById('camera-preview');
        canvasElement = document.getElementById('capture-canvas');
        captureButton = document.getElementById('capture-btn');
        fileUpload = document.getElementById('file-upload');

        // Set up event listeners
        if (captureButton) {
            captureButton.addEventListener('click', captureImage);
        }

        if (fileUpload) {
            fileUpload.addEventListener('change', handleFileUpload);
        }

        // Start camera
        startCamera();
    }

    async function startCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: 'environment', // Use back camera on mobile
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };

            stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoElement) {
                videoElement.srcObject = stream;
                videoElement.play();
            }

            // Enable capture button
            if (captureButton) {
                captureButton.disabled = false;
            }
        } catch (error) {
            console.error('Camera access error:', error);
            handleCameraError(error);
        }
    }

    function handleCameraError(error) {
        let errorMessage = 'Camera access failed. ';

        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage += 'Please allow camera access or use the "Upload Image" button.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage += 'No camera found. Please use the "Upload Image" button.';
        } else {
            errorMessage += 'Please use the "Upload Image" button.';
        }

        if (onErrorCallback) {
            onErrorCallback(errorMessage);
        }

        // Hide video preview if camera failed
        if (videoElement) {
            videoElement.style.display = 'none';
        }

        // Disable capture button
        if (captureButton) {
            captureButton.disabled = true;
        }
    }

    function captureImage() {
        if (!videoElement || !canvasElement) {
            return;
        }

        // Set canvas dimensions to match video
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;

        if (videoWidth === 0 || videoHeight === 0) {
            if (onErrorCallback) {
                onErrorCallback('Camera not ready. Please wait a moment and try again.');
            }
            return;
        }

        canvasElement.width = videoWidth;
        canvasElement.height = videoHeight;

        // Draw video frame to canvas
        const context = canvasElement.getContext('2d');
        context.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

        // Apply preprocessing
        preprocessImage(context, videoWidth, videoHeight);

        // Get image data
        const imageData = canvasElement.toDataURL('image/png');

        // Trigger callback with captured image
        if (onCaptureCallback) {
            onCaptureCallback(imageData);
        }
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            if (onErrorCallback) {
                onErrorCallback('Please select an image file.');
            }
            return;
        }

        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();

            img.onload = function() {
                // Create temporary canvas for uploaded image
                const tempCanvas = document.createElement('canvas');

                // Limit resolution for faster processing
                const maxDimension = 1920;
                let width = img.width;
                let height = img.height;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }

                tempCanvas.width = width;
                tempCanvas.height = height;

                const context = tempCanvas.getContext('2d');
                context.drawImage(img, 0, 0, width, height);

                // Apply preprocessing
                preprocessImage(context, width, height);

                // Get image data
                const imageData = tempCanvas.toDataURL('image/png');

                // Trigger callback
                if (onCaptureCallback) {
                    onCaptureCallback(imageData);
                }
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    }

    function preprocessImage(context, width, height) {
        // Get image data
        const imageData = context.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Apply brightness and contrast boost
        const brightness = 10;
        const contrast = 50;

        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
            // Apply contrast
            data[i] = factor * (data[i] - 128) + 128;     // R
            data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
            data[i + 2] = factor * (data[i + 2] - 128) + 128; // B

            // Apply brightness
            data[i] = data[i] + brightness;
            data[i + 1] = data[i + 1] + brightness;
            data[i + 2] = data[i + 2] + brightness;

            // Clamp values
            data[i] = Math.max(0, Math.min(255, data[i]));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
        }

        // Put processed image data back
        context.putImageData(imageData, 0, 0);
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        if (videoElement) {
            videoElement.srcObject = null;
        }
    }

    function restart() {
        stopCamera();

        // Reset file input
        if (fileUpload) {
            fileUpload.value = '';
        }

        // Show video preview again
        if (videoElement) {
            videoElement.style.display = 'block';
        }

        // Clear any error messages
        const errorElement = document.getElementById('camera-error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }

        // Restart camera
        startCamera();
    }

    return {
        init,
        restart,
        stopCamera
    };
})();
