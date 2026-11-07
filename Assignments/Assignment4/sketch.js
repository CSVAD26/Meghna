// Meghna/Assignments/Assignment4/sketch.js
// this sketch visualizes cycling workouts as tracks with moving dots
// the track size represents distance, the dot speed represents distance/time, and the color represents calories burned
// the user can hover over a track to see the workout details in a tooltip
// the user can click the "REDO" button to reset the animation and spacebar to pause/play

let table;
let distance = [];
let labels = [];
let energy = [];
let duration = [];
let tooltipGraphics;
let isPlaying = false;
let animationTime = 0;
let lastFrameTime = 0;

// ** help of copilot for measurments **
const HEADER_HEIGHT = 166;
const MIN_CALORIES = 20;
const MIN_TRACK_RADIUS = 18;
const MAX_TRACK_RADIUS = 500;
const MAX_TRACK_RADIUS_RATIO = 0.44;
const TRACK_HEIGHT_RATIO = 0.48;
const PLOT_HEIGHT_RATIO = 0.7;
const MIN_PLOT_HEIGHT = 300;
const MAX_PLOT_HEIGHT = 520;
const TRACK_HIT_TOLERANCE = 8;
const MIN_LAP_DURATION = 5;
const MAX_LAP_DURATION = 30;
const REDO_BUTTON_WIDTH = 82;
const REDO_BUTTON_HEIGHT = 32;
const REDO_BUTTON_Y = 90;

// call preload() to load  CSV file before setup()
function preload() {
  //loading ensures data is ready before sketch starts using it
  // Make sure your CSV is in the same folder as the sketch
  table = loadTable('cycling_workouts.csv', 'csv', 'header');
}

// runs when sketch starts
function setup() {
  // calculate canvas dimensions then create canvas
  const canvasWidth = getCanvasWidth();
  createCanvas(canvasWidth, getCanvasHeight(canvasWidth));
  tooltipGraphics = createGraphics(width, height);
  textFont('Courier New');

  // Extract all workout values from the CSV into arrays
  // put date, distance, energy, and duration into arrays
  for (let r = 0; r < table.getRowCount(); r++) {
    labels.push(formatDate(table.getString(r, 'startDate')));
    distance.push(float(table.getString(r, 'totalDistance_miles')));
    energy.push(float(table.getString(r, 'totalEnergyBurned_cal')));
    duration.push(float(table.getString(r, 'duration_minutes')));
  }
}

// p5 calls draw() repeatedly to update the canvas
function draw() {
  const now = millis();
  // if the anim is playing, update anim time based on elapsed time since last frame
  if (isPlaying && lastFrameTime > 0) {
    animationTime += (now - lastFrameTime) / 1000; // convert milliseconds to seconds
  }
  lastFrameTime = now;

  // passes workout arrays to function that draws visualization
  drawCyclingTracks(distance, energy, duration, labels);
}

// draws the tracks as concentric ovals with moving dots, and tooltip for hovered track
function drawCyclingTracks(distances, energies, durations, labels) {
  background('#f4f6f8');
  drawHeader();
  tooltipGraphics.clear();

  // if no workouts, exit
  if (distances.length === 0) {
    return;
  }


  const centerX = width / 2;
  const centerY = HEADER_HEIGHT + getPlotHeight(width) / 2;
  const maxRadius = min(width * MAX_TRACK_RADIUS_RATIO, MAX_TRACK_RADIUS);
  // ranges and hover target (scale tracks by distance, color by calories, speed by distance/time)
  const minDistance = min(distances);
  const maxDistance = max(distances);
  const maxEnergy = max(energies);
  // velocity val for each workout: distance / duration (miles/min)
  const velocities = [];
  for (let i = 0; i < distances.length; i++) {
    velocities.push(distances[i] / durations[i]);
  }
  // range used to compare workout speeds
  const minVelocity = min(velocities);
  const maxVelocity = max(velocities);
  //check with track is closest to mouse for tooltip
  const hoveredIndex = getHoveredWorkout(centerX, centerY, maxRadius, minDistance, maxDistance, distances);

  // draw each track and its dot
  // creates ordered list of workout indexes, sorted from shortest distance to longest
  // drawing smaller ovals first helps keep them visible inside larger ovals
  const orderedIndexes = [];
  for (let i = 0; i < distances.length; i++) {
    orderedIndexes.push(i);
  }
  for (let i = 0; i < orderedIndexes.length; i++) {
    for (let j = i + 1; j < orderedIndexes.length; j++) {
      if (distances[orderedIndexes[j]] < distances[orderedIndexes[i]]) {
        const currentIndex = orderedIndexes[i];
        orderedIndexes[i] = orderedIndexes[j];
        orderedIndexes[j] = currentIndex;
      }
    }
  }
  // processes one workout index at a time
  for (const i of orderedIndexes) {
    const distanceScale = getScale(distances[i], minDistance, maxDistance);
    const radiusX = lerp(MIN_TRACK_RADIUS, maxRadius, distanceScale);
    const radiusY = radiusX * TRACK_HEIGHT_RATIO;
    const trackColor = calorieColor(getScale(energies[i], MIN_CALORIES, maxEnergy));
    const isHovered = i === hoveredIndex;

    // draw track as oval with border
    noFill();
    stroke(isHovered ? '#172b4d' : trackColor);
    strokeWeight(isHovered ? 4 : 2.5);
    ellipse(centerX, centerY, radiusX * 2, radiusY * 2);

    // calculates dot's moovement along track based on speed (distance/time) and elapsed anim time
    const velocityScale = getScale(velocities[i], minVelocity, maxVelocity);
    const lapDuration = lerp(MAX_LAP_DURATION, MIN_LAP_DURATION, velocityScale);
    const lapProgress = (animationTime / lapDuration) % 1;
    const angle = lapProgress * TWO_PI - HALF_PI;
    const dotX = centerX + cos(angle) * radiusX;
    const dotY = centerY + sin(angle) * radiusY;

    //ddraws dot with dark fill and white ouline 
    fill('#172b4d');
    stroke('#ffffff');
    strokeWeight(2);
    circle(dotX, dotY, 11);
  }

  // draw tooltop layer
  if (hoveredIndex !== null) {
    drawTooltip(labels[hoveredIndex], distances[hoveredIndex], energies[hoveredIndex], durations[hoveredIndex]);
  }

  image(tooltipGraphics, 0, 0);
}

