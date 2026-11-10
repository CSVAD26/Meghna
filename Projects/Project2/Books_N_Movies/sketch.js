// Meghna/Projects/Project2/Books_N_Movies/sketch.js
// this sketch visualizes my Letterboxd film ratings and StoryGraph book ratings as a scatter plot of covers
// x = my rating, y = the public rating, and the dashed diagonal is "I agree with the crowd"
// full-color covers are things i rated, faded covers are things i haven't seen/read yet (placed where the model predicts i'd rate them)
// the user can switch between 6 views, filter by genre/mood/pace, hover a cover to enlarge it, scroll to zoom and drag to pan
// in the prediction views, the user can click a faded cover, type their own rating, and the model re-trains live
//
// data: data/viz_data.json (built by pipeline.ipynb) + images in data/images/

// ───────────────────────────── constants ─────────────────────────────
const FONT = 'Courier New';

const COLORS = {
  background: '#12100e',
  panel: '#191612',
  grid: '#2a251f',
  axis: '#6f6657',
  text: '#ece3d0',
  mute: '#948a78',
  movie: '#e0a23b',
  book: '#6bbfa8',
  warning: '#e2674a'
};

// the 6 views the user can toggle between (keys 1-6)
const VIEWS = [
  { label: 'FILMS', sub: 'my ratings', types: ['movie'], showPredictions: false },
  { label: 'BOOKS', sub: 'my ratings', types: ['book'], showPredictions: false },
  { label: 'FILMS + BOOKS', sub: 'my ratings', types: ['movie', 'book'], showPredictions: false },
  { label: 'FILMS', sub: '+ predicted', types: ['movie'], showPredictions: true },
  { label: 'BOOKS', sub: '+ predicted', types: ['book'], showPredictions: true },
  { label: 'ALL', sub: '+ predicted', types: ['movie', 'book'], showPredictions: true }
];

// ** help of copilot for numeric values of memeber variables **

// how saturated (1 = full color, 0 = grey) a cover is
const SATURATION = {
  rated: 0.85,
  ratedHover: 1.0,
  predicted: 0.16,
  predictedHover: 0.65
};

const STORAGE_KEY = 'films-books-user-ratings-v1';
const MODEL_TYPES = ['movie', 'book'];

// the x axis always shows 0 - 5.25 (so 0.25/0.5 - 5 stars have some breathing room)
const X_MIN = 0;
const X_MAX = 5.25;

const PLOT_LEFT = 64;
const PLOT_TOP = 138;
const PLOT_RIGHT_GAP = 28;
const PLOT_BOTTOM_GAP = 62;
const TAB_TOP = 66;
const TAB_HEIGHT = 40;
const FILTER_TOP = 112;
const MAX_CONCURRENT_IMAGE_LOADS = 12;
const MAX_IMAGE_RETRIES = 3;
const HOVER_GROWTH = 1.6; // hovered cover grows to 2.6x its normal size
const MAX_DRIFT_X = 3; // covers never drift more than 3 cover-widths from their true spot
const MAX_DRIFT_Y = 2.2; // ...or 2.2 cover-heights

// ───────────────────────────── global variables ─────────────────────────────
let data; // everything loaded from viz_data.json
let items = []; // every film and book
let itemsByType = { movie: [], book: [] };
let design = {}; // per type: how many features the model has, and which terms it uses
let userRatings = {}; // id -> rating the user typed in (saved in localStorage)

let viewIndex = 0;
let hoveredItem = null;
let selectedItem = null;
let filterTerm = ''; // ex: 'g:fantasy', empty = no filter

let layout = {}; // pixel positions of the plot, panel, etc (recomputed on resize)
let viewButtons = [];
let panelButtons = [];
let ratingInput;
let filterSelect;
let ratingInputState = { x: 0, y: 0, width: 0, show: false, forId: null };

// the part of the data the plot is currently showing (changes when zooming and panning)
let zoomWindow = { x0: X_MIN, x1: X_MAX, y0: 1.5, y1: 5 };
let plotYMin = 1.5;
let plotYMax = 5;
let dragState = null;

let settleFrames = 0; // how many more frames the covers should keep spreading apart
let changeMessage = { text: '', startTime: 0, isWarning: false };
let isReady = false;
let imagesLoaded = 0;
let imagesTotal = 0;
const imageQueue = [];

// ───────────────────────────── load + setup ─────────────────────────────
// call preload() to load the json file before setup()
function preload() {
  data = loadJSON('data/viz_data.json');
}

// runs when the sketch starts
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, window.devicePixelRatio || 1));
  textFont(FONT);

  items = data.items;

  // give every item the extra fields the sketch needs for drawing and animating
  for (const item of items) {
    itemsByType[item.type].push(item);

    item.x = 0; // where the cover is currently drawn
    item.y = 0;
    item.targetX = 0; // where the cover wants to be (its true rating position)
    item.targetY = 0;
    item.opacity = 0;
    item.targetOpacity = 0;
    item.hoverGrow = 0; // 0 = normal size, 1 = fully enlarged
    item.saturation = SATURATION.predicted;
    item.wasVisible = false;
    item.img = null;
    item.notebookPred = item.pred; // prediction from python, used to double check the javascript model

    if (item.image) {
      imageQueue.push(item);
    }
  }

  // start loading covers a few at a time
  imagesTotal = imageQueue.length;
  for (let i = 0; i < MAX_CONCURRENT_IMAGE_LOADS; i++) {
    loadNextImage();
  }

  loadSavedRatings();

  for (const type of MODEL_TYPES) {
    buildFeatures(type);
  }
  checkModelAgainstNotebook();
  for (const type of MODEL_TYPES) {
    refitModel(type, false);
  }

  // y axis goes from the lowest to the highest public rating (rounded to the nearest half star)
  const publicRatings = items
    .map(item => item.public_rating)
    .filter(rating => rating != null);
  plotYMin = floor(min(publicRatings) * 2) / 2;
  plotYMax = min(5, ceil(max(publicRatings) * 2) / 2);
  resetZoom();

  createControls();
  computeLayout();
  updateTargets();
  isReady = true;
}

// loads one cover from the queue, then calls itself when it finishes
// (loading all ~600 images at once overwhelms a simple local server, so we do a few at a time and retry failures)
function loadNextImage() {
  const item = imageQueue.shift();
  if (!item) {
    return;
  }

  function attempt(tryNumber) {
    loadImage(
      item.image,
      img => {
        item.img = img;
        imagesLoaded++;
        loadNextImage();
      },
      () => {
        if (tryNumber < MAX_IMAGE_RETRIES) {
          setTimeout(() => attempt(tryNumber + 1), 400 * (tryNumber + 1));
        } else {
          item.img = null; // draw a placeholder instead
          imagesLoaded++;
          loadNextImage();
        }
      }
    );
  }
  attempt(0);
}

