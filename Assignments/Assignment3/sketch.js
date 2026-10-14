// Meghna/Assignments/Assignment3/sketch.js
// sketch uses live webcam video and reduces each frame to a few dominant colors using K-means clustering
// color quantization / image segmentation by color

let capture;
let outImg;
let cvReady = false;
let k = 3; // number of clusters
let w = 640;
let h = 480;
let lastProcessedAt = 0;
let processingInterval = 150;

// updates page status and sets cvReady to true
function onOpenCvReady() {
  document.getElementById('status').innerText = 'OpenCV.js is ready ✅';
  cvReady = true;
}

// webcam version - active code for live video input
function setup() {
  // drawing area with dimensions 640 by 480
  createCanvas(w, h);
  // asks the browser for webcam video and stores the resulting p5 video element in capture
  capture = createCapture({
    audio: false,
    video: {
      width: w,
      height: h
    }
  }, function() {
    console.log('capture ready.')
  });

  capture.elt.setAttribute('playsinline', '');
  capture.size(w, h);
  capture.hide();
}

// check and display each video frame
function draw() {
  // debugging: safety check for if capture is not ready, return early
  if (!capture || !capture.elt || capture.elt.readyState < 2) {
    return;
  }

  // makescurrent camera frame’s pixel data available through capture.pixels.I
  // if pixel array is empty, there is no usable frame yet, so the code returns and tries again on the next draw
  capture.loadPixels();
  if (capture.pixels.length === 0) {
    return;
  }

  // runs K-means only when 
    // cvReady says OpenCV has finished initializing
    // Enough time has passed since the last processed frame
  // millis(): elapsed time in milliseconds
    // interval limits how often the expensive K-means operation runs
    // processingInterval is 150 rn, so sketch processes at most about 6–7 frames per second, even if draw() runs faster
  if (cvReady && millis() - lastProcessedAt >= processingInterval) {
    segmentImage();
    lastProcessedAt = millis();
  }

  // draws the image on the canvas
  if (outImg) {
    image(outImg, 0, 0, w, h);
  } else {
    image(capture, 0, 0, w, h);
  }

  drawControls();
}

// draw the title, cluster count, and keyboard instructions over the video
// ** help of copilot for formatting and referencing my previous assignment 2 text style **
function drawControls() {
  push();
  textFont('Courier New');
  noStroke();

  fill(0, 180);
  rect(0, 0, width, 92);
  rect(0, height - 42, width, 42);

  fill(255);
  textStyle(BOLD);
  textSize(24);
  text('K-MEANS CLUSTERING', 24, 34);

  textStyle(NORMAL);
  textSize(13);
  fill(220);
  text('LIVE COLOR SEGMENTATION', 26, 56);

  stroke(255, 180);
  strokeWeight(1);
  line(24, 70, width - 24, 70);
  noStroke();

  textStyle(BOLD);
  textSize(16);
  fill(255);
  text(`CLUSTERS: ${k}`, 24, 88);

  textStyle(NORMAL);
  textSize(13);
  fill(255);
  text('CHANGE # OF CLUSTERS:', 24, height - 24);
  text('PRESS \'+\' OR \'=\' TO ADD  |  PRESS \'-\' TO REMOVE (MIN 2)', 24, height - 8);
  
  pop();
}

// image segmentation using K-means clustering
function segmentImage() {
  let src = new cv.Mat(h, w, cv.CV_8UC4);
  src.data.set(capture.pixels);

  // Convert RGBA to RGB
  let rgb = new cv.Mat();
  cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);

  // flattening pixels into data points - creates one big matrix of pixel samples
  let rows = rgb.rows;
  let cols = rgb.cols;
  let channels = rgb.channels();
  let sampleCount = rows * cols;

  // Flatten the image into N x 3 float matrix
  // each row is one pixel
  // each column is one color channel (R, G, B)
  // the whole image becomes a list of 3D points in color space
  let samples = new cv.Mat(sampleCount, channels, cv.CV_32F);
  // for each pixel, for each color channel, copy the color value into the sample matrix
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      for (let c = 0; c < channels; c++) {
        samples.floatPtr(y * cols + x)[c] = rgb.ucharPtr(y, x)[c];
      }
    }
  }

  // K-means clustering
  let labels = new cv.Mat();
  let centers = new cv.Mat();
  let criteria = new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, 10, 1.0);

  // samples = all image pixels as color data
  // k = number of clusters (default 3)
  // labels = tells which cluster each pixel belongs to
  // centers = the final representative color for each cluster
  // criteria = stop when change is small enough
  cv.kmeans(samples, k, labels, criteria, 3, cv.KMEANS_PP_CENTERS, centers);

  // Reconstruct clustered image
  // after k-means, we rebuild an image where each pixel becomes the average color of its cluster
  let clustered = new cv.Mat(rows, cols, rgb.type());
  for (let i = 0; i < sampleCount; i++) {
    let cluster_idx = labels.intAt(i, 0);
    let y = Math.floor(i / cols);
    let x = i % cols;
    for (let c = 0; c < channels; c++) {
      clustered.ucharPtr(y, x)[c] = centers.floatAt(cluster_idx, c);
    }
  }

  // Convert back to RGBA
  let dst = new cv.Mat();
  cv.cvtColor(clustered, dst, cv.COLOR_RGB2RGBA);

  // Convert to p5 Image
  outImg = createImage(cols, rows);
  outImg.loadPixels();
  outImg.pixels.set(dst.data);
  outImg.updatePixels();

  image(outImg, 0, 0, w, h);

  // Cleanup - frees memory used by OpenCV matrices and prevent memory leaks
  src.delete(); rgb.delete(); samples.delete();
  labels.delete(); centers.delete();
  clustered.delete(); dst.delete();
}

// change number of colors (clusters) with keyboard input "+" or "-" and re-run segmentation
function keyPressed() {
  if (key === '+' || key === '=') {
    k++;
    lastProcessedAt = 0;
  } else if (key === '-' && k > 2) {
    k--;
    lastProcessedAt = 0;
  }
}
