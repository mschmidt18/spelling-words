// Camera module for image capture
const CameraModule = (function() {
    let canvasElement = null;
    let captureInput = null;
    let uploadInput = null;
    let onCaptureCallback = null;
    let onErrorCallback = null;

    function init(onCapture, onError) {
        onCaptureCallback = onCapture;
        onErrorCallback = onError;

        canvasElement = document.getElementById('capture-canvas');
        captureInput = document.getElementById('capture-input');
        uploadInput = document.getElementById('upload-input');

        // Set up event listeners for both file inputs
        if (captureInput) {
            captureInput.addEventListener('change', handleFileInput);
        }

        if (uploadInput) {
            uploadInput.addEventListener('change', handleFileInput);
        }
    }

    function handleFileInput(event) {
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
                // Create temporary canvas for image processing
                const tempCanvas = document.createElement('canvas');

                // Limit resolution for faster processing and smaller payload
                // 1280px is sufficient for OCR and keeps file size under Vercel's 4.5MB limit
                const maxDimension = 1280;
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

                // Get image data as JPEG with 0.8 quality for smaller file size
                const imageData = tempCanvas.toDataURL('image/jpeg', 0.8);

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

    function restart() {
        // Reset file inputs
        if (captureInput) {
            captureInput.value = '';
        }
        if (uploadInput) {
            uploadInput.value = '';
        }

        // Clear any error messages
        const errorElement = document.getElementById('camera-error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    return {
        init,
        restart,
        stopCamera: function() {} // No-op for backwards compatibility
    };
})();