// p5 event function that runs when the browser window changes size
function windowResized() {
  const oldPlot = { x: layout.plot.x, y: layout.plot.y, w: layout.plot.w, h: layout.plot.h };
  resizeCanvas(windowWidth, windowHeight);
  computeLayout();

  // keep each cover at the same spot in the plot (not the same pixel)
  for (const item of items) {
    item.x = layout.plot.x + ((item.x - oldPlot.x) / oldPlot.w) * layout.plot.w;
    item.y = layout.plot.y + ((item.y - oldPlot.y) / oldPlot.h) * layout.plot.h;
  }
  updateTargets();
  settleFrames = 60;
}

// ───────────────────────────── the model (javascript twin of the notebook's ridge regression) ─────────────────────────────
// each item becomes a row of numbers (features): [public rating as a z-score, then 1 or 0 for each genre/theme/mood/etc]
// only terms that show up at least min_df times are kept
function buildFeatures(type) {
  const config = data.config[type];
  const typeItems = itemsByType[type];

  // count how many items each term appears in
  const termCounts = {};
  for (const item of typeItems) {
    for (const term of new Set(item.terms)) {
      termCounts[term] = (termCounts[term] || 0) + 1;
    }
  }

  const vocab = Object.keys(termCounts)
    .filter(term => termCounts[term] >= config.min_df)
    .sort();

  // feature 0 is the public rating, so terms start at index 1
  const termIndex = new Map();
  vocab.forEach((term, i) => termIndex.set(term, i + 1));
  const numFeatures = vocab.length + 1;

  for (const item of typeItems) {
    const features = new Float64Array(numFeatures);

    // if the public rating is missing, use the average
    const publicRating = item.public_rating == null ? config.pub_mean : item.public_rating;
    features[0] = ((publicRating - config.pub_mean) / config.pub_std) * config.num_scale;

    for (const term of new Set(item.terms)) {
      if (termIndex.has(term)) {
        features[termIndex.get(term)] = 1;
      }
    }
    item.features = features;
  }

  design[type] = { numFeatures, vocab };
}

// the rating from the data, or the one the user typed in (or null if neither)
function currentRating(item) {
  if (item.rating != null) {
    return item.rating;
  }
  if (userRatings[item.id] != null) {
    return userRatings[item.id];
  }
  return null;
}

function isRated(item) {
  return currentRating(item) != null;
}

// trains ridge regression on every rated item, then predicts a rating for every unrated item
// ridge = linear regression + a penalty (alpha) on large coefficients, which keeps the model from overfitting
// this uses the "dual" form of ridge, which is faster when there are fewer rated items than features:
//    (Xc * Xc^T + alpha * I) * u = y - mean(y)      then      weights = Xc^T * u
function refitModel(type, announce) {
  const config = data.config[type];
  const typeItems = itemsByType[type];
  const numFeatures = design[type].numFeatures;

  const ratedItems = typeItems.filter(isRated);
  const n = ratedItems.length;
  if (n < 3) {
    return; // not enough data to fit
  }

  const ratings = ratedItems.map(currentRating);
  const meanRating = ratings.reduce((sum, r) => sum + r, 0) / n;

  // center the features (subtract the mean of each column)
  const featureMeans = new Float64Array(numFeatures);
  for (const item of ratedItems) {
    for (let k = 0; k < numFeatures; k++) {
      featureMeans[k] += item.features[k] / n;
    }
  }
  const centered = ratedItems.map(item => {
    const row = new Float64Array(numFeatures);
    for (let k = 0; k < numFeatures; k++) {
      row[k] = item.features[k] - featureMeans[k];
    }
    return row;
  });

  // build Xc * Xc^T + alpha * I (the matrix is symmetric so we only compute half and mirror it)
  const gram = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let dot = 0;
      for (let k = 0; k < numFeatures; k++) {
        dot += centered[i][k] * centered[j][k];
      }
      if (i === j) {
        dot += config.alpha;
      }
      gram[i][j] = dot;
      gram[j][i] = dot;
    }
  }

  const u = choleskySolve(gram, ratings.map(r => r - meanRating));

  // weights = Xc^T * u
  const weights = new Float64Array(numFeatures);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < numFeatures; k++) {
      weights[k] += u[i] * centered[i][k];
    }
  }

  // predict every unrated item (and keep track of how much the predictions moved for the change message)
  let numMoved = 0;
  let totalShift = 0;
  let numCompared = 0;
  for (const item of typeItems) {
    if (isRated(item)) {
      item.pred = null;
      continue;
    }

    let prediction = meanRating;
    for (let k = 0; k < numFeatures; k++) {
      prediction += (item.features[k] - featureMeans[k]) * weights[k];
    }
    prediction = constrain(prediction, 0.5, 5);

    if (item.pred != null) {
      const change = abs(prediction - item.pred);
      totalShift += change;
      numCompared++;
      if (change > 0.1) {
        numMoved++;
      }
    }
    item.pred = prediction;
  }

  design[type].numTrained = n;
  if (announce) {
    const word = type === 'movie' ? 'films' : 'books';
    const averageShift = (totalShift / max(1, numCompared)).toFixed(2);
    setChangeMessage(`re-trained on ${n} ${word} · ${numMoved} predictions moved >0.1★ (avg shift ${averageShift}★)`);
  }
}

// solves A * x = b where A is symmetric positive definite, using a cholesky decomposition (A = L * L^T)
// matrix solving for refitModel. It splits A into a lower triangle, then solves forward and backward.
// using Cholesky for linear algebra to solve ridge equations
function choleskySolve(A, b) {
  const n = b.length;

  // step 1: find the lower triangular matrix lower such that A = lower * lower^T
  const lower = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i][j];
      for (let k = 0; k < j; k++) {
        sum -= lower[i][k] * lower[j][k];
      }
      if (i === j) {
        lower[i][j] = sqrt(max(sum, 1e-12));
      } else {
        lower[i][j] = sum / lower[j][j];
      }
    }
  }

  // step 2: forward substitution, solve lower * z = b
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) {
      sum -= lower[i][k] * z[k];
    }
    z[i] = sum / lower[i][i];
  }

  // step 3: backward substitution, solve lower^T * x = z
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = z[i];
    for (let k = i + 1; k < n; k++) {
      sum -= lower[k][i] * x[k];
    }
    x[i] = sum / lower[i][i];
  }
  return x;
}

// the notebook saved its own predictions in the json
// before the user types anything, the javascript model should match them (checks that both models are the same)
function checkModelAgainstNotebook() {
  const savedUserRatings = userRatings;
  userRatings = {};

  for (const type of MODEL_TYPES) {
    refitModel(type, false);
  }

  let largestDifference = 0;
  for (const item of items) {
    if (item.notebookPred != null && item.pred != null) {
      largestDifference = max(largestDifference, abs(item.notebookPred - item.pred));
    }
  }
  window.PARITY_MAX_DIFF = largestDifference;
  console.log(`JS vs Python predictions: max difference ${largestDifference.toExponential(2)}`);

  userRatings = savedUserRatings;
}