// draw title, legend, playback status, and controls
// ** help of copilot for formatting and referencing my previous assignment 2 + 3 + project 1 text style **
function drawHeader() {
  push();
  textFont('Courier New');
  noStroke();
  textAlign(LEFT, BASELINE);

  textStyle(BOLD);
  textSize(26);
  fill('#172b4d');
  text('CYCLING WORKOUTS', 24, 48);

  textStyle(NORMAL);
  textSize(14);
  fill('#536575');
  const subtitle = 'TRACK SIZE: DISTANCE  |  DOT SPEED: DISTANCE / TIME';
  textSize(min(14, (width - 54) / textWidth(subtitle) * 14));
  text(subtitle, 27, 68);
  stroke('#172b4d');
  strokeWeight(1);
  line(24, 82, width - 24, 82);
  noStroke();

  textStyle(BOLD);
  textSize(12);
  fill('#394b59');
  text('CALORIES BURNED', 24, 101);

  const legendX = 24;
  const legendY = 108;
  const legendWidth = 180;
  const legendSteps = 60;
  for (let i = 0; i < legendSteps; i++) {
    fill(calorieColor(i / (legendSteps - 1)));
    rect(legendX + (legendWidth * i) / legendSteps, legendY, legendWidth / legendSteps + 1, 9);
  }

  textStyle(NORMAL);
  textSize(11);
  fill('#536575');
  textAlign(LEFT, TOP);
  text(`${MIN_CALORIES} cal`, legendX, 120);
  textAlign(RIGHT, TOP);
  text(`${getEnergyRange(energy).max.toFixed(0)} cal`, legendX + legendWidth, 120);

  const buttonX = width - REDO_BUTTON_WIDTH - 24;
  fill('#172b4d');
  rect(buttonX, REDO_BUTTON_Y, REDO_BUTTON_WIDTH, REDO_BUTTON_HEIGHT, 6);
  fill('#ffffff');
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  textSize(12);
  text('REDO', buttonX + REDO_BUTTON_WIDTH / 2, REDO_BUTTON_Y + REDO_BUTTON_HEIGHT / 2);

  textStyle(BOLD);
  textAlign(LEFT, TOP);
  textSize(12);
  const playbackStatus = isPlaying ? 'PLAYING' : 'PAUSED';
  fill(isPlaying ? '#25855a' : '#c0392b');
  text(playbackStatus, 24, 145);
  fill('#394b59');
  text(`  |  SPACE TO ${isPlaying ? 'PAUSE' : 'PLAY'}`, 24 + textWidth(playbackStatus), 145);
  pop();
}

// when user presses spacebar, toggle play/pause
function keyPressed() {
  if (key === ' ') {
    isPlaying = !isPlaying;
    return false;
  }
}

// when user clicks mouse, check if they clicked the "REDO" button
function mousePressed() {
  const buttonX = width - REDO_BUTTON_WIDTH - 24;
  const inRedoButton =
    mouseX >= buttonX &&
    mouseX <= buttonX + REDO_BUTTON_WIDTH &&
    mouseY >= REDO_BUTTON_Y &&
    mouseY <= REDO_BUTTON_Y + REDO_BUTTON_HEIGHT;

  if (inRedoButton) {
    animationTime = 0;
    isPlaying = false;
  }
}