// ───────────────────────────── controls (rating input + filter dropdown) ─────────────────────────────
function createControls() {
  // text box where the user types their own rating
  ratingInput = createInput('');
  ratingInput.attribute('placeholder', 'rating, then Enter');
  ratingInput.attribute('inputmode', 'decimal');
  ratingInput.id('rating-input');
  ratingInput.hide();
  ratingInput.elt.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      commitRating();
      event.preventDefault();
    }
    if (event.key === 'Escape') {
      ratingInput.elt.blur();
      selectedItem = null;
    }
  });

  // dropdown to filter by genre / mood / pace
  filterSelect = createSelect();
  filterSelect.id('filter-select');
  filterSelect.changed(() => {
    filterTerm = filterSelect.value();
    selectedItem = null;
  });
  rebuildFilterOptions();
}

// the filter choices belong to the current view:
//   a films-only view offers film genres
//   a books-only view offers book genres, moods, and pace
//   a combined view offers only the genres that films and books both have
function rebuildFilterOptions() {
  const view = VIEWS[viewIndex];
  const counts = {};
  const countsByType = { movie: {}, book: {} };

  for (const item of items) {
    const isInThisView = view.types.includes(item.type) && (isRated(item) || view.showPredictions);
    if (!isInThisView) {
      continue;
    }
    for (const term of new Set(item.terms)) {
      // only genres (g:), moods (m:) and pace (p:) can be filtered on
      if (!/^[gmp]:/.test(term)) {
        continue;
      }
      counts[term] = (counts[term] || 0) + 1;
      countsByType[item.type][term] = (countsByType[item.type][term] || 0) + 1;
    }
  }

  // in a combined view, a term is only allowed if it's a genre that both films and books have
  const isSingleType = view.types.length === 1;
  function isAllowed(term) {
    if (isSingleType) {
      return true;
    }
    const inBoth = countsByType.movie[term] > 0 && countsByType.book[term] > 0;
    return inBoth && term.startsWith('g:');
  }
  const minCount = isSingleType ? 4 : 6;

  // clear the old options, then add the new ones (grouped as genre, mood, pace and sorted by how common they are)
  filterSelect.elt.innerHTML = '';
  filterSelect.option('everything', '');
  const groups = [['g:', 'genre'], ['m:', 'mood'], ['p:', 'pace']];
  for (const [prefix, name] of groups) {
    const terms = Object.keys(counts)
      .filter(term => term.startsWith(prefix) && isAllowed(term) && counts[term] >= minCount)
      .sort((a, b) => counts[b] - counts[a]);
    for (const term of terms) {
      filterSelect.option(`${name}: ${term.slice(2)} (${counts[term]})`, term);
    }
  }

  // if the current filter isn't offered in this view anymore, clear it
  const optionValues = [...filterSelect.elt.options].map(option => option.value);
  if (!optionValues.includes(filterTerm)) {
    filterTerm = '';
  }
  filterSelect.value(filterTerm);
}

// turns what the user typed into a valid rating (rounded to the step), or null if it isn't valid
function parseTypedRating(text, item) {
  const value = parseFloat(String(text).replace(',', '.'));
  const step = data.config[item.type].step; // films go in half stars, books in quarter stars
  if (!isFinite(value) || value < step || value > 5) {
    return null;
  }
  return round(value / step) * step;
}

// called when the user presses Enter in the rating box
function commitRating() {
  if (!selectedItem || selectedItem.rating != null) {
    return;
  }

  const rating = parseTypedRating(ratingInput.value(), selectedItem);
  if (rating == null) {
    const step = data.config[selectedItem.type].step;
    setChangeMessage(`enter a rating between ${step} and 5`, true);
    return;
  }

  userRatings[selectedItem.id] = rating;
  saveRatings();
  refitModel(selectedItem.type, true);
  updateTargets();
  settleFrames = 140;
  ratingInput.elt.blur();
}

// removes a rating the user typed in, so the item goes back to being predicted
function clearRating(item) {
  delete userRatings[item.id];
  saveRatings();
  refitModel(item.type, true);
  updateTargets();
  settleFrames = 140;
}

// removes every rating the user typed in
function resetAllRatings() {
  const typesChanged = new Set();
  for (const id of Object.keys(userRatings)) {
    typesChanged.add(items.find(item => item.id === id).type);
  }

  userRatings = {};
  saveRatings();
  for (const type of typesChanged) {
    refitModel(type, false);
  }
  setChangeMessage('cleared my entered ratings · predictions restored');
  updateTargets();
  settleFrames = 140;
}

// ratings the user typed in are remembered in the browser (localStorage) between visits
function loadSavedRatings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const saved = JSON.parse(raw);
    const unratedIds = new Set(items.filter(item => item.rating == null).map(item => item.id));
    for (const id of Object.keys(saved)) {
      if (unratedIds.has(id)) {
        userRatings[id] = saved[id];
      }
    }
  } catch (error) {
    // storage isn't available, which is fine, we just won't remember ratings
  }
}

function saveRatings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userRatings));
  } catch (error) {
    // storage isn't available, which is fine
  }
}

function setChangeMessage(message, isWarning) {
  changeMessage = { text: message, startTime: millis(), isWarning: !!isWarning };
}

// ───────────────────────────── layout + zoom ─────────────────────────────
// figures out where the plot, side panel and view tabs go based on the window size
function computeLayout() {
  const panelWidth = constrain(width * 0.27, 270, 350);
  layout.panel = { x: width - panelWidth, y: 0, w: panelWidth, h: height };
  layout.plot = {
    x: PLOT_LEFT,
    y: PLOT_TOP,
    w: width - panelWidth - PLOT_LEFT - PLOT_RIGHT_GAP,
    h: height - PLOT_TOP - PLOT_BOTTOM_GAP
  };

  // cover size depends on the plot width (and grows a bit when zoomed in, see animateItems)
  layout.baseCoverWidth = constrain(layout.plot.w / 46, 13, 22);
  layout.coverWidth = layout.baseCoverWidth;
  layout.coverHeight = layout.coverWidth * 1.5; // book/movie covers are 2:3

  // the 6 view tabs share the width of the plot evenly
  const tabWidth = layout.plot.w / VIEWS.length;
  viewButtons = VIEWS.map((view, i) => ({
    x: layout.plot.x + i * tabWidth,
    y: TAB_TOP,
    w: tabWidth - 6,
    h: TAB_HEIGHT,
    index: i
  }));
}

// converts a rating to a pixel position (taking the zoom window into account)
function xOf(rating) {
  const fraction = (rating - zoomWindow.x0) / (zoomWindow.x1 - zoomWindow.x0);
  return layout.plot.x + fraction * layout.plot.w;
}

function yOf(rating) {
  const fraction = (rating - zoomWindow.y0) / (zoomWindow.y1 - zoomWindow.y0);
  return layout.plot.y + layout.plot.h - fraction * layout.plot.h;
}

// 1 = fully zoomed out, 2 = showing half of the x axis, etc
function zoomLevel() {
  return (X_MAX - X_MIN) / (zoomWindow.x1 - zoomWindow.x0);
}

function resetZoom() {
  zoomWindow = { x0: X_MIN, x1: X_MAX, y0: plotYMin, y1: plotYMax };
  if (layout.plot) {
    updateTargets();
    settleFrames = 120;
  }
}

// zooms in/out around a point on the screen, so the data under the mouse stays under the mouse
function zoomAt(mouseXPos, mouseYPos, factor) {
  const plot = layout.plot;

  // which rating is under the mouse right now?
  const fractionX = (mouseXPos - plot.x) / plot.w;
  const fractionY = (plot.y + plot.h - mouseYPos) / plot.h;
  const ratingX = zoomWindow.x0 + fractionX * (zoomWindow.x1 - zoomWindow.x0);
  const ratingY = zoomWindow.y0 + fractionY * (zoomWindow.y1 - zoomWindow.y0);

  // new window size (can't zoom out past the full plot, or in past 0.6 stars wide)
  const fullHeight = plotYMax - plotYMin;
  let newWidth = (zoomWindow.x1 - zoomWindow.x0) / factor;
  let newHeight = (zoomWindow.y1 - zoomWindow.y0) / factor;
  newWidth = constrain(newWidth, 0.6, X_MAX - X_MIN);
  newHeight = constrain(newHeight, (0.6 * fullHeight) / (X_MAX - X_MIN), fullHeight);

  zoomWindow = {
    x0: ratingX - fractionX * newWidth,
    x1: ratingX + (1 - fractionX) * newWidth,
    y0: ratingY - fractionY * newHeight,
    y1: ratingY + (1 - fractionY) * newHeight
  };
  keepWindowInBounds();
  updateTargets();
  settleFrames = 90;
}

// stops the user from panning past the edges of the data
function keepWindowInBounds() {
  const windowWidthInStars = zoomWindow.x1 - zoomWindow.x0;
  const windowHeightInStars = zoomWindow.y1 - zoomWindow.y0;

  if (zoomWindow.x0 < X_MIN) {
    zoomWindow.x0 = X_MIN;
    zoomWindow.x1 = X_MIN + windowWidthInStars;
  }
  if (zoomWindow.x1 > X_MAX) {
    zoomWindow.x1 = X_MAX;
    zoomWindow.x0 = X_MAX - windowWidthInStars;
  }
  if (zoomWindow.y0 < plotYMin) {
    zoomWindow.y0 = plotYMin;
    zoomWindow.y1 = plotYMin + windowHeightInStars;
  }
  if (zoomWindow.y1 > plotYMax) {
    zoomWindow.y1 = plotYMax;
    zoomWindow.y0 = plotYMax - windowHeightInStars;
  }
}

// works out where every cover wants to sit (my rating or predicted rating on x, public rating on y)
function updateTargets() {
  for (const item of items) {
    const myRating = isRated(item) ? currentRating(item) : item.pred;
    const publicRating = item.public_rating == null ? data.config[item.type].pub_mean : item.public_rating;
    item.targetX = xOf(myRating);
    item.targetY = yOf(publicRating);
  }
}

// ───────────────────────────── view logic + animation ─────────────────────────────
// is this item shown in the current view?
function isInView(item) {
  const view = VIEWS[viewIndex];
  return view.types.includes(item.type) && (isRated(item) || view.showPredictions);
}

// does this item match the dropdown filter? (no filter = everything matches)
function passesFilter(item) {
  return !filterTerm || item.terms.includes(filterTerm);
}

function setView(index) {
  viewIndex = index;
  selectedItem = null;
  hoveredItem = null;
  rebuildFilterOptions();
  updateTargets();
  settleFrames = 140;
}