// draws a tooltip with workout details when hovering over a track
function drawTooltip(label, workoutDistance, workoutEnergy, workoutDuration) {
  // Prepare tooltip content: date + distance, energy, duration
  const lines = [
    `${label}`,
    `Distance: ${nf(workoutDistance, 1, 1)} miles`,
    `Energy: ${round(workoutEnergy)} cal`,
    `Duration: ${nf(workoutDuration, 1, 2)} min`
  ];

  push();
  tooltipGraphics.colorMode(RGB);
  tooltipGraphics.textFont('Courier New');
  tooltipGraphics.textAlign(LEFT, TOP);
  tooltipGraphics.textSize(12);
  const padding = 8;
  // Compute tooltip width by longest line
  let tw = 0;
  for (let t of lines) { tw = max(tw, textWidth(t)); }
  let boxW = tw + padding * 2;
  let lineH = 16;
  let boxH = lines.length * lineH + padding * 2;
  let tipX = constrain(mouseX + 12, 0, width - boxW - 1);
  let tipY = constrain(mouseY - (boxH + 12), 0, height - boxH - 1);
  // Background and border
  tooltipGraphics.noStroke();
  tooltipGraphics.fill(0, 0, 0, 200);
  tooltipGraphics.rect(tipX, tipY, boxW, boxH, 6);
  // Text
  tooltipGraphics.fill(255);
  for (let li = 0; li < lines.length; li++) {
    tooltipGraphics.text(lines[li], tipX + padding, tipY + padding + li * lineH);
  }
  pop();
}

// estimates how many pixels the mouse is from oval’s edge
function distanceToTrack(centerX, centerY, radiusX, radiusY) {
  // mouse’s position relative to the oval’s center, scaled by the oval’s horizontal and vertical radii
  const normalizedX = (mouseX - centerX) / radiusX;
  const normalizedY = (mouseY - centerY) / radiusY;
  // measures the scaled distance from oval’s center to mouse
  const normalizedDistance = sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
  return abs(normalizedDistance - 1) * min(radiusX, radiusY);
}

// checks every workout’s track and returns index of closest one to mouse
function getHoveredWorkout(centerX, centerY, maxRadius, minDistance, maxDistance, distances) {
  let hoveredIndex = null;
  let closestTrackDistance = TRACK_HIT_TOLERANCE; // max distance at which mouse can be considered close enough to a track

  // examines each workout to access its distance and calculate its track size
  for (let i = 0; i < distances.length; i++) {
    const distanceScale = getScale(distances[i], minDistance, maxDistance);
    const radiusX = lerp(MIN_TRACK_RADIUS, maxRadius, distanceScale);
    const radiusY = radiusX * TRACK_HEIGHT_RATIO;
    const trackDistance = distanceToTrack(centerX, centerY, radiusX, radiusY);

    if (trackDistance < closestTrackDistance) {
      hoveredIndex = i;
      closestTrackDistance = trackDistance;
    }
  }
  return hoveredIndex;
}

// returns a scale value between 0 and 1 for a given value within a range
function getScale(value, minValue, maxValue) {
  if (maxValue === minValue) {
    return 0.5;
  }
  return constrain((value - minValue) / (maxValue - minValue), 0, 1);
}

// returns a color based on a scale value between 0 and 1, transitioning from low to middle to high
function calorieColor(scale) {
  const low = color('#38a6a5');
  const middle = color('#f4d35e');
  const high = color('#e76f51');
  return scale < 0.5
    ? lerpColor(low, middle, scale * 2)
    : lerpColor(middle, high, (scale - 0.5) * 2);
}

// returns min and max energy values for tooltip legend
function getEnergyRange(values) {
  if (values.length === 0) {
    return { min: MIN_CALORIES, max: MIN_CALORIES };
  }
  return {
    min: MIN_CALORIES,
    max: max(values)
  };
}

// returns width of canvas based on window width (max 320 pixels)
function getCanvasWidth() {
  return max(320, windowWidth);
}

// returns the height of the canvas based on the canvas width and a fixed header height
function getCanvasHeight(canvasWidth) {
  return HEADER_HEIGHT + getPlotHeight(canvasWidth) + 24;
}

// returns height of plot area based on canvas width, (constrained bw 300 and 520 pixels)
function getPlotHeight(canvasWidth) {
  return max(MIN_PLOT_HEIGHT, min(canvasWidth * PLOT_HEIGHT_RATIO, MAX_PLOT_HEIGHT));
}

// called when window is resized, adjusts canvas size and tooltip graphics
function windowResized() {
  const canvasWidth = getCanvasWidth();
  resizeCanvas(canvasWidth, getCanvasHeight(canvasWidth));
  tooltipGraphics.resizeCanvas(width, height);
}

// formats a date string from "YYYY-MM-DD HH:MM:SS -ZZZZ" to "MM/DD/YY"
function formatDate(datetimeStr) {
  // Split on space → ["2023-10-16", "14:08:33", "-0700"]
  let datePart = datetimeStr.split(" ")[0];
  
  // Split date part → ["2023", "10", "16"]
  let parts = datePart.split("-");
  let year = parts[0].slice(2); // get last two digits
  let month = parts[1];
  let day = parts[2];

  return `${month}/${day}/${year}`;
}