// turns a string into a repeatable number between 0 and 1 (so each cover gets the same "random" jitter every time)
function hashToFraction(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

// moves everything a little closer to where it should be each frame (fading, growing, saturating, spreading apart)
function animateItems() {
  // covers get bigger as you zoom in
  layout.coverWidth = layout.baseCoverWidth * min(1.9, 1 + 0.32 * log(zoomLevel()) / log(2));
  layout.coverHeight = layout.coverWidth * 1.5;

  for (const item of items) {
    const visible = isInView(item);
    const matchesFilter = passesFilter(item);

    // fully visible, dimmed (filtered out), or hidden
    if (visible && matchesFilter) {
      item.targetOpacity = 1;
    } else if (visible) {
      item.targetOpacity = 0.14;
    } else {
      item.targetOpacity = 0;
    }

    // when a cover first appears, start it near its spot with a little jitter so they spread out nicely
    if (visible && !item.wasVisible) {
      item.x = item.targetX + (hashToFraction(item.id) - 0.5) * layout.coverWidth;
      item.y = item.targetY + (hashToFraction(item.id + 'y') - 0.5) * layout.coverHeight;
    }
    item.wasVisible = visible;

    // ease opacity, size, and saturation toward their targets
    item.opacity += (item.targetOpacity - item.opacity) * 0.16;
    if (item.opacity < 0.01 && item.targetOpacity === 0) {
      item.opacity = 0;
    }

    const isHovered = item === hoveredItem;
    item.hoverGrow += ((isHovered ? 1 : 0) - item.hoverGrow) * 0.25;

    let targetSaturation;
    if (isRated(item)) {
      targetSaturation = isHovered ? SATURATION.ratedHover : SATURATION.rated;
    } else {
      targetSaturation = isHovered ? SATURATION.predictedHover : SATURATION.predicted;
    }
    item.saturation += (targetSaturation - item.saturation) * 0.2;
  }

  // keep spreading covers apart for a while after something changes
  if (settleFrames > 0) {
    for (let i = 0; i < 4; i++) {
      spreadCovers();
    }
    settleFrames--;
  }
}

// pushes overlapping covers apart, while pulling each one back toward its true (rating, public rating) spot
function spreadCovers() {
  const visibleItems = items
    .filter(item => item.targetOpacity > 0)
    .sort((a, b) => a.x - b.x);
  const minGapX = layout.coverWidth + 1;
  const minGapY = layout.coverHeight + 1;

  // look at each pair of covers that are close enough to overlap
  for (let i = 0; i < visibleItems.length; i++) {
    const first = visibleItems[i];

    for (let j = i + 1; j < visibleItems.length; j++) {
      const second = visibleItems[j];
      const dx = second.x - first.x;
      if (dx >= minGapX) {
        break; // list is sorted by x, so nothing after this can overlap either
      }
      const dy = second.y - first.y;
      if (abs(dy) >= minGapY) {
        continue;
      }

      // push them apart along whichever direction has less overlap
      const overlapX = minGapX - dx;
      const overlapY = minGapY - abs(dy);
      if (overlapX < overlapY) {
        const push = overlapX * 0.2;
        first.x -= push;
        second.x += push;
      } else {
        // if they're exactly on top of each other, use the ids to decide who goes up
        let direction = Math.sign(dy);
        if (dy === 0) {
          direction = first.id < second.id ? 1 : -1;
        }
        const push = overlapY * 0.2;
        first.y -= direction * push;
        second.y += direction * push;
      }
    }
  }

  // pull each cover back toward its true spot, and never let it drift too far away
  const maxDriftX = layout.coverWidth * MAX_DRIFT_X;
  const maxDriftY = layout.coverHeight * MAX_DRIFT_Y;
  for (const item of visibleItems) {
    item.x += (item.targetX - item.x) * 0.06;
    item.y += (item.targetY - item.y) * 0.06;
    item.x = constrain(item.x, item.targetX - maxDriftX, item.targetX + maxDriftX);
    item.y = constrain(item.y, item.targetY - maxDriftY, item.targetY + maxDriftY);
  }
}

// is the mouse inside this item's cover (scaled by `scale`)?
function isMouseOverCover(item, scale) {
  const halfWidth = (layout.coverWidth * scale) / 2;
  const halfHeight = (layout.coverHeight * scale) / 2;
  return abs(mouseX - item.x) <= halfWidth && abs(mouseY - item.y) <= halfHeight;
}

// returns the cover the mouse is over (or null)
function findHoveredItem() {
  const plot = layout.plot;
  const isNearPlot =
    mouseX >= plot.x - 20 &&
    mouseX <= plot.x + plot.w + 20 &&
    mouseY >= plot.y - 20 &&
    mouseY <= plot.y + plot.h + 20;
  if (!isNearPlot) {
    return null;
  }

  // sticky hover: if we're already hovering a cover, stay on it while the mouse is over its enlarged version
  if (hoveredItem && hoveredItem.targetOpacity === 1) {
    const enlargedScale = 1 + HOVER_GROWTH * hoveredItem.hoverGrow;
    if (isMouseOverCover(hoveredItem, enlargedScale)) {
      return hoveredItem;
    }
  }

  // otherwise pick the closest visible cover under the mouse
  let closestItem = null;
  let closestDistance = Infinity;
  for (const item of items) {
    if (item.targetOpacity !== 1 || item.opacity < 0.5) {
      continue;
    }
    if (isMouseOverCover(item, 1)) {
      const distanceToMouse = dist(mouseX, mouseY, item.x, item.y);
      if (distanceToMouse < closestDistance) {
        closestDistance = distanceToMouse;
        closestItem = item;
      }
    }
  }
  return closestItem;
}

// ───────────────────────────── draw ─────────────────────────────
// p5 calls draw() repeatedly to update the canvas
function draw() {
  background(COLORS.background);
  strokeWeight(1);

  if (!isReady) {
    fill(COLORS.mute);
    textAlign(CENTER, CENTER);
    textSize(14);
    text('loading…', width / 2, height / 2);
    return;
  }

  hoveredItem = findHoveredItem();
  animateItems();
  drawHeader();
  drawAxes();
  drawItems();
  drawPanel();
  drawChangeMessage();
  positionControls();

  cursor(hoveredItem || isMouseOverButton() ? 'pointer' : 'default');
}

// draws the title, the "loading covers" counter, and the 6 view tabs
function drawHeader() {
  noStroke();
  fill(COLORS.text);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(21);
  text('MY FILMS & BOOKS LOG', layout.plot.x, 18);

  textStyle(NORMAL);
  textSize(11.5);
  fill(COLORS.mute);
  if (imagesLoaded < imagesTotal) {
    textAlign(RIGHT, TOP);
    text(`loading covers ${imagesLoaded}/${imagesTotal}`, layout.plot.x + layout.plot.w, 18);
  }

  for (const button of viewButtons) {
    const isSelected = button.index === viewIndex;
    const isHovered = isMouseInRect(button);
    const view = VIEWS[button.index];

    // tab box
    if (isSelected) {
      stroke(COLORS.text);
    } else if (isHovered) {
      stroke(COLORS.mute);
    } else {
      stroke(COLORS.grid);
    }
    strokeWeight(1);
    fill(isSelected ? COLORS.text : COLORS.background);
    rect(button.x, button.y, button.w, button.h, 3);

    // tab label (ex: "1 FILMS") and sublabel (ex: "my ratings")
    noStroke();
    textAlign(CENTER, CENTER);
    fill(isSelected ? COLORS.background : COLORS.text);
    textStyle(BOLD);
    textSize(constrain(button.w / 12, 9, 12.5));
    text(`${button.index + 1} ${view.label}`, button.x + button.w / 2, button.y + 14);

    textStyle(NORMAL);
    fill(isSelected ? '#3a342b' : COLORS.mute);
    textSize(constrain(button.w / 13, 8.5, 11));
    text(view.sub, button.x + button.w / 2, button.y + 28);
  }
}

function isMouseInRect(rectangle) {
  return (
    mouseX > rectangle.x &&
    mouseX < rectangle.x + rectangle.w &&
    mouseY > rectangle.y &&
    mouseY < rectangle.y + rectangle.h
  );
}

function isMouseOverButton() {
  return viewButtons.some(isMouseInRect) || panelButtons.some(isMouseInRect);
}

// picks a gap between gridlines that is at least 38 pixels wide (so tick labels don't overlap)
function tickStep(pixelsPerUnit, possibleSteps) {
  for (const step of possibleSteps) {
    if (step * pixelsPerUnit >= 38) {
      return step;
    }
  }
  return possibleSteps[possibleSteps.length - 1];
}

// is this rating a whole number (1, 2, 3...)?
function isWholeNumber(rating) {
  return abs(rating - round(rating)) < 1e-6;
}

// draws the gridlines, the dashed "agree with the crowd" diagonal, the tick labels, and the axis titles
function drawAxes() {
  const plot = layout.plot;
  const stepX = tickStep(plot.w / (zoomWindow.x1 - zoomWindow.x0), [0.5, 0.25]);
  const stepY = tickStep(plot.h / (zoomWindow.y1 - zoomWindow.y0), [0.5, 0.25, 0.1]);
  const firstX = ceil(zoomWindow.x0 / stepX) * stepX;
  const firstY = ceil(zoomWindow.y0 / stepY) * stepY;

  // gridlines and diagonal are clipped to the plot so they don't spill out when zoomed
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(plot.x, plot.y, plot.w, plot.h);
  drawingContext.clip();

  stroke(COLORS.grid);
  strokeWeight(1);
  for (let rating = firstX; rating <= zoomWindow.x1 + 1e-6; rating += stepX) {
    line(xOf(rating), plot.y, xOf(rating), plot.y + plot.h);
  }
  for (let rating = firstY; rating <= zoomWindow.y1 + 1e-6; rating += stepY) {
    line(plot.x, yOf(rating), plot.x + plot.w, yOf(rating));
  }

  // dashed diagonal where my rating = public rating
  const diagonalStart = max(zoomWindow.x0, zoomWindow.y0);
  const diagonalEnd = min(zoomWindow.x1, zoomWindow.y1);
  if (diagonalEnd > diagonalStart) {
    drawingContext.setLineDash([5, 5]);
    stroke(COLORS.axis);
    line(xOf(diagonalStart), yOf(diagonalStart), xOf(diagonalEnd), yOf(diagonalEnd));
    drawingContext.setLineDash([]);
  }
  drawingContext.restore();

  // x axis tick labels (whole numbers get a star)
  noStroke();
  textSize(10.5);
  textAlign(CENTER, TOP);
  for (let rating = firstX; rating <= zoomWindow.x1 + 1e-6; rating += stepX) {
    if (isWholeNumber(rating)) {
      fill(COLORS.text);
      text(round(rating) + '★', xOf(rating), plot.y + plot.h + 8);
    } else {
      fill(COLORS.mute);
      text(rating.toFixed(2).replace(/0$/, ''), xOf(rating), plot.y + plot.h + 8);
    }
  }

  // y axis tick labels
  textAlign(RIGHT, CENTER);
  for (let rating = firstY; rating <= zoomWindow.y1 + 1e-6; rating += stepY) {
    if (isWholeNumber(rating)) {
      fill(COLORS.text);
      text(round(rating) + '★', plot.x - 8, yOf(rating));
    } else {
      fill(COLORS.mute);
      const label = stepY < 0.5 ? rating.toFixed(2).replace(/0$/, '') : rating.toFixed(1);
      text(label, plot.x - 8, yOf(rating));
    }
  }

  // labels for the two sides of the diagonal
  fill(COLORS.mute);
  textSize(10.5);
  textAlign(RIGHT, BOTTOM);
  text('i rate it higher than the crowd', plot.x + plot.w - 6, plot.y + plot.h - 6);
  textAlign(LEFT, TOP);
  text('the crowd rates it higher than i do', plot.x + 6, plot.y + 6);

  // axis titles
  fill(COLORS.text);
  textSize(11.5);
  textAlign(CENTER, TOP);
  text('MY RATING', plot.x + plot.w / 2, plot.y + plot.h + 30);
  push();
  translate(22, plot.y + plot.h / 2);
  rotate(-HALF_PI);
  textAlign(CENTER, TOP);
  text('PUBLIC RATING', 0, 0);
  pop();

  // zoom reminder (only shows once zoomed in)
  if (zoomLevel() > 1.01) {
    fill(COLORS.mute);
    textAlign(RIGHT, TOP);
    textSize(10.5);
    text(`zoom ×${zoomLevel().toFixed(1)} · drag to pan · double-click to reset`, plot.x + plot.w, 122);
  }
}

// draws one cover (or a lettered placeholder if there's no image) with a given saturation and opacity
function drawCover(item, centerX, centerY, w, h, saturation, opacity) {
  const ctx = drawingContext;
  const left = centerX - w / 2;
  const top = centerY - h / 2;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.imageSmoothingQuality = 'high';

  if (item.img && item.img.width > 1) {
    ctx.drawImage(item.img.canvas, left, top, w, h);
  } else {
    // placeholder: a colored box with the title's first letter
    ctx.fillStyle = item.type === 'movie' ? '#4a3a1c' : '#1f4238';
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = '#ece3d0';
    ctx.font = `bold ${max(8, w * 0.42)}px "${FONT}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.title.charAt(0).toUpperCase(), centerX, centerY);
  }

  // desaturate by drawing a grey box on top with the 'saturation' blend mode
  // the more grey is drawn, the less color is left
  if (saturation < 1) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = opacity * (1 - saturation);
    ctx.fillStyle = '#808080';
    ctx.fillRect(left, top, w, h);
  }
  ctx.restore();
}

// draws every visible cover, with the hovered/selected one on top
function drawItems() {
  // rated covers are drawn on top of predicted ones, and covers lower on the plot are drawn on top of higher ones
  const drawOrder = items
    .filter(item => item.opacity > 0.01)
    .sort((a, b) => (isRated(a) - isRated(b)) || (a.y - b.y));
  const topItem = hoveredItem || selectedItem;
  const plot = layout.plot;

  // dotted guide lines from the hovered cover's true spot to both axes
  if (hoveredItem) {
    const color = hoveredItem.type === 'movie' ? COLORS.movie : COLORS.book;
    stroke(color);
    strokeWeight(1);
    drawingContext.setLineDash([2, 4]);
    line(hoveredItem.targetX, hoveredItem.targetY, hoveredItem.targetX, plot.y + plot.h);
    line(plot.x, hoveredItem.targetY, hoveredItem.targetX, hoveredItem.targetY);
    drawingContext.setLineDash([]);
    noStroke();
    fill(color);
    circle(hoveredItem.targetX, hoveredItem.targetY, 4);
  }

  // covers are clipped to the plot
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(plot.x, plot.y, plot.w, plot.h);
  drawingContext.clip();
  for (const item of drawOrder) {
    if (item === topItem) {
      continue;
    }
    const isOffscreen =
      item.x < plot.x - layout.coverWidth ||
      item.x > plot.x + plot.w + layout.coverWidth ||
      item.y < plot.y - layout.coverHeight ||
      item.y > plot.y + plot.h + layout.coverHeight;
    if (isOffscreen) {
      continue;
    }
    drawOneItem(item);
  }
  if (selectedItem && selectedItem !== hoveredItem && selectedItem.opacity > 0.01) {
    drawOneItem(selectedItem);
  }
  drawingContext.restore();

  // the hovered cover is drawn last and isn't clipped, so its enlarged version can stick out a little
  if (hoveredItem) {
    drawOneItem(hoveredItem);
  }
}

// draws one cover with its colored bottom bar, outline (if hovered/selected), and rating chip (if hovered)
function drawOneItem(item) {
  const scale = 1 + HOVER_GROWTH * item.hoverGrow;
  const w = layout.coverWidth * scale;
  const h = layout.coverHeight * scale;
  const plot = layout.plot;
  const isHovered = item === hoveredItem;
  const color = item.type === 'movie' ? COLORS.movie : COLORS.book;

  // an enlarged cover is kept inside the plot (with room underneath for the rating chip)
  let centerX = item.x;
  let centerY = item.y;
  if (isHovered) {
    centerX = constrain(item.x, plot.x + w / 2, plot.x + plot.w - w / 2);
    centerY = constrain(item.y, plot.y + h / 2, plot.y + plot.h - h / 2 - 22);
  }

  drawCover(item, centerX, centerY, w, h, item.saturation, item.opacity);

  // colored bar at the bottom: gold = film, green = book
  noStroke();
  fill(color);
  drawingContext.save();
  drawingContext.globalAlpha = item.opacity;
  rect(centerX - w / 2, centerY + h / 2 - 2, w, 2);
  drawingContext.restore();

  // outline
  if (item === selectedItem || isHovered) {
    noFill();
    stroke(item === selectedItem ? COLORS.text : color);
    strokeWeight(item === selectedItem ? 2 : 1);
    rect(centerX - w / 2, centerY - h / 2, w, h);
  }

  // rating chip under the enlarged cover
  if (isHovered) {
    const chipText = isRated(item) ? `★ ${currentRating(item)}` : `≈ ${item.pred.toFixed(2)}`;
    textSize(11.5);
    textStyle(BOLD);
    const chipWidth = textWidth(chipText) + 14;
    const chipY = min(centerY + h / 2 + 4, height - 24);

    fill(COLORS.background);
    stroke(color);
    strokeWeight(1);
    rect(centerX - chipWidth / 2, chipY, chipWidth, 20, 3);

    noStroke();
    fill(isRated(item) ? COLORS.text : color);
    textAlign(CENTER, CENTER);
    text(chipText, centerX, chipY + 10.5);
    textStyle(NORMAL);
  }
}

// ───────────────────────────── side panel ─────────────────────────────
// splits a string into lines that each fit within maxWidth pixels
function wrapText(str, maxWidth) {
  const words = String(str).split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (textWidth(testLine) > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// draws wrapped text (cut off with "…" if it goes over maxLines) and returns the y position below it
function drawParagraph(str, x, y, maxWidth, lineHeight, maxLines) {
  let lines = wrapText(str, maxWidth);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…');
  }
  for (let i = 0; i < lines.length; i++) {
    text(lines[i], x, y + i * lineHeight);
  }
  return y + lines.length * lineHeight;
}

// draws a bold heading with a line under it and returns the y position below it
function drawHeading(str, x, y) {
  fill(COLORS.text);
  textStyle(BOLD);
  textSize(11.5);
  textAlign(LEFT, TOP);
  text(str, x, y);

  textStyle(NORMAL);
  stroke(COLORS.grid);
  line(x, y + 17, x + layout.panel.w - 40, y + 17);
  noStroke();
  return y + 25;
}

// draws the side panel: view title, details card for the hovered/selected cover, legend, and reset button
function drawPanel() {
  const panel = layout.panel;
  const x = panel.x + 20;
  const w = panel.w - 40;

  noStroke();
  fill(COLORS.panel);
  rect(panel.x, 0, panel.w, height);
  stroke(COLORS.grid);
  line(panel.x, 0, panel.x, height);
  noStroke();

  panelButtons = [];
  let y = 22;
  const view = VIEWS[viewIndex];
  y = drawHeading(`VIEW ${viewIndex + 1} · ${view.label} ${view.sub}`, x, y) + 6;

  const cardItem = hoveredItem || selectedItem;
  ratingInputState.show = false;
  if (cardItem) {
    y = drawCard(cardItem, x, y, w);
  }
  drawLegend(x, height - 150, w);

  // reset button (only shows if the user has typed in any ratings)
  const numEntered = Object.keys(userRatings).length;
  if (numEntered > 0) {
    const resetButton = { x: x, y: height - 34, w: w, h: 24, action: 'reset' };
    panelButtons.push(resetButton);

    stroke(COLORS.warning);
    noFill();
    rect(resetButton.x, resetButton.y, resetButton.w, resetButton.h, 3);
    noStroke();
    fill(COLORS.warning);
    textAlign(CENTER, CENTER);
    textSize(11);
    text(
      `reset my ${numEntered} entered rating${numEntered > 1 ? 's' : ''}`,
      resetButton.x + resetButton.w / 2,
      resetButton.y + 12.5
    );
  }
}

// draws the details card (cover, title, ratings, genres, etc) and the rating input for the hovered/selected cover
// returns the y position below the card
function drawCard(item, x, y, w) {
  const color = item.type === 'movie' ? COLORS.movie : COLORS.book;
  const rated = isRated(item);
  const coverW = 84;
  const coverH = 126;

  // cover on the left
  drawCover(item, x + coverW / 2, y + coverH / 2, coverW, coverH, 1, 1);
  noFill();
  stroke(color);
  rect(x, y, coverW, coverH);
  noStroke();

  // title, subtitle (year + director, or author), and FILM/BOOK tag on the right
  const textX = x + coverW + 12;
  const textW = w - coverW - 12;
  fill(COLORS.text);
  textStyle(BOLD);
  textSize(12.5);
  textAlign(LEFT, TOP);
  let textY = drawParagraph(item.title, textX, y, textW, 15, 4);

  textStyle(NORMAL);
  fill(COLORS.mute);
  textSize(11);
  textY = drawParagraph(item.subtitle, textX, textY + 2, textW, 14, 2) + 4;

  fill(color);
  textSize(11);
  drawParagraph(item.type === 'movie' ? 'FILM' : 'BOOK', textX, textY, textW, 14);
  y += coverH + 12;

  // my rating (or predicted rating) and public rating
  fill(COLORS.text);
  textSize(13);
  textStyle(BOLD);
  if (rated) {
    const enteredNote = item.rating == null ? '  (entered)' : '';
    text(`my rating   ★ ${currentRating(item)}${enteredNote}`, x, y);
  } else {
    text(`predicted   ≈ ${item.pred.toFixed(2)} ★`, x, y);
  }
  textStyle(NORMAL);
  y += 20;

  fill(COLORS.mute);
  textSize(11);
  const publicText = item.public_rating == null ? '–' : item.public_rating.toFixed(2);
  text(`public      ${publicText} ★`, x, y);
  y += 20;

  // genres, themes, moods, pace (whichever this item has)
  const tags = [];
  if (item.genres.length) {
    tags.push(['genres', item.genres.slice(0, 5).join(', ')]);
  }
  if (item.themes.length) {
    tags.push(['themes', item.themes.slice(0, 3).join(' · ')]);
  }
  if (item.moods.length) {
    tags.push(['moods', item.moods.join(', ')]);
  }
  if (item.pace) {
    tags.push(['pace', item.pace]);
  }
  for (const [name, value] of tags) {
    fill(COLORS.text);
    text(name, x, y);
    fill(COLORS.mute);
    const maxLines = name === 'themes' ? 4 : 2;
    y = drawParagraph(value, x, y + 14, w, 14, maxLines) + 6;
  }

  // rating input (only for items i didn't already rate in the original data)
  if (item.rating == null) {
    y += 4;
    const isSelected = item === selectedItem;
    fill(isSelected ? COLORS.text : color);
    textSize(11);

    if (!isSelected) {
      // just a hint until the user clicks the cover
      let hint;
      if (rated) {
        hint = 'click to change my rating';
      } else {
        const verb = item.type === 'movie' ? 'watched' : 'read';
        hint = `click if I've ${verb} it, to enter my rating`;
      }
      y = drawParagraph(hint, x, y, w, 14) - 14;
    } else if (rated) {
      text('change my rating (Enter to save):', x, y);
    } else {
      text(`my rating (${data.config[item.type].step}–5), then Enter:`, x, y);
    }

    // remember where the input box goes (positionControls() moves the actual html input there)
    ratingInputState = {
      x: x,
      y: y + 16,
      width: w - (rated ? 70 : 0),
      show: isSelected,
      forId: item.id
    };

    // "clear" button next to the input, for ratings the user already entered
    if (rated && isSelected) {
      const clearButton = { x: x + w - 62, y: y + 16, w: 62, h: 28, action: 'clear', item: item };
      panelButtons.push(clearButton);
      stroke(COLORS.mute);
      noFill();
      rect(clearButton.x, clearButton.y, clearButton.w, clearButton.h, 3);
      noStroke();
      fill(COLORS.mute);
      textAlign(CENTER, CENTER);
      text('clear', clearButton.x + clearButton.w / 2, clearButton.y + 15);
      textAlign(LEFT, TOP);
    }
    y += 52;
  }
  return y;
}

// draws the legend at the bottom of the panel (full color = rated, faded = predicted, gold = film, green = book)
function drawLegend(x, y, w) {
  y = drawHeading('LEGEND', x, y);

  // use any cover that has loaded as the example
  const exampleItem = items.find(item => item.img && item.img.width > 1) || items[0];
  drawCover(exampleItem, x + 9, y + 13, 18, 27, 0.9, 1);
  drawCover(exampleItem, x + 34, y + 13, 18, 27, SATURATION.predicted, 1);

  fill(COLORS.mute);
  textSize(10.5);
  textAlign(LEFT, TOP);
  text('full colour = I rated it', x + 50, y + 1);
  text('faded = predicted for me', x + 50, y + 15);
  y += 36;

  fill(COLORS.movie);
  rect(x, y + 2, 10, 3);
  fill(COLORS.mute);
  text('film', x + 14, y - 2);

  fill(COLORS.book);
  rect(x + 58, y + 2, 10, 3);
  fill(COLORS.mute);
  text('book', x + 72, y - 2);
}

// draws the little message at the bottom of the plot (ex: "re-trained on 209 films...") that fades out after 5 seconds
function drawChangeMessage() {
  if (!changeMessage.text) {
    return;
  }
  const age = millis() - changeMessage.startTime;
  if (age > 5000) {
    return;
  }
  const opacity = age > 4200 ? 1 - (age - 4200) / 800 : 1;

  textSize(11.5);
  textAlign(CENTER, CENTER);
  textStyle(NORMAL);
  const boxWidth = min(textWidth(changeMessage.text) + 28, layout.plot.w);
  const centerX = layout.plot.x + layout.plot.w / 2;
  const centerY = layout.plot.y + layout.plot.h - 40;
  const color = changeMessage.isWarning ? COLORS.warning : COLORS.text;

  drawingContext.save();
  drawingContext.globalAlpha = opacity;
  fill(COLORS.panel);
  stroke(color);
  strokeWeight(1);
  rect(centerX - boxWidth / 2, centerY - 15, boxWidth, 30, 4);
  noStroke();
  fill(color);
  text(changeMessage.text, centerX, centerY);
  drawingContext.restore();
}

// the filter dropdown and rating box are html elements, so they have to be moved to follow the canvas layout
function positionControls() {
  filterSelect.position(layout.plot.x, FILTER_TOP);

  const showRatingBox =
    ratingInputState.show &&
    selectedItem &&
    selectedItem.id === ratingInputState.forId &&
    !(hoveredItem && hoveredItem !== selectedItem);

  if (showRatingBox) {
    ratingInput.show();
    ratingInput.position(ratingInputState.x, ratingInputState.y);
    ratingInput.size(ratingInputState.width - 16);
  } else {
    ratingInput.hide();
  }
}

// ───────────────────────────── mouse + keyboard input ─────────────────────────────
function isMouseInPlot() {
  const plot = layout.plot;
  return (
    mouseX > plot.x &&
    mouseX < plot.x + plot.w &&
    mouseY > plot.y &&
    mouseY < plot.y + plot.h
  );
}

// p5 event function for the scroll wheel: zoom in/out around the mouse
function mouseWheel(event) {
  if (!isReady || !isMouseInPlot()) {
    return true; // let the page scroll normally
  }
  zoomAt(mouseX, mouseY, pow(1.0015, -event.delta));
  return false;
}

// p5 event function for dragging: pan the plot
function mouseDragged() {
  if (!dragState) {
    return;
  }
  const plot = layout.plot;
  const dx = ((mouseX - dragState.lastX) / plot.w) * (zoomWindow.x1 - zoomWindow.x0);
  const dy = ((mouseY - dragState.lastY) / plot.h) * (zoomWindow.y1 - zoomWindow.y0);

  // only start panning once the mouse has moved a few pixels (so a click isn't a drag)
  if (dist(mouseX, mouseY, dragState.startX, dragState.startY) > 4) {
    dragState.moved = true;
  }
  if (dragState.moved) {
    zoomWindow.x0 -= dx;
    zoomWindow.x1 -= dx;
    zoomWindow.y0 += dy;
    zoomWindow.y1 += dy;
    keepWindowInBounds();
    updateTargets();
    settleFrames = 60;
  }
  dragState.lastX = mouseX;
  dragState.lastY = mouseY;
}

// clicking empty space (without dragging) deselects the selected cover
function mouseReleased() {
  const clickedEmptySpace =
    dragState &&
    !dragState.moved &&
    !hoveredItem &&
    mouseX > layout.plot.x - 30 &&
    mouseX < layout.panel.x;
  if (clickedEmptySpace) {
    selectedItem = null;
  }
  dragState = null;
}

// double-clicking empty space resets the zoom
function doubleClicked() {
  if (isReady && isMouseInPlot() && !hoveredItem) {
    resetZoom();
  }
}

function mousePressed() {
  if (!isReady) {
    return;
  }

  // check what's under the mouse right now (don't rely on the previous frame)
  hoveredItem = findHoveredItem();

  // pressing on empty space in the plot starts a possible drag
  if (isMouseInPlot() && !hoveredItem) {
    dragState = { lastX: mouseX, lastY: mouseY, startX: mouseX, startY: mouseY, moved: false };
  }

  // view tabs
  for (const button of viewButtons) {
    if (isMouseInRect(button)) {
      setView(button.index);
      return;
    }
  }

  // panel buttons (reset / clear)
  for (const button of panelButtons) {
    if (isMouseInRect(button)) {
      if (button.action === 'reset') {
        resetAllRatings();
      } else if (button.action === 'clear') {
        clearRating(button.item);
      }
      return;
    }
  }

  // clicks in the side panel don't select anything
  if (mouseX >= layout.panel.x) {
    return;
  }

  // clicking a cover selects it (clicking it again deselects), and opens the rating box if the user can rate it
  if (hoveredItem) {
    selectedItem = selectedItem === hoveredItem ? null : hoveredItem;

    if (selectedItem && selectedItem.rating == null) {
      ratingInput.value(isRated(selectedItem) ? String(currentRating(selectedItem)) : '');
      setTimeout(() => {
        ratingInput.show();
        ratingInput.elt.focus();
        ratingInput.elt.select();
      }, 0);
    }
  }
}

// keyboard p5 event function
// 1-6 switch views, 0 resets the zoom, escape deselects
function keyPressed() {
  // don't steal keystrokes while the user is typing in the rating box or using the dropdown
  const focused = document.activeElement;
  if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'SELECT')) {
    return;
  }

  if (key >= '1' && key <= '6') {
    setView(int(key) - 1);
  }
  if (key === '0') {
    resetZoom();
  }
  if (keyCode === ESCAPE) {
    selectedItem = null;
  }
}
